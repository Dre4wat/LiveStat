export function positionGroup(position,sport){
  const p=String(position||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(['nfl','cfb'].includes(sport)){
    const groups={
      QB:['QB'],RB:['RB','HB','FB','TB'],WR:['WR','FL','SE'],TE:['TE'],
      OL:['OT','OG','OL','G','T','C','LT','RT','LG','RG','LS'],
      DL:['DE','DT','NT','DL','EDGE','ED'],LB:['LB','MLB','OLB','ILB','WLB','SLB'],
      CB:['CB','NB','DB'],S:['S','FS','SS','SAF','SAFETY'],
      ST:['K','PK','P','KR','PR','RET']
    };
    return Object.keys(groups).find(x=>groups[x].includes(p))||'OTHER';
  }
  if(['PG','SG','G','CG'].includes(p))return 'G';
  if(['SF','PF','F','GF'].includes(p))return 'F';
  if(['C','FC','C/F','CF'].includes(p))return 'C';
  return 'OTHER';
}
const groups={
  "nfl": [
    [
      "QB",
      "Quarterbacks",
      "QB"
    ],
    [
      "RB",
      "Running Backs",
      "RB / FB"
    ],
    [
      "WR",
      "Wide Receivers",
      "WR"
    ],
    [
      "TE",
      "Tight Ends",
      "TE"
    ],
    [
      "OL",
      "Offensive Line",
      "OL"
    ],
    [
      "DL",
      "Defensive Line",
      "DL / EDGE"
    ],
    [
      "LB",
      "Linebackers",
      "LB"
    ],
    [
      "CB",
      "Cornerbacks",
      "CB"
    ],
    [
      "S",
      "Safeties",
      "S"
    ],
    [
      "ST",
      "Special Teams",
      "K / P / RET"
    ],
    [
      "OTHER",
      "Other Players",
      "OTHER"
    ]
  ],
  "nba": [
    [
      "G",
      "Guards",
      "PG / SG"
    ],
    [
      "F",
      "Forwards",
      "SF / PF"
    ],
    [
      "C",
      "Centers",
      "C"
    ],
    [
      "OTHER",
      "Other Players",
      "OTHER"
    ]
  ]
};
export function rosterGroups(sport){
  return (['nfl','cfb'].includes(sport)?groups.nfl:groups.nba).map(([id,name,short])=>({id,name,short}));
}
export function sortRosterPlayers(players){
  return [...players].sort((a,b)=>{
    const rank=x=>Number.isInteger(x.depthRank)&&x.depthRank>0?x.depthRank:Infinity;
    const aDepth=rank(a),bDepth=rank(b);
    if(aDepth!==bDepth)return aDepth-bDepth;
    const leader=x=>Number.isInteger(x.leaderRank)&&x.leaderRank>0?x.leaderRank:Infinity;
    const aLeader=leader(a),bLeader=leader(b);
    if(aLeader!==bLeader)return aLeader-bLeader;
    if(Boolean(a.starter)!==Boolean(b.starter))return a.starter?-1:1;
    const score=x=>Number.isFinite(x.gameScore)&&x.gameScore>0?x.gameScore:-1;
    const aScore=score(a),bScore=score(b);
    if(aScore!==bScore)return bScore-aScore;
    return String(a.name||'').localeCompare(String(b.name||''));
  });
}
export function enrichRoster(players,sport,{depthCharts,leaders,boxScore}={}){
  const depthMap=new Map(),leaderMap=new Map(),gameMap=new Map();
  const ranking=(entry,i)=> {
    const value=entry?.rank??entry?.depth??entry?.depthRank;
    const v=Number(value);return Number.isInteger(v)&&v>0?v:i+1;
  };
  const putDepth=(id,rank)=>{
    if(!id||!rank)return;
    const k=String(id),old=depthMap.get(k);
    if(old==null||rank<old)depthMap.set(k,rank);
  };
  const depth=depthCharts||{};
  const charts=[...(Array.isArray(depth.depthCharts)?depth.depthCharts:[]),
    ...(Array.isArray(depth.depthcharts)?depth.depthcharts:[]),
    ...(Array.isArray(depth.depthchart)?depth.depthchart:[depth.depthchart].filter(Boolean))];
  if(depth.positions)charts.push({positions:depth.positions});
  for(const chart of charts){
    const positions=chart?.positions||chart?.depthchart?.positions||{};
    const entries=Array.isArray(positions)?positions:Object.values(positions);
    for(const entry of entries){
      const list=Array.isArray(entry)?entry:entry?.athletes||entry?.players||[];
      if(!Array.isArray(list))continue;
      list.forEach((p,i)=>putDepth(p?.athlete?.id||p?.player?.id||p?.id,ranking(p,i)));
    }
  }
  const leaderSections=leaders?.leaders||leaders?.categories||[];
  for(const section of Array.isArray(leaderSections)?leaderSections:[]){
    const people=section?.leaders||section?.athletes||section?.entries||[];
    if(!Array.isArray(people))continue;
    people.forEach((entry,i)=>{
      const id=entry?.athlete?.id||entry?.player?.id||entry?.id;
      if(!id)return;
      const k=String(id),rank=ranking(entry,i),old=leaderMap.get(k);
      if(old==null||rank<old)leaderMap.set(k,rank);
    });
  }
  for(const group of boxScore?.groups||[]){
    for(const section of group.sections||[]){
      for(const row of section.rows||[]){
        const id=String(row.id||'');if(!id)continue;
        const labels=section.labels||[],stats=row.stats||[];
        const sectionName=String(section.name||'').toLowerCase();
        let score=0;
        const metrics=['PTS','MIN','YDS','CAR','REC','TACK','TOT','SACKS','AST','REB','TD'];
        for(let i=0;i<labels.length;i++){
          if(!metrics.includes(String(labels[i]).toUpperCase()))continue;
          const n=Number(stats[i]);if(!Number.isFinite(n)||n<0)continue;
          const weight=(String(labels[i]).toUpperCase()==='MIN'?0.2:1);
          score+=n*weight;
        }
        // Only use measurable values from ESPN's actual box score.
        const old=gameMap.get(id)||{score:0,starter:false};
        gameMap.set(id,{score:Math.max(old.score,score),starter:old.starter||row.starter===true});
      }
    }
  }
  return sortRosterPlayers(players.map(p=>{
    const id=String(p.id||''),d=depthMap.get(id),l=leaderMap.get(id),g=gameMap.get(id);
    return {...p,group:positionGroup(p.position,sport),depthRank:d??null,leaderRank:l??null,
      starter:Boolean(g?.starter),gameScore:g?.score||0,
      rankingSource:d?'depth':l?'leader':g?.starter?'starter':(g?.score>0?'game':'alphabetical')};
  }));
}
