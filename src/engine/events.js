import {SPORTS} from '../providers/espn.js';
import {FOOTBALL_PLAYER_STATS,footballPositionGroup} from '../../public/football-stats.js';
export const FOOTBALL_PLAYER=FOOTBALL_PLAYER_STATS;
export const FOOTBALL_TEAM={touchdowns:'Touchdowns',fieldGoals:'Made field goals',sacks:'Sacks allowed',interceptions:'Interceptions thrown',fumbles:'Fumbles on offense',redZoneEntries:'Red-zone entries',scoringDrives:'Scoring drives',turnovers:'Turnovers'};
export const BASKETBALL_PLAYER={points:'Points',rebounds:'Rebounds',assists:'Assists',steals:'Steals',blocks:'Blocks',threePointers:'3-pointers made',turnovers:'Turnovers'};
export const BASKETBALL_TEAM={points:'Points scored',threePointers:'3-pointers made'};
export function statCatalog(sport,kind){return (SPORTS[sport]?.ball==='basketball')
  ?(kind==='player'?BASKETBALL_PLAYER:BASKETBALL_TEAM)
  :(kind==='player'?FOOTBALL_PLAYER:FOOTBALL_TEAM);}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function aliases(name){
  const tokens=String(name).trim().split(/\s+/).filter(Boolean);
  if(!tokens.length)return [];
  const first=tokens[0],last=tokens.at(-1);
  return [...new Set([tokens.join(' '),`${first[0]}.${last}`,`${first[0]} ${last}`,last])];
}
function mention(text,parts){return parts.some(s=>new RegExp(`(^|[^A-Za-z])${escape(s)}(?=$|[^A-Za-z])`,'i').test(text));}
function playerNamed(text,name,strict=false){
  // For basketball, reject surname-only matches (e.g. LeBron vs Bronny James).
  const names=aliases(name);
  return mention(text,strict?names.filter(x=>x!==name.trim().split(/\s+/).at(-1)):names);
}
function receiver(text,name){
  const p=/\bpass\b/i.exec(text);
  if(!p&&!/\b(receiv|targeted|intended for)\b/i.test(text))return false;
  const m=/\b(?:to|intended for|targeted)\s+(.+)/i.exec(p?text.slice(p.index):text);
  if(m&&playerNamed(m[1].slice(0,100),name))return true;
  return aliases(name).some(a=>new RegExp(`${escape(a)}\\s+-?\\d+\\s*(?:Yd|yards?)\\s+pass`,'i').test(text));
}
function receivingYards(text,name){
  const p=/\bpass\b/i.exec(text),m=p&&/\bto\s+(.+)/i.exec(text.slice(p.index));
  if(m&&playerNamed(m[1].slice(0,100),name)){
    const n=/\bfor\s+(-?\d+)\s+yards?\b/i.exec(m[1]);if(n)return Number(n[1]);
  }
  for(const a of aliases(name)){
    const n=new RegExp(`${escape(a)}\\s+(-?\\d+)\\s*(?:Yd|yards?)\\s+pass`,'i').exec(text);
    if(n)return Number(n[1]);
  }
  return 0;
}
function fumbler(text,name){const m=/\bfumbles?\b/i.exec(text);return !!m&&playerNamed(text.slice(Math.max(0,m.index-90),m.index),name);}
function scorePlayer(text){
  // ESPN basketball convention: "LeBron James makes 26-foot three point jumper".
  const m=/^(.+?)\s+(?:makes|hits|made)\s+(?:a\s+)?(?:\d+-foot\s+)?/i.exec(text);
  if(m)return m[1];
  const alt=/^(.*?)\s+(?:free throw|layup|dunk|jumper).*?\b(?:made|good)\b/i.exec(text);
  return alt?.[1]||'';
}
function scorePoints(play){
  const text=String(play.text||'');
  if(/\bmiss(?:es|ed)?\b/i.test(text)||/\bno basket\b/i.test(text))return 0;
  const made=/\b(makes|made|hits|is good)\b/i.test(text);
  if(!made&&!play.scoringPlay)return 0;
  if(Number(play.scoreValue)>0&&Number(play.scoreValue)<=4)return Number(play.scoreValue);
  if(/free throw/i.test(text))return 1;
  if(/three.point|3.pt|3.point/i.test(text))return 3;
  if(/\b(?:layup|dunk|jumper|hook shot|tip shot|basket)\b/i.test(text))return 2;
  return 0;
}
function basketballPlay(play,watch){
  const text=String(play.text||'');const name=watch.name;const out=[];
  const add=(stat,delta,detail)=>{if(delta>0)out.push({stat,delta,detail,label:statCatalog(watch.sport,watch.kind)[stat]});};
  const score=scorePoints(play);
  if(watch.kind==='team'){
    if(String(play.teamId)===String(watch.teamId)&&score>0){add('points',score,`+${score} team points`);if(score===3&&/three.point|3.pt|3.point/i.test(text))add('threePointers',1,'Made 3-pointer');}
    return out;
  }
  // Only attribute baskets to the scorer before "makes", not assistants in parentheses.
  const scorer=scorePlayer(text);
  const playerScored=!!scorer&&playerNamed(scorer,name,true);
  if(score>0&&playerScored){add('points',score,`+${score} points on this play`);if(score===3)add('threePointers',1,'Made 3-pointer');}
  // These are limited, text-based heuristics. Provider athlete IDs are preferable.
  if(new RegExp(`^(?:${aliases(name).filter(x=>x!==name.trim().split(/\s+/).at(-1)).map(escape).join('|')})\\b`,'i').test(text)){
    if(/\b(?:offensive|defensive|total) rebound\b/i.test(text))add('rebounds',1,'Rebound');
    if(/\bturnover\b/i.test(text))add('turnovers',1,'Turnover');
    if(/\bsteal\b/i.test(text))add('steals',1,'Steal');
    if(/\bblock\b/i.test(text))add('blocks',1,'Blocked shot');
    if(/\bassist\b/i.test(text)&&!playerScored)add('assists',1,'Assist');
  }
  // ESPN usually formats assists "(LeBron James assists)".
  const patterns=[['assists',/\(([^()]+?)\s+assists?\)/i,'Assist'],['steals',/\(([^()]+?)\s+steals?\)/i,'Steal'],['blocks',/\(([^()]+?)\s+blocks?\)/i,'Blocked shot']];
  for(const [stat,re,label] of patterns){const m=re.exec(text);if(m&&playerNamed(m[1],name,true)&&!out.some(e=>e.stat===stat))add(stat,1,label);}
  return out;
}
function namedQuarterback(text,name){
  const prefix=text.split(/\bpass(?:es|ed)?\b/i)[0];
  return /\bpass(?:es|ed)?\b/i.test(text)&&playerNamed(prefix,name,true);
}
function namedRunner(text,name){
  const prefix=text.split(/\b(tackled by|tackle by|stopped by|for loss by)\b/i)[0].split(/\(/)[0];
  const rush=/(?:\brush(?:es|ed|ing)?\b|\bruns?\b|\bscrambl(?:es|ed)\b|\b(?:left|right) (?:end|guard|tackle)\b|\bup the middle\b)/i.test(prefix);
  if(rush&&playerNamed(prefix,name,true))return true;
  return playerNamed(prefix,name,true)&&/\b-?\d+\s*(?:yd|yards?)\s+run\b/i.test(prefix);
}
function footballPlay(play,watch){
  const text=String(play.text||''),out=[];
  const add=(stat,delta,detail)=>{
    if(!Number.isFinite(delta)||delta===0)return;
    out.push({stat,delta,detail,label:statCatalog(watch.sport,watch.kind)[stat]});
  };
  if(watch.kind==='player'){
    const group=footballPositionGroup(watch.position);
    // Credit for defenders comes from confirmed box score changes instead of ambiguous text.
    if(group==='DEF')return out;
    const qb=(group==='QB'||group==='OTHER')&&namedQuarterback(text,watch.name);
    if(qb&&!/\bno play\b/i.test(text)){
      add('passingAttempts',1,'Pass attempt');
      const completed=/\bpass\s+(?:complete\s+)?to\b/i.test(text)&&!/\b(incomplete|intercepted|dropped|intended for)\b/i.test(text);
      if(completed){
        add('completions',1,'Completed pass');
        const yards=/\bpass\s+(?:complete\s+)?to\b.*?\bfor\s+(-?\d+)\s*(?:yds?|yards?)\b/i.exec(text);
        if(yards)add('passingYards',Number(yards[1]),Number(yards[1])+' passing yards');
        if(/\btouchdown\b/i.test(text))add('passingTouchdowns',1,'Passing touchdown');
      }
      if(/\bintercepted\b/i.test(text))add('interceptionsThrown',1,'Interception thrown');
    }
    const rush=['QB','RB','REC','RET','OTHER'].includes(group)&&namedRunner(text,watch.name);
    if(rush&&!/\bno play\b/i.test(text)){
      add('rushingAttempts',1,'Rushing attempt');
      const yards=/\bfor\s+(-?\d+)\s*(?:yds?|yards?)\b/i.exec(text)||/(-?\d+)\s*(?:yds?|yards?)\s+run\b/i.exec(text);
      if(yards)add('rushingYards',Number(yards[1]),Number(yards[1])+' rushing yards');
      if(/\btouchdown\b/i.test(text))add('rushingTouchdowns',1,'Rushing touchdown');
    }
    if(receiver(text,watch.name)){
      add('targets',1,'Pass intended for '+watch.name);
      if(!/\b(incomplete|intercepted|dropped|no play)\b/i.test(text)){
        add('receptions',1,'Completed pass to '+watch.name);
        const yards=receivingYards(text,watch.name);
        if(yards!==0)add('receivingYards',yards,(yards>0?'+':'')+yards+' receiving yards');
        if(/\btouchdown\b/i.test(text))add('receivingTouchdowns',1,'Receiving touchdown');
      }
    }
    if(fumbler(text,watch.name))add('fumbles',1,'Fumble credited to '+watch.name);
  }else if(String(play.teamId)===String(watch.teamId)){
    if(/\btouchdown\b/i.test(text))add('touchdowns',1,'Offensive-team touchdown');
    if(/\bfield goal\b/i.test(text)&&/\b(good|made)\b/i.test(text))add('fieldGoals',1,'Made field goal');
    if(/\bsacked\b/i.test(text))add('sacks',1,'Sack allowed');
    if(/\bintercepted\b/i.test(text))add('interceptions',1,'Interception thrown');
    if(/\bfumbles?\b/i.test(text))add('fumbles',1,'Fumble on offensive play');
    const opp=String(play.opponentAbbr||'').replace(/[^A-Z]/gi,'');
    if(opp.length>=2&&play.driveId){
      const m=new RegExp('\\bat\\s+'+opp+'\\s+(\\d{1,2})\\b','i').exec(text);
      if(m&&Number(m[1])<=20&&Number(m[1])>0)add('redZoneEntries',1,'Offense reached the opposing red zone');
    }
    if(play.scoringPlay&&/\btouchdown\b|\bfield goal\b.*\b(good|made)\b/i.test(text))add('scoringDrives',1,'Scoring drive');
    if(/\bintercepted\b/i.test(text)||(/\bfumbles?\b/i.test(text)&&/\brecovered by\b/i.test(text)))add('turnovers',1,'Turnover on offensive possession');
  }
  return out;
}
export function matchPlay(play,watch){
  const events=SPORTS[watch.sport||'nfl']?.ball==='basketball'?basketballPlay(play,{...watch,sport:watch.sport||'nba'}):footballPlay(play,{...watch,sport:watch.sport||'nfl'});
  const selected=watch.rules?Object.entries(watch.rules).filter(([,r])=>r.every||r.target!=null).map(([k])=>k):watch.stats||[];
  return events.filter(e=>selected.includes(e.stat));
}
export function normalizeWatch(input){
  const sport=String(input?.sport||'nfl');if(!SPORTS[sport])throw new Error('Choose a league');
  if(!['team','player'].includes(input?.kind))throw new Error('Choose player or team');
  const name=String(input.name||'').trim().slice(0,90),teamId=String(input.teamId||''),playerId=input.kind==='player'?String(input.playerId||''):'';
  if(!name||!/^\d{1,8}$/.test(teamId))throw new Error('Choose a valid team');
  if(input.kind==='player'&&!/^\d{1,14}$/.test(playerId))throw new Error('Choose a valid player');
  const position=input.kind==='player'?String(input.position||'').trim().toUpperCase().slice(0,10):'';
  const catalog=statCatalog(sport,input.kind),rules={};
  const original=input.rules&&typeof input.rules==='object'&&!Array.isArray(input.rules)
    ?input.rules:Object.fromEntries((Array.isArray(input.stats)?input.stats:[]).map(k=>[k,{every:true}]));
  for(const [stat,r] of Object.entries(original)){
    if(!(stat in catalog))continue;
    let target=null;
    if(r&&r.target!==undefined&&r.target!==null&&r.target!==''){
      target=Number(r.target);if(!Number.isSafeInteger(target)||target<1||target>100000)throw new Error(`Invalid target for ${catalog[stat]}`);
    }
    const every=r?.every===true;
    if(every||target!==null)rules[stat]={every,target};
  }
  if(!Object.keys(rules).length)throw new Error('Select at least one statistic and alert method');
  const gameId=String(input?.gameId||'');
  if(gameId&&!/^\d{6,14}$/.test(gameId))throw new Error('Invalid game selection');

  const rawSmart=input.smart&&typeof input.smart==='object'&&!Array.isArray(input.smart)?input.smart:{};
  const combine=['all','any'].includes(rawSmart.combine)?rawSmart.combine:'off';
  const near=Math.min(20,Math.max(0,Number.isSafeInteger(Number(rawSmart.near))?Number(rawSmart.near):0));
  const periodMin=Math.min(8,Math.max(0,Number.isSafeInteger(Number(rawSmart.periodMin))?Number(rawSmart.periodMin):0));
  const maxMargin=rawSmart.maxMargin==null||rawSmart.maxMargin===''?null:Math.min(30,Math.max(0,Number(rawSmart.maxMargin)||0));
  const smart={combine,near,periodMin,maxMargin};
  return {sport,kind:input.kind,name,teamId,playerId,position,gameId,rules,smart,stats:Object.keys(rules)};
}
