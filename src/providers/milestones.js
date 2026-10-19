// Milestone badges are derived only from real historical game stats.
// 'Sample best' never means an all-time or career record.
const stat= (game,key)=>{const n=Number(game?.stats?.[key]);return Number.isFinite(n)&&game?.stats?.[key]!=null?n:null};
const fmt=x=>String(x).replace(/\B(?=(\d{3})+(?!\d))/g,',');
export const MILESTONE_TYPES={
  nba:[
    {type:'forty-point',name:'40-POINT PERFORMANCE',key:'PTS',min:40},
    {type:'thirty-point',name:'30-POINT PERFORMANCE',key:'PTS',min:30},
    {type:'twenty-rebound',name:'20-REBOUND GAME',key:'REB',min:20},
    {type:'fifteen-assist',name:'15-ASSIST GAME',key:'AST',min:15},
    {type:'five-steal',name:'5-STEAL DEFENSE',key:'STL',min:5},
    {type:'five-block',name:'5-BLOCK DEFENSE',key:'BLK',min:5}
  ],
  football:[
    {type:'three-hundred-pass',name:'300-YARD PASSING GAME',key:'PASSYDS',min:300},
    {type:'hundred-rush',name:'100-YARD RUSHING GAME',key:'RUSHYDS',min:100},
    {type:'hundred-receive',name:'100-YARD RECEIVING GAME',key:'RECYDS',min:100},
    {type:'four-pass-td',name:'4 PASSING TOUCHDOWNS',key:'PASSTD',min:4},
    {type:'two-sack',name:'2-SACK DEFENSIVE GAME',key:'DEFSACKS',min:2},
    {type:'two-interception',name:'2-INTERCEPTION DEFENSE',key:'DEFINT',min:2},
    {type:'ten-tackle',name:'10-TACKLE DEFENSE',key:'DEFTOT',min:10}
  ]
};
export function detectPlayerMilestones(sport,games,{limit=90}={}){
  const rules=['nba','ncaam','ncaaw'].includes(sport)?MILESTONE_TYPES.nba:MILESTONE_TYPES.football;
  const out=[],seen=new Set();
  for(const game of Array.isArray(games)?games:[]){
    if(!game?.id||!game.stats)continue;
    const record=(type,name,metric,value)=>{
      const id=String(game.id)+':'+type;if(seen.has(id))return;seen.add(id);
      out.push({id,gameId:String(game.id),date:game.date||'',opponent:game.opponent||'',type,
        name,metric,value,gameStats:game.stats,source:'ESPN game log',verified:true});
    };
    for(const r of rules){const n=stat(game,r.key);if(n!==null&&n>=r.min)record(r.type,r.name,r.key,n);}
    if(['nba','ncaam','ncaaw'].includes(sport)){
      const double=['PTS','REB','AST','STL','BLK'].filter(k=>(stat(game,k)??0)>=10);
      if(double.length>=3)record('triple-double','TRIPLE-DOUBLE','TRIPLE',double.length);
      else if(double.length>=2)record('double-double','DOUBLE-DOUBLE','DOUBLE',double.length);
    }
    if(out.length>=limit)break;
  }
  return out.slice(0,limit);
}
export function detectMissionHighlights(games,rules,{limit=35}={}){
  const normalized=Object.entries(rules||{}).filter(([,r])=>Number.isFinite(Number(r?.target))&&Number(r.target)>0);
  if(!normalized.length)return [];
  const mapping={
    points:['PTS'],rebounds:['REB'],assists:['AST'],steals:['STL'],blocks:['BLK'],
    receptions:['REC'],targets:['TGTS','TGT'],
    passingYards:['PASSYDS'],passingTouchdowns:['PASSTD'],rushingYards:['RUSHYDS'],
    rushingTouchdowns:['RUSHTD'],receivingYards:['RECYDS'],receivingTouchdowns:['RECTD'],
    tackles:['DEFTOT','DEFTACK','TOT'],sacks:['DEFSACKS'],interceptionsCaught:['DEFINT']
  };
  const output=[];
  for(const game of games||[]){
    const goals=normalized.map(([key,rule])=>{
      const aliases=mapping[key]||[key.toUpperCase()];
      const found=aliases.map(k=>({metric:k,value:stat(game,k)})).find(x=>x.value!=null);
      return {name:key,value:found?.value??null,target:Number(rule.target),met:found?.value!=null&&found.value>=Number(rule.target)};
    });
    if(!goals.some(g=>g.met))continue;
    output.push({id:String(game.id)+':mission',gameId:String(game.id),date:game.date||'',opponent:game.opponent||'',
      type:'mission',name:goals.every(g=>g.met)?'MISSION COMPLETE':'MISSION PROGRESS',
      goals,complete:goals.every(g=>g.met),gameStats:game.stats,source:'ESPN game log'});
    if(output.length>=limit)break;
  }
  return output;
}
export function milestoneCardStats(milestone,sport){
  const preferred=['nba','ncaam','ncaaw'].includes(sport)
    ? ['PTS','REB','AST','STL','BLK','3PM']
    : ['PASSYDS','PASSTD','RUSHYDS','RUSHTD','RECYDS','REC','DEFTOT','DEFSACKS','DEFINT'];
  return preferred.filter(k=>stat({stats:milestone?.gameStats},k)!=null).slice(0,4)
    .map(k=>({label:k,value:stat({stats:milestone.gameStats},k)}));
}
