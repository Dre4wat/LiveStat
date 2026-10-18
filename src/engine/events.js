import {SPORTS} from '../providers/espn.js';
export const FOOTBALL_PLAYER={targets:'Targets',receivingYards:'Receiving yards',receptions:'Receptions',receivingTouchdowns:'Receiving TDs',fumbles:'Fumbles'};
export const FOOTBALL_TEAM={touchdowns:'Touchdowns',fieldGoals:'Made field goals',sacks:'Sacks allowed',interceptions:'Interceptions thrown',fumbles:'Fumbles on offense'};
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
function footballPlay(play,watch){
  const text=String(play.text||'');const out=[];
  const add=(stat,delta,detail)=>{if(delta>0)out.push({stat,delta,detail,label:statCatalog(watch.sport,watch.kind)[stat]});};
  if(watch.kind==='player'){
    const isTarget=receiver(text,watch.name),isFumble=fumbler(text,watch.name);
    if(isTarget){add('targets',1,'Pass intended for '+watch.name);
      if(!/\b(incomplete|intercepted|dropped|no play)\b/i.test(text)){
        add('receptions',1,'Completed pass to '+watch.name);
        const yards=receivingYards(text,watch.name);if(yards!==0){out.push({stat:'receivingYards',delta:yards,detail:`${yards>0?'+':''}${yards} receiving yards`,label:statCatalog(watch.sport,watch.kind).receivingYards});}
        if(/\btouchdown\b/i.test(text))add('receivingTouchdowns',1,'Receiving touchdown');
      }
    }
    if(isFumble)add('fumbles',1,'Fumble credited to '+watch.name);
  }else if(String(play.teamId)===String(watch.teamId)){
    if(/\btouchdown\b/i.test(text))add('touchdowns',1,'Offensive-team touchdown');
    if(/\bfield goal\b/i.test(text)&&/\b(good|made)\b/i.test(text))add('fieldGoals',1,'Made field goal');
    if(/\bsacked\b/i.test(text))add('sacks',1,'Sack allowed');
    if(/\bintercepted\b/i.test(text))add('interceptions',1,'Interception thrown');
    if(/\bfumbles?\b/i.test(text))add('fumbles',1,'Fumble on offensive play');
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
  return {sport,kind:input.kind,name,teamId,playerId,gameId,rules,smart,stats:Object.keys(rules)};
}
