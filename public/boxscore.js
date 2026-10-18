// LiveStat box-score display. All dynamic strings are escaped.
export function boxscoreMarkup(opts){
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const game = opts.game || {};
  const box = opts.boxscore || {};
  const teams = box.teams?.length ? box.teams : game.teams || [];
  const isFootball = ['nfl','cfb'].includes(opts.sport);
  const state = box.state || game.state || 'pre';
  const groups = Array.isArray(box.groups) ? box.groups : [];
  const activeId = opts.selectedTeam && teams.some(t=>t.id===opts.selectedTeam) ? opts.selectedTeam : String(teams[0]?.id||'');
  const activeGroup = groups.find(g=>g.teamId===activeId);
  const badge = opts.preview ? '<span class="bs-demo">DEMO DATA</span>' : (state==='in' ? '<span class="bs-live">● LIVE</span>' : state==='post' ? '<span class="bs-final">FINAL</span>' : '<span class="bs-scheduled">SCHEDULED</span>');
  const teamTitle = t => esc(t?.abbr || t?.name || 'TEAM');
  const teamBlock = (t, position) => '<div class="bs-team '+position+'"><div class="bs-team-code">'+teamTitle(t)+'</div><div class="bs-team-name">'+esc(t?.name||'')+'</div></div>';
  let html = '<div class="bs-view"><div class="bs-toolbar"><button class="bs-back" data-action="boxclose">← BACK TO GAMES</button><div class="bs-toolbar-meta">GAME CENTER / BOX SCORE</div><button class="bs-refresh" data-action="boxrefresh" '+(opts.loading?'disabled':'')+'>↻ REFRESH</button></div>';
  html += '<div class="bs-title"><span class="bs-eyebrow">LIVE STATISTICS / '+esc((opts.sport||'').toUpperCase())+'</span><h1>BOX <em>SCORE</em></h1><p>Team totals and player-by-player numbers for this matchup.</p></div>';
  html += '<section class="bs-scoreboard">'+badge+'<div class="bs-score-row">'+teamBlock(teams[0],'bs-away')+'<div class="bs-scores"><strong>'+esc(teams[0]?.score??'—')+'</strong><span>–</span><strong>'+esc(teams[1]?.score??'—')+'</strong></div>'+teamBlock(teams[1],'bs-home')+'</div><div class="bs-game-status">'+esc(box.status || game.status || (state==='pre'?'Scheduled':''))+'</div></section>';
  if(opts.error) html+='<div class="bs-notice bs-error">Unable to load box score: '+esc(opts.error)+'. Try refreshing.</div>';
  else if(opts.loading&&!opts.boxscore) html+='<div class="bs-notice">Loading game statistics…</div>';
  else if(!box.hasStats) html+='<div class="bs-notice">No box score is available yet. Player and team stats usually appear after play begins, if the free data source provides them.</div>';
  else {
    const metrics = [];
    for (const t of teams) for (const m of (t.stats||[])) {
      const key = String(m.name||m.label||'').toLowerCase();
      if(key&&!metrics.some(n=>n.key===key)) metrics.push({key,label:m.label||m.name});
    }
    if (metrics.length) {
      const displayed = metrics.slice(0,22);
      html+='<section class="bs-panel"><div class="bs-panel-title"><h2>TEAM COMPARISON</h2><span>GAME TOTALS</span></div><div class="bs-comparison"><div class="bs-comparison-head"><span>'+teamTitle(teams[0])+'</span><span>STAT</span><span>'+teamTitle(teams[1])+'</span></div>';
      for(const m of displayed){
        const look = t=>(t?.stats||[]).find(x=>String(x.name||x.label||'').toLowerCase()===m.key)?.value||'—';
        html+='<div class="bs-comparison-row"><strong>'+esc(look(teams[0]))+'</strong><span>'+esc(m.label)+'</span><strong>'+esc(look(teams[1]))+'</strong></div>';
      }
      html+='</div></section>';
    }
    html+='<section class="bs-panel"><div class="bs-panel-title"><h2>PLAYER STATS</h2><span>'+ (isFootball?'OFFENSE · DEFENSE · SPECIAL TEAMS':'FULL GAME BOXSCORE')+'</span></div>';
    html+='<div class="bs-team-tabs">';
    for(const t of teams){html+='<button class="bs-team-tab '+(String(t.id)===activeId?'selected':'')+'" data-action="boxteam" data-team="'+esc(t.id)+'">'+teamTitle(t)+'</button>';}
    html+='</div>';
    if(!activeGroup || !activeGroup.sections?.length) html+='<div class="bs-empty">Player statistics are not available for this team yet.</div>';
    else for(const section of activeGroup.sections){
      const labels = section.labels||[];
      const rows = section.rows||[];
      html+='<div class="bs-stat-section"><h3>'+esc(section.name || (isFootball?'Stats':'Box Score'))+'</h3><div class="bs-table-scroll" role="region" aria-label="'+esc(section.name)+' player statistics" tabindex="0"><table class="bs-table"><thead><tr><th scope="col">PLAYER</th>';
      for(const label of labels)html+='<th scope="col">'+esc(label)+'</th>';
      html+='</tr></thead><tbody>';
      for(const player of rows){
        html+='<tr><th scope="row">'+esc(player.name)+(player.position?'<small>'+esc(player.position)+'</small>':'')+'</th>';
        for(let i=0;i<labels.length;i++)html+='<td>'+esc(player.stats?.[i]??'—')+'</td>';
        html+='</tr>';
      }
      if(section.totals?.length){html+='<tr class="bs-totals"><th scope="row">TOTALS</th>';for(let i=0;i<labels.length;i++)html+='<td>'+esc(section.totals[i]??'—')+'</td>';html+='</tr>';}
      html+='</tbody></table></div></div>';
    }
    html+='</section>';
  }
  html+='<div class="bs-foot"><span>'+(opts.preview?'Illustrative scores and statistics.':'ESPN unofficial game data · May be delayed, corrected, or incomplete.')+'</span><button data-action="boxtrack">SELECT A PLAYER TO TRACK →</button></div></div>';
  return html;
}
