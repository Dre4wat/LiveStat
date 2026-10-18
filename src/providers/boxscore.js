// LiveStat ESPN game-summary box-score normalizer. Feed structure may vary by sport/game.
export function normalizeBoxScore(sport, gameId, response) {
  const a = x => Array.isArray(x) ? x : [];
  const str = x => x == null ? '' : String(x);
  const value = x => str(x && typeof x === 'object' ? (x.displayValue ?? x.value ?? '') : x);
  const source = response && typeof response === 'object' ? response : {};
  const box = source.boxscore || {};
  const competition = source.header?.competitions?.[0] || {};
  const teams = new Map();
  function addTeam(raw, fallback = {}) {
    const t = raw?.team || raw || {};
    const id = str(t.id ?? raw?.id ?? fallback.id);
    if (!id) return;
    const prev = teams.get(id) || {id, name:'', abbr:'', score:'', homeAway:'', stats:[]};
    const stats = a(raw?.statistics).map(s=>({
      name:str(s.name || s.label || s.displayName),
      label:str(s.label || s.displayName || s.name),
      value:value(s.displayValue ?? s.value ?? s.total)
    })).filter(s=>s.label && s.value !== '');
    teams.set(id,{
      id,
      name:str(t.displayName || t.name || prev.name),
      abbr:str(t.abbreviation || t.shortDisplayName || prev.abbr),
      score:value(raw?.score ?? fallback.score ?? prev.score),
      homeAway:str(raw?.homeAway || fallback.homeAway || prev.homeAway),
      stats:stats.length?stats:prev.stats
    });
  }
  for (const team of a(competition.competitors)) addTeam(team);
  for (const team of a(box.teams)) addTeam(team);
  const groups = a(box.players).map(group=>{
    const t=group.team || {};
    addTeam({team:t});
    const sections=a(group.statistics).map(section=>{
      const labels=a(section.labels).map(str);
      const rows=a(section.athletes).map(entry=>{
        const athlete=entry.athlete || entry.player || {};
        const stats=a(entry.stats).map(value);
        return {
          id:str(athlete.id),
          name:str(athlete.displayName || athlete.fullName || athlete.shortName || entry.displayName),
          position:str(athlete.position?.abbreviation || athlete.position?.name || ''),
          stats,
          starter:Boolean(entry.starter),
          didNotPlay:Boolean(entry.didNotPlay)
        };
      }).filter(x=>x.name);
      return {
        name:str(section.displayName || section.name || 'Player statistics'),
        labels,
        rows,
        totals:a(section.totals).map(value)
      };
    }).filter(x=>x.rows.length || x.totals.length);
    return {teamId:str(t.id), sections};
  }).filter(x=>x.sections.length);
  const ordered=[...teams.values()].sort((x,y)=>{
    const rank = z => z.homeAway==='away'?0:z.homeAway==='home'?1:2;
    return rank(x)-rank(y);
  });
  return {
    sport:str(sport), gameId:str(gameId),
    name:str(source.header?.competitions?.[0]?.notes?.[0]?.headline || source.header?.name || ''),
    status:str(competition.status?.type?.detail || source.header?.status?.type?.detail || ''),
    state:str(competition.status?.type?.state || ''),
    teams:ordered,
    groups,
    hasStats:ordered.some(t=>t.stats.length>0)||groups.some(g=>g.sections.some(s=>s.rows.length>0))
  };
}
