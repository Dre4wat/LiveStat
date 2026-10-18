export function positionGroupForPlayer(player,sport){
  if(player?.group)return String(player.group);
  const p=String(player?.position||'').trim().toUpperCase();
  if(['nfl','cfb'].includes(sport)){
    if(p==='QB')return 'QB';
    if(['RB','HB','FB','TB'].includes(p))return 'RB';
    if(['WR','FL','SE'].includes(p))return 'WR';
    if(p==='TE')return 'TE';
    if(['C','T','G','OG','OT','OL','LS','LT','RT','LG','RG'].includes(p))return 'OL';
    if(['DE','DT','NT','DL','EDGE','ED'].includes(p))return 'DL';
    if(['LB','MLB','OLB','ILB','WLB','SLB'].includes(p))return 'LB';
    if(['CB','NB','DB'].includes(p))return 'CB';
    if(['S','SS','FS','SAF','SAFETY'].includes(p))return 'S';
    if(['K','PK','P','KR','PR','RET'].includes(p))return 'ST';
    return 'OTHER';
  }
  if(['PG','SG','G','CG'].includes(p))return 'G';
  if(['SF','PF','F','GF'].includes(p))return 'F';
  if(['C','FC','CF'].includes(p))return 'C';
  return 'OTHER';
}
const formations={
  "football": [
    [
      "QB",
      "QUARTERBACKS",
      "QB",
      "🎯"
    ],
    [
      "RB",
      "RUNNING BACKS",
      "RB / FB",
      "⚡"
    ],
    [
      "WR",
      "WIDE RECEIVERS",
      "WR",
      "↗"
    ],
    [
      "TE",
      "TIGHT ENDS",
      "TE",
      "◈"
    ],
    [
      "OL",
      "OFFENSIVE LINE",
      "OL",
      "▦"
    ],
    [
      "DL",
      "DEFENSIVE LINE",
      "DL / EDGE",
      "✦"
    ],
    [
      "LB",
      "LINEBACKERS",
      "LB",
      "◆"
    ],
    [
      "CB",
      "CORNERBACKS",
      "CB",
      "◎"
    ],
    [
      "S",
      "SAFETIES",
      "S",
      "⬟"
    ],
    [
      "ST",
      "SPECIAL TEAMS",
      "K / P / RET",
      "★"
    ],
    [
      "OTHER",
      "OTHER PLAYERS",
      "OTHER",
      "⋯"
    ]
  ],
  "basketball": [
    [
      "G",
      "GUARDS",
      "PG / SG",
      "⌁"
    ],
    [
      "F",
      "FORWARDS",
      "SF / PF",
      "↗"
    ],
    [
      "C",
      "CENTERS",
      "C",
      "▣"
    ],
    [
      "OTHER",
      "OTHER PLAYERS",
      "OTHER",
      "⋯"
    ]
  ]
};
export function positionOptions(players,sport){
  const cats=['nfl','cfb'].includes(sport)?formations.football:formations.basketball;
  const counts={};
  for(const p of players||[]){const k=positionGroupForPlayer(p,sport);counts[k]=(counts[k]||0)+1}
  return cats.filter(([id])=>counts[id]).map(([id,title,subtitle,icon])=>({id,title,subtitle,icon,count:counts[id]}));
}
export function filterRoster(players,sport,group,search=''){
  const term=String(search||'').trim().toLocaleLowerCase();
  return (players||[]).filter(p=>{
    const found=!term||(String(p.name||'')+' '+String(p.position||'')+' '+String(p.jersey||'')).toLocaleLowerCase().includes(term);
    return found&&(!group||group==='ALL'||positionGroupForPlayer(p,sport)===group);
  });
}
