import crypto from 'node:crypto';
import {matchPlay,statCatalog} from './events.js';
import {SPORTS} from '../providers/espn.js';
import {pruneStore,writeStore} from './store.js';
const gameKey=(sport,id)=>`${sport}:${id}`;
const totalKey=(game,watch,stat)=>`${game}:${watch.id}:${stat}`;
const configFor=(watch,stat)=>watch.rules?.[stat]||((watch.stats||[]).includes(stat)?{every:true,target:null}:null);
export function makeMonitor({providers,provider,state,deliver,emit=()=>{}}){
  const feeds=providers||{nfl:provider};
  state.totals||={};state.totalsAt||={};
  let games=[],lastGamesFetch=0,polling=false;
  async function fetchGames(){
    const sports=[...new Set(state.watches.map(w=>w.sport||'nfl'))];
    const results=await Promise.allSettled(sports.map(async s=>{
      if(!feeds[s])throw new Error(`No ${s} data provider`);
      return (await feeds[s].games()).map(g=>({...g,sport:g.sport||s}));
    }));
    const errors=results.flatMap((r,i)=>r.status==='rejected'?[`${sports[i]}: ${r.reason.message}`]:[]);
    games=results.flatMap(r=>r.status==='fulfilled'?r.value:[]);
    lastGamesFetch=Date.now();
    if(errors.length)state.stats.lastError=errors.join('; ');
    return games;
  }
  function makeAlert({watch,event,game,play,category,oldTotal,total,target=null,demo=false}){
    // One alert per changed statistic per play, regardless of how large its delta is.
    // Keep the legacy -1 suffix so previously delivered alerts retain their IDs.
    const suffix=category==='target'?`target-${target}`:`every-${play.id}-${event.stat}-1`;
    const id=demo?`demo-${crypto.randomUUID()}`:`${watch.id}:${gameKey(watch.sport||'nfl',game.id)}:${suffix}`;
    const label=category==='target'?`🎯 TARGET REACHED · ${event.label}`:event.label;
    const detail=category==='target'
      ?`${watch.name} reached ${target} ${event.label.toLowerCase()} (now ${total})!`
      :`${event.detail} · Total: ${total}`;
    return {id,watchId:watch.id,sport:watch.sport||'nfl',name:watch.name,kind:watch.kind,
      stat:event.stat,category,target,oldTotal,total,delta:event.delta,label,detail,
      description:play.text,game:game.name,period:play.period,clock:play.clock,
      demo,time:new Date().toISOString()};
  }
  async function deliverEvents(watch,game,play,{demo=false,totals=state.totals}={}){
    let sent=0;const gk=gameKey(watch.sport||'nfl',game.id);
    // Consolidate repeated entries for the same stat on one play. This guarantees
    // a three-pointer, multi-yard catch, etc. gets ONE regular alert per statistic.
    const changes=new Map();
    for(const event of matchPlay(play,watch)){
      const previous=changes.get(event.stat);
      if(previous){
        previous.delta+=event.delta;
        previous.detail=`${previous.delta>0?'+':''}${previous.delta} ${event.label.toLowerCase()} on this play`;
      }else changes.set(event.stat,{...event});
    }
    for(const event of changes.values()){
      const rule=configFor(watch,event.stat);
      if(!rule||event.delta===0)continue;
      if(event.stat==='redZoneEntries'&&play.driveId){
        const zoneKey=watch.id+':'+gk+':redzone-drive:'+play.driveId;
        if(!demo&&state.notified[zoneKey])continue;
        if(!demo)state.notified[zoneKey]=Date.now();
      }
      const tk=totalKey(gk,watch,event.stat),old=totals[tk]||0,next=old+event.delta;
      totals[tk]=next;
      const alerts=[];
      if(rule.every)alerts.push(makeAlert({watch,event,game,play,category:'every',oldTotal:old,total:next,demo}));
      // Crossing check handles 14 -> 17, and emits milestone ONCE per game.
      if(rule.target!=null&&old<rule.target&&next>=rule.target)
        alerts.push(makeAlert({watch,event,game,play,category:'target',oldTotal:old,total:next,target:rule.target,demo}));

      if(rule.target!=null&&(watch.smart?.near||0)>0&&next<rule.target&&next>=rule.target-watch.smart.near&&old<rule.target-watch.smart.near){
        const nearId=demo?'demo-'+crypto.randomUUID():watch.id+':'+gk+':near:'+event.stat+':'+rule.target;
        if(demo||!state.notified[nearId]){
          if(!demo)state.notified[nearId]=Date.now();
          const advance={id:nearId,watchId:watch.id,sport:watch.sport||'nfl',name:watch.name,kind:watch.kind,
            stat:event.stat,category:'near',label:'⚡ ALMOST THERE · '+event.label,
            detail:next+'/'+rule.target+' '+event.label.toLowerCase()+' (only '+(rule.target-next)+' remaining)',
            game:game.name,description:play.text,period:play.period,clock:play.clock,demo,time:new Date().toISOString()};
          state.alerts.unshift(advance);emit('alert',advance);sent++;
          try{await deliver(advance)}catch(err){state.stats.lastError='Push failed: '+err.message;}
        }
      }
      for(const alert of alerts){
        if(!demo&&state.notified[alert.id])continue;
        if(!demo)state.notified[alert.id]=Date.now();
        state.alerts.unshift(alert);emit('alert',alert);sent++;
        try{await deliver(alert)}catch(err){state.stats.lastError=`Push failed: ${err.message}`;}
      }
    }

    // Compound mission rules. The target for each stat is still checked independently.
    const smart=watch.smart||{},goals=Object.entries(watch.rules||{}).filter(([,r])=>r.target!=null);
    if(goals.length>=2&&['all','any'].includes(smart.combine)){
      const reached=goals.map(([stat,r])=>(totals[totalKey(gk,watch,stat)]||0)>=r.target);
      const meets=smart.combine==='all'?reached.every(Boolean):reached.some(Boolean);
      const period=Number(play.period)||0;
      const scores=Number.isFinite(play.homeScore)&&Number.isFinite(play.awayScore);
      const situational=(smart.periodMin==null||period>=smart.periodMin)&&
        (smart.maxMargin==null||(scores&&Math.abs(play.homeScore-play.awayScore)<=smart.maxMargin));
      if(meets&&situational){
        const id=demo?'demo-'+crypto.randomUUID():watch.id+':'+gk+':combo:'+smart.combine;
        if(demo||!state.notified[id]){
          if(!demo)state.notified[id]=Date.now();
          const completed=reached.filter(Boolean).length;
          const event={id,watchId:watch.id,sport:watch.sport||'nfl',name:watch.name,kind:watch.kind,
            stat:'mission',category:'target',target:completed,label:'🏆 MISSION COMPLETE',
            detail:completed+'/'+goals.length+' target objectives achieved ('+smart.combine.toUpperCase()+')',
            description:play.text,game:game.name,period:play.period,clock:play.clock,demo,time:new Date().toISOString()};
          state.alerts.unshift(event);emit('alert',event);sent++;
          try{await deliver(event)}catch(err){state.stats.lastError='Push failed: '+err.message;}
        }
      }
    }
    return sent;
  }
  function seedTotals(watch,game,plays){
    const prefix=gameKey(watch.sport||'nfl',game.id);
    const catalog=statCatalog(watch.sport||'nfl',watch.kind);
    const watched=Object.keys(watch.rules||Object.fromEntries((watch.stats||[]).map(s=>[s,1])))
      .filter(x=>x in catalog);
    if(watched.every(s=>Object.hasOwn(state.totals,totalKey(prefix,watch,s))))return;
    const sum=Object.fromEntries(watched.map(s=>[s,0]));
    for(const p of plays){for(const e of matchPlay(p,watch))if(e.stat in sum)sum[e.stat]+=e.delta;}
    for(const s of watched){const k=totalKey(prefix,watch,s);if(!Object.hasOwn(state.totals,k))state.totals[k]=sum[s];}
    state.totalsAt[prefix]=Date.now();
  }
  async function poll(){
    if(polling)return;polling=true;
    try{
      state.stats.lastError=null;
      if(!games.length||Date.now()-lastGamesFetch>45000)await fetchGames();
      const live=games.filter(g=>g.live&&state.watches.some(w=>(w.sport||'nfl')===g.sport&&(!w.gameId||String(w.gameId)===String(g.id))&&g.teams.some(t=>String(t.id)===String(w.teamId))));
      state.stats.games=live.length;
      for(const game of live){
        try{
          const plays=await feeds[game.sport].plays(game.id);
          const gk=gameKey(game.sport,game.id);
          const prior=state.seen[gk]||(game.sport==='nfl'?state.seen[game.id]:null);
          const watches=state.watches.filter(w=>(w.sport||'nfl')===game.sport&&(!w.gameId||String(w.gameId)===String(game.id))&&game.teams.some(t=>String(t.id)===String(w.teamId)));
          if(!prior){
            state.seen[gk]={ids:plays.map(p=>String(p.id)),at:Date.now()};
            for(const watch of watches)seedTotals(watch,game,plays);
            continue;
          }
          const ids=new Set(prior.ids);
          const oldPlays=plays.filter(p=>ids.has(String(p.id)));
          for(const watch of watches)seedTotals(watch,game,oldPlays);
          for(const play of plays){
            if(ids.has(String(play.id)))continue;
            ids.add(String(play.id));prior.ids.push(String(play.id));
            for(const watch of watches){
              const opposing=game.teams.find(t=>String(t.id)!==String(watch.teamId));
              await deliverEvents(watch,game,{...play,opponentAbbr:opposing?.abbr||''});
            }
          }
          prior.at=Date.now();state.totalsAt[gk]=Date.now();
        }catch(err){state.stats.lastError=`${game.sport} ${game.name}: ${err.message}`;}
      }
      state.stats.lastPoll=new Date().toISOString();pruneStore(state);writeStore(state);emit('status',state.stats);
    }catch(err){state.stats.lastError=err.message;writeStore(state);emit('status',state.stats);}
    finally{polling=false;}
  }
  async function simulate(watch){
    const sport=watch.sport||'nfl',ball=SPORTS[sport]?.ball;
    const isPlayer=watch.kind==='player',name=watch.name;
    const cases=ball==='basketball'
      ?(isPlayer?[`${name} makes 12-foot two point jumper`,`${name} makes 25-foot three point jumper`,`${name} misses 18-foot jumper`]
        :[`Demo Player makes 13-foot two point jumper`,`Demo Player makes 25-foot three point jumper`])
      :(isPlayer?[`D.QB pass incomplete to ${name}.`,`D.QB pass to ${name} for 14 yards.`,`D.QB pass incomplete to ${name}.`,`${name} FUMBLES, recovered by DEF.`]
        :['Demo offense TOUCHDOWN.','Demo field goal is GOOD.','Demo QB sacked.','Demo QB pass intercepted by DEF.']);
    const mockGame={id:`demo-${crypto.randomUUID()}`,name:`${SPORTS[sport]?.label||'NFL'} demonstration`};
    const demoTotals={};
    // Example LeBron target 15: start at 12, then 2 and 3 => crosses 15.
    if(ball==='basketball'&&isPlayer&&watch.rules?.points?.target!=null){
      demoTotals[totalKey(gameKey(sport,mockGame.id),watch,'points')]=Math.max(0,watch.rules.points.target-3);
    }
    let count=0;
    for(let i=0;i<cases.length;i++){
      const text=cases[i];const score=ball==='basketball'?(/three point/i.test(text)?3:/\bmakes\b/i.test(text)?2:0):0;
      const play={id:`demo-${i}`,text,teamId:watch.teamId,period:1,clock:'12:30',scoringPlay:score>0,scoreValue:score};
      count+=await deliverEvents(watch,mockGame,play,{demo:true,totals:demoTotals});
    }
    pruneStore(state);writeStore(state);return count;
  }
  return {poll,refreshGames:fetchGames,simulate,games:()=>games};
}
