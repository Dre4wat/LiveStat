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

export function analyzeGameData(insights,box){
  const observations=[],evidence=[];
  const teams=asArray(insights?.teams);
  const home=teams.find(t=>t.side==='home')||teams[1]||{};
  const away=teams.find(t=>t.side==='away')||teams[0]||{};
  const homeName=text(home.abbr||home.name||'Home'),awayName=text(away.abbr||away.name||'Away');
  const periodRows=asArray(insights?.periods).filter(p=>Number.isFinite(p.home)&&Number.isFinite(p.away));
  const formatPeriod=p=>Number(p)>4?'OT '+(p-4):'Q'+p;
  if(periodRows.length){
    const best=periodRows.reduce((a,b)=>Math.abs(b.home-b.away)>Math.abs(a.home-a.away)?b:a);
    const dominant=best.home>best.away?homeName:best.home<best.away?awayName:'Neither team';
    if(best.home!==best.away)observations.push(dominant+' had the largest single-period scoring advantage in '+formatPeriod(best.period)+': '+Math.max(best.home,best.away)+'–'+Math.min(best.home,best.away)+'.');
    evidence.push({source:'Play-by-play score changes',detail:'Quarter-by-quarter scores derived from supplied scoring events'});
    const last=periodRows.at(-1),prior=periodRows.at(-2);
    if(prior&&last&&last.period!==prior.period){
      const homeDelta=last.home-prior.home,awayDelta=last.away-prior.away;
      const who=homeDelta>awayDelta?homeName:awayDelta>homeDelta?awayName:null;
      if(who)observations.push(who+' scored '+Math.abs(homeDelta-awayDelta)+' more point'+(Math.abs(homeDelta-awayDelta)===1?'':'s')+' in '+formatPeriod(last.period)+' than in the preceding period (relative scoring change).');
    }
  }
  const m=insights?.momentumSummary||{};
  if(Number.isInteger(m.leadChanges)&&m.leadChanges>0){
    observations.push('The lead changed '+m.leadChanges+' time'+(m.leadChanges===1?'':'s')+' in the recorded scoring sequence.');
    evidence.push({source:'Play-by-play scores',detail:'Leader changes exclude tied score states'});
  }
  if(Number.isFinite(m.biggestHomeLead)&&m.biggestHomeLead>0)observations.push(homeName+' led by as many as '+m.biggestHomeLead+' points.');
  if(Number.isFinite(m.biggestAwayLead)&&m.biggestAwayLead>0)observations.push(awayName+' led by as many as '+m.biggestAwayLead+' points.');
  const boxes=asArray(box?.teams);
  for(const t of boxes){
    const name=text(t.abbr||t.name||'Team');
    const third=asArray(t.stats).find(x=>/third.?down|3rd.?down/i.test(text(x.name)+' '+text(x.label)));
    if(third&&third.value){
      observations.push(name+' third-down efficiency: '+text(third.value)+' (ESPN team box score).');
      evidence.push({source:'Team box score',detail:name+' '+text(third.label||third.name)});
    }
  }
  if(['nba','ncaam','ncaaw'].includes(insights?.sport)){
    const leaders=[];
    for(const g of asArray(box?.groups)){
      for(const section of asArray(g.sections)){
        const index=asArray(section.labels).findIndex(k=>text(k).toUpperCase()==='PTS');
        if(index<0)continue;
        for(const p of asArray(section.rows)){
          const value=numeric(p.stats?.[index]);
          if(value!=null)leaders.push({name:p.name,points:value});
        }
      }
    }
    leaders.sort((a,b)=>b.points-a.points);
    if(leaders.length){
      observations.push('Top recorded scorer in the available box score: '+leaders[0].name+' with '+leaders[0].points+' points.');
      evidence.push({source:'Player box score',detail:'PTS column'});
    }
  }
  if(!observations.length)return {mode:'statistical',summary:'There are not enough verified plays or box-score statistics to describe this game yet.',observations:[],evidence:[]};
  return {mode:'statistical',summary:observations.slice(0,7).join(' '),observations:observations.slice(0,7),evidence:evidence.slice(0,7)};
}
