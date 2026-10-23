// Gamepoint-style roster data for five LiveStat ESPN leagues.
// Only stats from recorded ESPN game logs are shown. Unknowns remain null.
export const ROSTER_COLUMNS={
  basketball:[
    {key:'PTS',label:'PTS'},{key:'REB',label:'REB'},{key:'AST',label:'AST'},
    {key:'STL',label:'STL'},{key:'BLK',label:'BLK'},{key:'3PM',label:'3PM'},
    {key:'MIN',label:'MIN'},{key:'GP',label:'G'}
  ],
  football:[
    {key:'PASSYDS',label:'PASS YDS'},{key:'PASSTD',label:'PASS TD'},
    {key:'RUSHYDS',label:'RUSH YDS'},{key:'RUSHTD',label:'RUSH TD'},
    {key:'REC',label:'REC'},{key:'RECYDS',label:'REC YDS'},
    {key:'RECTD',label:'REC TD'},{key:'DEFTOT',label:'TACK'},
    {key:'DEFSACKS',label:'SACK'},{key:'DEFINT',label:'INT'}
  ]
};
export const ROSTER_FOOTBALL_GROUP_COLUMNS={
  QB:['PASSYDS','PASSTD','PASSINT','CMP','RUSHYDS','RUSHTD'],
  RB:['RUSHYDS','RUSHTD','CAR','REC','RECYDS','RECTD'],
  WR:['REC','RECYDS','RECTD','TGTS','YPR','RUSHYDS'],
  TE:['REC','RECYDS','RECTD','TGTS','YPR'],
  OL:['GP'],
  DL:['DEFTOT','DEFSACKS','DEFINT'],
  LB:['DEFTOT','DEFSACKS','DEFINT'],
  CB:['DEFTOT','DEFINT','DEFSACKS'],
  S:['DEFTOT','DEFINT','DEFSACKS'],
  ST:['FGM','FGA','XPM','XPA','PUNTYDS'],
  OTHER:['GP','PASSYDS','RUSHYDS','RECYDS']
};
export const ROSTER_LABELS={
  ...Object.fromEntries([...ROSTER_COLUMNS.basketball,...ROSTER_COLUMNS.football].map(x=>[x.key,x.label])),
  PASSINT:'PASS INT',CMP:'CMP',CAR:'CAR',TGTS:'TARGETS',YPR:'Y/REC',FGM:'FGM',FGA:'FGA',
  XPM:'XPM',XPA:'XPA',PUNTYDS:'PUNT YDS',GP:'G',TOV:'TOV',FGP:'FG%',TPP:'3P%',FTP:'FT%'
};
export const isFootball=sport=>sport==='nfl'||sport==='cfb';
export function rosterColumns(sport,group='ALL'){
  if(!isFootball(sport))return ROSTER_COLUMNS.basketball.map(x=>x.key);
  return group!=='ALL'&&ROSTER_FOOTBALL_GROUP_COLUMNS[group]
    ?ROSTER_FOOTBALL_GROUP_COLUMNS[group]:ROSTER_COLUMNS.football.map(x=>x.key);
}
function toNumber(x){
  if(x===null||x===undefined||x==='')return null;
  const n=Number(x);return Number.isFinite(n)?n:null;
}
const unique=(...candidates)=>candidates.find(x=>x!==null&&x!==undefined)||null;
export function rosterSeasonSummary(sport,games){
  const list=Array.isArray(games)?games:[];
  const metrics=Object.create(null),counts=Object.create(null);
  const aliases={
    passingYards:'PASSYDS',passingTouchdowns:'PASSTD',rushingYards:'RUSHYDS',
    rushingTouchdowns:'RUSHTD',receivingYards:'RECYDS',receivingTouchdowns:'RECTD',
    interceptionsThrown:'PASSINT',interceptionsCaught:'DEFINT',
    receptions:'REC',tackles:'DEFTOT',sacks:'DEFSACKS',
    points:'PTS',rebounds:'REB',assists:'AST',TO:'TOV',TRB:'REB',rebound:'REB','3PT':'3PM','3P':'3PM'
  };
  for(const game of list){
    if(!game?.stats)continue;
    const already=new Set();
    for(const [raw,value] of Object.entries(game.stats)){
      const key=(aliases[raw]||raw).toUpperCase();
      const number=toNumber(value);
      if(number===null||already.has(key))continue;
      already.add(key);metrics[key]=(metrics[key]||0)+number;counts[key]=(counts[key]||0)+1;
    }
  }
  const totals={GP:list.length},averages={GP:list.length};
  for(const [key,total] of Object.entries(metrics)){
    totals[key]=Number(total.toFixed(2));
    averages[key]=counts[key]?Number((total/counts[key]).toFixed(2)):null;
  }
  // Shooting rate is makes / attempts across games, NOT the simple average
  // of individual game percentages (which would overweight low-volume games).
  for(const [made,attempted,label] of [
    ['FGM','FGA','FG%'],['3PM','3PA','3P%'],['FTM','FTA','FT%']
  ]){
    if(metrics[attempted]>0)averages[label]=Number((100*metrics[made]/metrics[attempted]).toFixed(1));
  }
  if(metrics.ATT>0&&metrics.CMP!=null)
    averages['CMP%']=Number((100*metrics.CMP/metrics.ATT).toFixed(1));
  // Collision-prone YDS/TD without a position group is not safely assignable.
  // We only show scoped PASSYDS, RUSHYDS, RECYDS or defensive columns.
  const output=isFootball(sport)?totals:averages;
  return {games:list.length,totals,averages,values:output,source:list.length?'ESPN recorded game logs':'unavailable',
    sample:true,note:'Includes only games returned by ESPN'};
}
export function rosterColumnValue(summary,sport,key,mode){
  if(!summary)return null;
  const table=mode==='average'?summary.averages:mode==='total'?summary.totals:summary.values;
  return toNumber(table?.[key])??(key==='GP'?toNumber(summary.games):null);
}
export function rosterSort(players,sortKey,statistics,sport,mode='auto'){
  const m=mode==='auto'?(isFootball(sport)?'total':'average'):mode;
  return [...players].sort((a,b)=>{
    const value=id=>rosterColumnValue(statistics?.[String(id)],sport,sortKey,m);
    const av=value(a.id),bv=value(b.id);
    if(av!==null||bv!==null){
      if(av===null)return 1;if(bv===null)return -1;
      if(av!==bv)return bv-av;
    }
    const d=x=>Number.isInteger(x.depthRank)&&x.depthRank>0?x.depthRank:Infinity;
    if(d(a)!==d(b))return d(a)-d(b);
    if(Number.isInteger(a.leaderRank)||Number.isInteger(b.leaderRank)){
      const la=a.leaderRank??Infinity,lb=b.leaderRank??Infinity;if(la!==lb)return la-lb;
    }
    return String(a.name||'').localeCompare(String(b.name||''));
  });
}


const standardizeKey=(label,category,sport)=>{
 const raw=String(label||'').trim().toUpperCase().replace(/[^A-Z0-9%]/g,'');
 const group=String(category||'').toLowerCase();
 const replacements={'3PT':'3PM','3P':'3PM','3PM':'3PM','3PA':'3PA','TRB':'REB',
   'TACK':'DEFTOT','TACKLES':'DEFTOT','TOT':'DEFTOT','SACK':'DEFSACKS',
   'SACKS':'DEFSACKS','INTS':'INT','INT':'INT','YARDS':'YDS',
   'PASSINGYARDS':'PASSYDS','RUSHINGYARDS':'RUSHYDS','RECEIVINGYARDS':'RECYDS',
   'PASYDS':'PASSYDS','PASSTD':'PASSTD','RUSHTD':'RUSHTD',
   'REC':'REC','RECEPTIONS':'REC','G':'GP','GAMESPLAYED':'GP',
   'POINTS':'PTS','REBOUNDS':'REB','ASSISTS':'AST','STEALS':'STL','BLOCKS':'BLK','TO':'TOV','TURNOVERS':'TOV'};
 const k=replacements[raw]||raw;
 if(!isFootball(sport))return k;
 if(['GP','GS','G'].includes(k))return 'GP';
 const prefix=/pass/.test(group)?'PASS':/rush/.test(group)?'RUSH':
   /receiv/.test(group)?'REC':/defen|tackling/.test(group)?'DEF':
   /kick/.test(group)?'KICK':/punt/.test(group)?'PUNT':'';
 if(prefix){
   if(['YDS','TD','INT','ATT','CMP','CAR','TOT','SACKS','SACK','TGTS','REC'].includes(raw)||['YDS','TD','INT','TOT'].includes(k)){
     if(prefix==='DEF'&&['TOT','TACK','TACKLES'].includes(raw))return 'DEFTOT';
     if(prefix==='DEF'&&['INT','INTS'].includes(raw))return 'DEFINT';
     if(prefix==='DEF'&&['SACK','SACKS'].includes(raw))return 'DEFSACKS';
     if(prefix==='PASS'&&raw==='INT')return 'PASSINT';
     if(prefix==='REC'&&['REC','RECEPTIONS'].includes(raw))return 'REC';
     if(prefix==='REC'&&raw==='TGTS')return 'TGTS';
     if(prefix==='RUSH'&&raw==='CAR')return 'CAR';
     if(prefix==='PASS'&&['ATT','CMP'].includes(raw))return raw;
     return prefix+(raw==='SACK'?'SACKS':raw==='INTS'?'INT':raw);
   }
 }
 // Ambiguous YDS, TD and INT values are not assigned to a football unit
 // unless their ESPN category actually identifies the passing/rushing section.
 return ['YDS','TD','INT'].includes(raw)?null:k;
};
const statNumber=x=>{
 if(typeof x==='number')return Number.isFinite(x)?x:null;
 if(x===null||x===undefined)return null;
 const a=String(x).trim().replace(/,/g,'');
 return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(a)?Number(a):null;
};
function parseCategories(raw){
 return [...(Array.isArray(raw?.categories)?raw.categories:[]),
   ...(Array.isArray(raw?.splits?.categories)?raw.splits.categories:[]),
   ...(Array.isArray(raw?.stats?.categories)?raw.stats.categories:[])];
}
export function rosterSeasonFromStats(sport,raw){
 const totals={},averages={},known=new Set();
 const cats=parseCategories(raw);
 for(const section of cats){
   const category=section.name||section.displayName||'';
   const pairs=Array.isArray(section.stats)?
     section.stats.map(item=>[item.abbreviation||item.name||item.displayName,item.displayValue??item.value]):
     (section.labels||[]).map((label,i)=>[label,(section.totals||section.values||[])[i]]);
   for(const [label,value] of pairs){
     const key=standardizeKey(label,category,sport),n=statNumber(value);
     if(!key||n===null)continue;
     if(known.has(key))continue;
     known.add(key);
     if(isFootball(sport))totals[key]=n;
     else averages[key]=n;
   }
 }
 const games=statNumber(totals.GP??averages.GP)||null;
 if(games&&isFootball(sport))for(const [key,total] of Object.entries(totals))averages[key]=Number((total/games).toFixed(2));
 // ESPN basketball /stats labels regularly report per-game values in "totals".
 // Never assert they're season totals when that isn't specified.
 if(games&&!isFootball(sport))for(const [key,avg] of Object.entries(averages)){
   if(!['GP','GS'].includes(key))totals[key]=Number((avg*games).toFixed(2));
 }
 return {games,totals,averages,
   values:isFootball(sport)?totals:averages,
   source:known.size?'ESPN season aggregate':'unavailable',
   sample:false,availableFields:known.size,
   note:known.size?'ESPN season statistics; game logs fill only missing fields':'ESPN did not return season statistics'};
}
export function mergeRosterStats(sport,seasonData,gamelogData){
 const official=seasonData||rosterSeasonFromStats(sport,{});
 const detail=gamelogData||rosterSeasonSummary(sport,[]);
 const totals={...detail.totals,...official.totals},averages={...detail.averages,...official.averages};
 const games=official.games||detail.games||null;
 return {games,totals,averages,values:isFootball(sport)?totals:averages,
   source:official.availableFields?'ESPN season aggregate + game logs':detail.source,
   officialFields:official.availableFields||0,
   sample:!official.availableFields,
   note:official.availableFields?
     'Official ESPN season aggregate when available; other statistics from recorded games':
     'Available ESPN game-log sample; not necessarily all games'};
}
