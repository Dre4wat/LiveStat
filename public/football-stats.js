// Shared browser / server football stat catalog. Do not infer field availability from a position alone.
export const FOOTBALL_PLAYER_STATS={
  passingAttempts:'Pass attempts',completions:'Completions',passingYards:'Passing yards',
  passingTouchdowns:'Passing TDs',interceptionsThrown:'Interceptions thrown',
  rushingAttempts:'Rush attempts',rushingYards:'Rushing yards',rushingTouchdowns:'Rushing TDs',
  targets:'Targets',receptions:'Receptions',receivingYards:'Receiving yards',
  receivingTouchdowns:'Receiving TDs',fumbles:'Fumbles',
  tackles:'Total tackles',soloTackles:'Solo tackles',assistedTackles:'Assisted tackles',
  sacks:'Sacks',tacklesForLoss:'Tackles for loss',interceptionsCaught:'Interceptions',
  passesDefended:'Passes defended',forcedFumbles:'Forced fumbles',
  fumbleRecoveries:'Fumble recoveries',defensiveTouchdowns:'Defensive TDs',
  fieldGoalsMade:'Field goals made',fieldGoalsAttempted:'Field goals attempted',
  extraPointsMade:'Extra points made',extraPointsAttempted:'Extra points attempted',
  punts:'Punts',puntingYards:'Punting yards',
  kickReturnYards:'Kick return yards',puntReturnYards:'Punt return yards',
  returnTouchdowns:'Return TDs'
};
const passing=['passingAttempts','completions','passingYards','passingTouchdowns','interceptionsThrown'];
const rushing=['rushingAttempts','rushingYards','rushingTouchdowns'];
const receiving=['targets','receptions','receivingYards','receivingTouchdowns'];
const defensive=['tackles','soloTackles','assistedTackles','sacks','tacklesForLoss','interceptionsCaught','passesDefended','forcedFumbles','fumbleRecoveries','defensiveTouchdowns'];
const kicking=['fieldGoalsMade','fieldGoalsAttempted','extraPointsMade','extraPointsAttempted'];
const punting=['punts','puntingYards'];
const returns=['kickReturnYards','puntReturnYards','returnTouchdowns'];
export function footballPositionGroup(position){
  const p=String(position||'').trim().toUpperCase().replace(/[^A-Z]/g,'');
  if(['QB'].includes(p))return 'QB';
  if(['RB','HB','FB','TB'].includes(p))return 'RB';
  if(['WR','TE','FL','SE'].includes(p))return 'REC';
  if(['DE','DT','NT','DL','EDGE','ED','LB','MLB','OLB','ILB','CB','DB','FS','SS','S','SAF','NB'].includes(p))return 'DEF';
  if(['K','PK'].includes(p))return 'K';
  if(['P'].includes(p))return 'P';
  if(['KR','PR','RET'].includes(p))return 'RET';
  if(['OT','OG','C','G','T','OL','LS'].includes(p))return 'OL';
  return 'OTHER';
}
export function footballStatsForPosition(position){
  const group=footballPositionGroup(position);
  const lists={
    QB:[...passing,...rushing,'fumbles'],
    RB:[...rushing,...receiving,'fumbles',...returns],
    REC:[...receiving,...rushing,'fumbles',...returns],
    DEF:defensive,
    K:kicking,
    P:punting,
    RET:[...returns,...receiving,...rushing,'fumbles'],
    OL:['fumbles'],OTHER:[...passing,...rushing,...receiving,'fumbles',...defensive,...kicking,...punting,...returns]
  };
  return [...new Set(lists[group])];
}
export const FOOTBALL_STAT_GROUPS={
  Passing:passing,Rushing:rushing,Receiving:receiving,Defense:defensive,
  Kicking:kicking,Punting:punting,Returns:returns
};
