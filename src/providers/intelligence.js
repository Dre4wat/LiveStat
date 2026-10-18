// ESPN is unofficial; normalize only fields actually supplied. Never manufacture live data.
const arr = x => Array.isArray(x) ? x : [];
const txt = x => x == null ? '' : String(x);
const number = x => x == null || x === '' ? null : (Number.isFinite(Number(x)) ? Number(x) : null);
const label = x => typeof x === 'object' ? txt(x?.displayValue ?? x?.value ?? x?.text) : txt(x);
export function normalizeIntelligence(sport,gameId,raw){
  const d = raw || {}, c = d.header?.competitions?.[0] || {};
  const teams = arr(c.competitors).map(t=>({id:txt(t.team?.id),abbr:txt(t.team?.abbreviation),name:txt(t.team?.displayName),score:txt(t.score?.displayValue ?? t.score ?? ''),side:txt(t.homeAway)}));
  const away = teams.find(t=>t.side==='away') || teams[0] || {};
  const home = teams.find(t=>t.side==='home') || teams[1] || {};
  const football = sport==='nfl' || sport==='cfb';
  const rawDrives = football?[...arr(d.drives?.previous),...(d.drives?.current?[d.drives.current]:[])]:[];
  const rawPlays = football?rawDrives.flatMap(x=>arr(x.plays)):arr(d.plays);
  const seen = new Set();
  const plays = rawPlays.map((p,i)=>{
    const rawId = txt(p.id||p.sequenceNumber||p.sequence||i);
    const coords = p.coordinate || p.coordinates || {};
    const x = number(coords.x ?? p.coordinateX ?? p.coordinate_x);
    const y = number(coords.y ?? p.coordinateY ?? p.coordinate_y);
    const scoreValue = number(p.scoreValue) || 0;
    return {
      id:rawId,index:i,period:number(p.period?.number ?? p.period)||0,clock:label(p.clock),
      text:txt(p.text||p.shortText),type:txt(p.type?.text||p.type?.name||p.type?.abbreviation),
      teamId:txt(p.team?.id),homeScore:number(p.homeScore),awayScore:number(p.awayScore),
      scoring:Boolean(p.scoringPlay||scoreValue>0),scoreValue,
      shooting:Boolean(p.shootingPlay),coordinate:x!=null&&y!=null?{x,y}:null,
      made:/\b(makes|made|good)\b/i.test(txt(p.text))&&!/\bmiss/i.test(txt(p.text))
    };
  }).filter(p=>{if(seen.has(p.id))return false;seen.add(p.id);return true;});
  const scoring = plays.filter(p=>p.scoring || (p.homeScore!=null&&p.awayScore!=null&&(p.scoreValue>0)));
  const periods = new Map(),momentum = [];
  let prevHome=0,prevAway=0,leadChanges=0,previousLeader='',biggest={home:0,away:0};
  for(const p of plays){
    const homeScore=p.homeScore,awayScore=p.awayScore;
    if(homeScore==null||awayScore==null)continue;
    const homeGain=Math.max(0,homeScore-prevHome),awayGain=Math.max(0,awayScore-prevAway);
    const period=p.period||1;
    if(!periods.has(period))periods.set(period,{period,home:0,away:0});
    const rec=periods.get(period);rec.home+=homeGain;rec.away+=awayGain;
    prevHome=homeScore;prevAway=awayScore;
    const diff=homeScore-awayScore,leader=diff>0?'home':diff<0?'away':'tie';
    if(leader!=='tie'){if(previousLeader&&previousLeader!==leader)leadChanges++;previousLeader=leader;}
    biggest.home=Math.max(biggest.home,diff);biggest.away=Math.max(biggest.away,-diff);
    if(homeGain||awayGain||!momentum.length)momentum.push({index:p.index,period:p.period,clock:p.clock,homeScore,awayScore,margin:diff});
  }
  const probabilities=arr(d.winprobability).map(p=>({playId:txt(p.playId),home:number(p.homeWinPercentage),tie:number(p.tiePercentage)}))
    .filter(p=>p.home!=null&&p.home>=0&&p.home<=1);
  const shots=plays.filter(p=>p.coordinate&&(p.shooting||/\b(shot|jumper|layup|dunk|hook|three point|3-pt)\b/i.test(p.text)))
    .map(p=>({...p,made:p.made || Boolean(p.scoreValue)}));
  const drives=rawDrives.map((drive,i)=>{
    const pp=arr(drive.plays);
    const first=pp[0] || {}, last=pp.at(-1)||{};
    return {id:txt(drive.id||i),teamId:txt(drive.team?.id),count:pp.length,
      start:txt(drive.start?.text || drive.start?.yardLine || first.start?.yardLine || ''),
      yardage:number(drive.yards ?? drive.yardsGained),time:txt(drive.timeElapsed?.displayValue || ''),
      result:txt(drive.displayResult || drive.result || last.text || ''),
      startClock:label(first.clock),endClock:label(last.clock),
      plays:pp.map(p=>txt(p.text||p.shortText)).filter(Boolean)};
  });
  return {
    sport,gameId:txt(gameId),status:txt(c.status?.type?.detail||d.header?.status?.type?.detail),state:txt(c.status?.type?.state),
    teams,homeId:home.id||'',awayId:away.id||'',plays,scoring,periods:[...periods.values()],
    momentum,momentumSummary:{leadChanges,biggestHomeLead:biggest.home,biggestAwayLead:biggest.away},
    probabilities,shots,drives,leaders:arr(d.leaders).map(x=>({name:txt(x.name||x.displayName),leaders:arr(x.leaders).slice(0,8)})),
    injuries:arr(d.injuries).map(x=>({team:txt(x.team?.displayName),players:arr(x.injuries).map(y=>({name:txt(y.athlete?.displayName),status:txt(y.status)}))})),
    provider:'ESPN unofficial'
  };
}
export function extractBoxTotals(box,watch){
  if(!box||!watch)return {};
  const result={};
  const football=watch.sport==='nfl'||watch.sport==='cfb';
  const normalize=x=>String(x||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const n=x=>x==null||String(x).trim()===''?null:(Number.isFinite(Number(x))?Number(x):null);
  const labelsBB={'PTS':'points','REB':'rebounds','AST':'assists','STL':'steals','BLK':'blocks','TO':'turnovers','3PM':'threePointers','3PT':'threePointers'};
  const byRole={
    PASSING:{ATT:'passingAttempts',CMP:'completions',COMP:'completions',COMPLETIONS:'completions',YDS:'passingYards',YARD:'passingYards',YARDS:'passingYards',TD:'passingTouchdowns',TDS:'passingTouchdowns',INT:'interceptionsThrown',INTS:'interceptionsThrown'},
    RUSHING:{CAR:'rushingAttempts',ATT:'rushingAttempts',RUSH:'rushingAttempts',YDS:'rushingYards',YARDS:'rushingYards',TD:'rushingTouchdowns',TDS:'rushingTouchdowns'},
    RECEIVING:{REC:'receptions',RECS:'receptions',TGT:'targets',TGTS:'targets',TARGETS:'targets',YDS:'receivingYards',YARDS:'receivingYards',TD:'receivingTouchdowns',TDS:'receivingTouchdowns'},
    DEFENSE:{TOT:'tackles',TOTAL:'tackles',TACK:'tackles',TACKLES:'tackles',COMB:'tackles',SOLO:'soloTackles',AST:'assistedTackles',ASSIST:'assistedTackles',ASSISTS:'assistedTackles',SACK:'sacks',SACKS:'sacks',TFL:'tacklesForLoss',INT:'interceptionsCaught',INTS:'interceptionsCaught',PD:'passesDefended',PDEF:'passesDefended',PBU:'passesDefended',FF:'forcedFumbles',FR:'fumbleRecoveries',TD:'defensiveTouchdowns'},
    INTERCEPTIONS:{INT:'interceptionsCaught',INTS:'interceptionsCaught',TD:'defensiveTouchdowns',TDS:'defensiveTouchdowns'},
    FUMBLES:{FUM:'fumbles',FUMBLES:'fumbles',FF:'forcedFumbles',FR:'fumbleRecoveries'},
    KICKING:{FGM:'fieldGoalsMade',FGA:'fieldGoalsAttempted',XPM:'extraPointsMade',XPA:'extraPointsAttempted',XP:'extraPointsMade'},
    PUNTING:{NO:'punts',PUNTS:'punts',YDS:'puntingYards',YARDS:'puntingYards'},
    KICKRETURNS:{YDS:'kickReturnYards',YARDS:'kickReturnYards',TD:'returnTouchdowns'},
    PUNTRETURNS:{YDS:'puntReturnYards',YARDS:'puntReturnYards',TD:'returnTouchdowns'}
  };
  function category(section){
    const name=normalize(section.name);
    if(name.includes('PASSING'))return 'PASSING';
    if(name.includes('RUSHING'))return 'RUSHING';
    if(name.includes('RECEIVING'))return 'RECEIVING';
    if(name.includes('INTERCEPTION'))return 'INTERCEPTIONS';
    if(name.includes('FUMBLE'))return 'FUMBLES';
    if(name.includes('KICKRETURN')||name.includes('KICKOFFRETURN'))return 'KICKRETURNS';
    if(name.includes('PUNTRETURN'))return 'PUNTRETURNS';
    if(name.includes('DEFEN')||name.includes('TACKLE'))return 'DEFENSE';
    if(name.includes('PUNT'))return 'PUNTING';
    if(name.includes('KICK')||name.includes('FIELDGOAL'))return 'KICKING';
    return '';
  }
  for(const group of (box.groups||[])){
    if(String(group.teamId)!==String(watch.teamId))continue;
    for(const section of group.sections||[]){
      const row=watch.kind==='player'?(section.rows||[]).find(p=>String(p.id)===String(watch.playerId)):null;
      if(watch.kind==='player'&&!row)continue;
      const values=watch.kind==='player'?row.stats:section.totals;
      const sectionType=category(section);
      (section.labels||[]).forEach((key,i)=>{
        const k=normalize(key),v=values?.[i],parsed=n(v);
        if(!football){
          const mapped=labelsBB[k];if(mapped&&parsed!=null&&!Object.hasOwn(result,mapped))result[mapped]=parsed;
          return;
        }
        if(!sectionType)return; // Never treat generic YDS or TD as receiving stats.
        const map=byRole[sectionType]||{};
        const compound=/^\s*(\d+)\s*[/-]\s*(\d+)\s*$/.exec(String(v??''));
        if(sectionType==='PASSING'&&(k==='CATT'||k==='CMPATT'||k==='COMPATT')&&compound){
          result.completions=Number(compound[1]);result.passingAttempts=Number(compound[2]);return;
        }
        if(sectionType==='KICKING'&&k==='FG'&&compound){
          result.fieldGoalsMade=Number(compound[1]);result.fieldGoalsAttempted=Number(compound[2]);return;
        }
        if(sectionType==='KICKING'&&k==='XP'&&compound){
          result.extraPointsMade=Number(compound[1]);result.extraPointsAttempted=Number(compound[2]);return;
        }
        const stat=map[k];
        if(stat&&parsed!=null&&!Object.hasOwn(result,stat))result[stat]=parsed;
      });
    }
  }
  return result;
}
