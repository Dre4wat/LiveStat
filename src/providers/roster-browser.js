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
    points:'PTS',rebounds:'REB',assists:'AST'
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
