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
      made:/\\b(makes|made|good)\\b/i.test(txt(p.text))&&!/\\bmiss/i.test(txt(p.text))
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
  const shots=plays.filter(p=>p.coordinate&&(p.shooting||/\\b(shot|jumper|layup|dunk|hook|three point|3-pt)\\b/i.test(p.text)))
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
  const lookup = {'PTS':'points','REB':'rebounds','AST':'assists','STL':'steals','BLK':'blocks','TO':'turnovers','3PM':'threePointers','3PT':'threePointers','REC':'receptions','YDS':'receivingYards','TGTS':'targets','TGT':'targets','FUM':'fumbles','TD':'touchdowns'};
  const sections=(box.groups||[]).filter(g=>String(g.teamId)===String(watch.teamId)).flatMap(g=>g.sections||[]);
  const result={};
  for(const section of sections){
    const idx=(section.rows||[]).findIndex(r=>String(r.id)===String(watch.playerId));
    if(watch.kind==='player'&&idx<0)continue;
    const values=watch.kind==='player'?section.rows[idx].stats:section.totals;
    (section.labels||[]).forEach((k,i)=>{
      const stat=lookup[txt(k).toUpperCase().replace(/[^A-Z0-9]/g,'')];const n=number(values?.[i]);
      if(stat&&n!=null&&n>=0&&!Object.hasOwn(result,stat))result[stat]=n;
    });
  }
  return result;
}
