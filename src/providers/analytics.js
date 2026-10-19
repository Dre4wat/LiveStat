// LiveStat Analytics Lab — data normalization and deterministic, evidence-based reporting.
const asArray = x => Array.isArray(x) ? x : [];
const text = x => x == null ? '' : String(x);
const numeric = x => /^-?(?:\d+\.?\d*|\.\d+)$/.test(text(x).trim()) ? Number(x) : null;
const key = x => text(x).trim().toUpperCase().replace(/[^A-Z0-9%]/g,'');
export function normalizeGameLog(raw, season){
  const events = raw?.events || {};
  const map = new Map();
  function add(id, stats, labels, category){
    id=text(id); if(!id) return;
    const meta=Array.isArray(events)?events.find(e=>text(e.id||e.eventId)===id)||{}:events[id]||{};
    const old=map.get(id)||{
      id, date:text(meta.gameDate||meta.date||meta.eventDate),
      opponent:text(meta.opponent?.displayName||meta.opponent?.abbreviation||meta.opponent?.name||meta.opponent||''),
      result:text(meta.gameResult||meta.result),score:text(meta.score?.displayValue||meta.score||''),
      stats:{},groups:{},season:Number(season)
    };
    asArray(labels).forEach((label,i)=>{
      const k=key(label),v=numeric(stats?.[i]);
      if(k && v!==null && !Object.hasOwn(old.stats,k))old.stats[k]=v;
    });
    old.groups[text(category||'Game Stats')]=asArray(labels).reduce((o,l,i)=>{
      if(stats?.[i]!=null)o[text(l)]=text(stats[i]);return o;
    },{});
    map.set(id,old);
  }
  for(const seasonType of asArray(raw?.seasonTypes)){
    for(const cat of asArray(seasonType.categories)){
      for(const e of asArray(cat.events))add(e.eventId??e.id,e.stats??e.statistics,cat.labels,cat.displayName||cat.name);
    }
  }
  for(const cat of asArray(raw?.categories)){
    for(const e of asArray(cat.events))add(e.eventId??e.id,e.stats??e.statistics,cat.labels,cat.displayName||cat.name);
  }
  for(const e of asArray(raw?.games||raw?.gameLog)){
    if(e.stats && !Array.isArray(e.stats)) {
      const cols=Object.entries(e.stats);
      add(e.eventId||e.id,cols.map(([,v])=>v),cols.map(([k])=>k),'Game Stats');
    } else add(e.eventId||e.id,e.stats,e.labels||raw.labels,'Game Stats');
  }
  // Do not show an event as a statistical row if the feed provided metadata but no stats.
  const rows=[...map.values()].filter(x=>Object.keys(x.stats).length);
  rows.sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0));
  return {season:Number(season),games:rows,labels:[...new Set(rows.flatMap(x=>Object.keys(x.stats)))],count:rows.length};
}
export function normalizeSeasonStats(raw,season){
  const categories=[];
  const candidates=[...asArray(raw?.categories),...asArray(raw?.splits?.categories),...asArray(raw?.stats?.categories)];
  for(const group of candidates){
    const entries={};
    if(Array.isArray(group.stats))for(const item of group.stats){
      const k=key(item.abbreviation||item.name||item.displayName);
      const n=numeric(item.displayValue??item.value);
      if(k&&n!==null)entries[k]=n;
    }
    const labels=asArray(group.labels), totals=asArray(group.totals||group.values);
    labels.forEach((l,i)=>{const k=key(l),n=numeric(totals[i]);if(k&&n!==null)entries[k]=n});
    if(Object.keys(entries).length)categories.push({name:text(group.displayName||group.name||'Statistics'),values:entries});
  }
  return {season:Number(season),categories};
}
export function metricSeries(games,metric){
  const k=key(metric);
  return asArray(games).filter(g=>Number.isFinite(g?.stats?.[k])).map(g=>({id:g.id,date:g.date,value:g.stats[k],opponent:g.opponent,season:g.season}));
}
export function average(games,metric){
  const pts=metricSeries(games,metric);
  return pts.length?pts.reduce((n,p)=>n+p.value,0)/pts.length:null;
}
export function analyzePlayer(player,games,metric){
  const rows=metricSeries(games,metric);
  const name=text(player?.name||'Player'), stat=key(metric);
  if(rows.length<2)return {mode:'statistical',sentences:[],summary:'Not enough recorded games to describe a trend.'};
  const recent=rows.slice(0,Math.min(5,rows.length));
  const previous=rows.slice(recent.length,Math.min(recent.length*2,rows.length));
  const mean=x=>x.reduce((a,b)=>a+b.value,0)/x.length;
  const total=mean(rows), latest=rows[0].value, recentAvg=mean(recent);
  const sentences=[
    name+' averages '+total.toFixed(1)+' '+stat+' across '+rows.length+' available games in this sample.',
    'Most recent recorded game: '+latest+' '+stat+(rows[0].opponent?' against '+rows[0].opponent:'')+'.'
  ];
  if(previous.length){
    const old=mean(previous),delta=recentAvg-old,sign=delta>0?'higher':delta<0?'lower':'unchanged';
    sentences.push('Last '+recent.length+' games: '+recentAvg.toFixed(1)+' '+stat+', '+Math.abs(delta).toFixed(1)+' '+sign+' than the preceding '+previous.length+' recorded games.');
  } else sentences.push('Last '+recent.length+' recorded games: '+recentAvg.toFixed(1)+' '+stat+'.');
  const high=rows.reduce((a,b)=>a.value>=b.value?a:b);
  sentences.push('Best game in this sample: '+high.value+' '+stat+(high.opponent?' vs '+high.opponent:'')+'.');
  return {mode:'statistical',metric:stat,gameCount:rows.length,average:Number(total.toFixed(2)),latest,recentAverage:Number(recentAvg.toFixed(2)),sentences,summary:sentences.join(' ')};
}
// Recursive-descent arithmetic parser. Never use eval or Function on user formulas.
export function calculateFormula(expression, stats){
  const tokens=text(expression).match(/[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|[()+*/-]/g)||[];
  if(!tokens.length || tokens.length>80 || tokens.join('').toUpperCase()!==text(expression).replace(/\s+/g,'').toUpperCase())throw Error('Invalid formula');
  let i=0; const fields=Object.fromEntries(Object.entries(stats||{}).map(([k,v])=>[key(k),numeric(v)]));
  const factor=()=>{
    const t=tokens[i++];if(!t)throw Error('Incomplete formula');
    if(t==='('){const v=expr();if(tokens[i++]!==')')throw Error('Missing closing parenthesis');return v;}
    if(t==='-')return -factor();
    if(/^\d/.test(t))return Number(t);
    const k=key(t);if(!Object.hasOwn(fields,k)||fields[k]===null)throw Error('Unavailable stat: '+t);
    return fields[k];
  };
  const term=()=>{let v=factor();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],right=factor();if(op==='/'&&right===0)throw Error('Division by zero');v=op==='*'?v*right:v/right;}return v};
  const expr=()=>{let v=term();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],right=term();v=op==='+'?v+right:v-right;}return v};
  const val=expr();if(i!==tokens.length||!Number.isFinite(val))throw Error('Invalid formula');
  return Number(val.toFixed(3));
}
export function normalizeESPNPlayerSearch(raw,query,sport){
  const results=[];
  const seen=new Set();
  const visit=(value,depth=0)=>{
    if(depth>5||!value||typeof value!=='object'||results.length>70)return;
    if(Array.isArray(value)){value.forEach(x=>visit(x,depth+1));return}
    const type=text(value.type||value.category||'').toLowerCase();
    const id=text(value.id||value.athlete?.id||value.player?.id);
    const name=text(value.displayName||value.fullName||value.athlete?.displayName||value.player?.displayName||value.title);
    const athleteLike=/athlet|player/.test(type)||Boolean(value.athlete||value.player||value.position||value.headshot);
    const wanted=text(query).toLowerCase();
    if(/^\d{1,14}$/.test(id)&&name.toLowerCase().includes(wanted)&&athleteLike&&!seen.has(id)){
      seen.add(id);results.push({id,name,sport,position:text(value.position?.abbreviation||value.position),team:text(value.team?.displayName||''),headshot:text(value.headshot?.href||value.headshot||'')});
    }
    for(const [k,v] of Object.entries(value)){
      if(['athlete','player','results','contents','items','entries','hits','sports','leagues'].includes(k))visit(v,depth+1);
    }
  };
  visit(raw);
  return results.slice(0,35);
}
