export function createInsights({api,escape,refresh,getWatches=()=>[],getAlerts=()=>[]}) {
  const esc=escape;
  const state={kind:'game',sport:'nba',game:null,details:null,loading:false,error:'',tab:'overview',selected:null,
    tracker:null,profiles:null,league:null,leagueSection:'standings',profile:null,profileData:null,compare:[],pinned:[]};
  try{if(typeof localStorage!=='undefined')state.pinned=JSON.parse(localStorage.getItem('livestat-pinned')||'[]')}catch{state.pinned=[]}
  const names={nfl:'NFL',cfb:'College Football',nba:'NBA',ncaam:"Men's College Basketball",ncaaw:"Women's College Basketball"};
  const statNames={points:'PTS',rebounds:'REB',assists:'AST',steals:'STL',blocks:'BLK',threePointers:'3PM',turnovers:'TO',receptions:'REC',receivingYards:'REC YDS',targets:'TGTS',fumbles:'FUM',touchdowns:'TD',fieldGoals:'FG',sacks:'SACK'};
  const sportName=()=>names[state.sport]||state.sport;
  const isFootball=()=>['nfl','cfb'].includes(state.sport);
  const clock=p=>['Q'+(p.period||'?'),p.clock].filter(Boolean).join(' · ');
  function notice(message){return `<div class="ls-i-empty">${esc(message)}</div>`}
  function tabs(items){return `<div class="ls-i-tabs">${items.map(([id,title])=>`<button class="${state.tab===id?'active':''}" data-action="intel-tab" data-value="${id}">${title}</button>`).join('')}</div>`}
  function statRows(lines){return `<div class="ls-i-stats">${lines.map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value ?? '—')}</strong></div>`).join('')}</div>`}
  function gameHeader(){const g=state.game||{},a=state.details?.teams?.length?state.details.teams:(g.teams||[]);
    return `<header class="ls-i-head"><div><span class="ls-i-eyebrow">GAME INTELLIGENCE / ${esc(sportName())}</span><h1>${esc(g.name||a.map(x=>x.abbr).join(' vs ')||'Game Center')}</h1><p>${esc(state.details?.status||g.status||'Game details')}</p></div><div class="ls-i-score">${a.slice(0,2).map(t=>`<div><small>${esc(t.abbr||t.name||'TEAM')}</small><strong>${esc(t.score??'—')}</strong></div>`).join('')}</div></header>`}
  function lineChart(points,key,min,max){
    const data=(points||[]).filter(p=>Number.isFinite(Number(p[key])));if(data.length<2)return notice('Not enough scoring events to draw a chart.');
    const low=min??Math.min(...data.map(d=>Number(d[key])),0),high=max??Math.max(...data.map(d=>Number(d[key])),1);
    const range=Math.max(1,high-low);
    const poly=data.map((p,i)=>`${(i/(data.length-1)*98+1).toFixed(2)},${(96-(Number(p[key])-low)/range*90).toFixed(2)}`).join(' ');
    return `<svg class="ls-i-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Game ${esc(key)} chart"><path d="M1 96 H99 M1 52 H99 M1 8 H99" stroke="#39242a" stroke-width=".5"/><polyline points="${poly}" fill="none" stroke="#fb3449" stroke-width="1.7" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function trackerCard(w) {
    const goals=w.goals||{done:0,total:0};
    return `<article class="ls-i-card"><div class="ls-i-card-head"><strong>${esc(w.name)}</strong><span>${esc(names[w.sport]||w.sport)} · ${esc(w.source||'')}</span></div><p class="ls-i-muted">${esc(w.game?.status||'Game '+w.gameId)}${w.game?.teams?.length?' · '+esc(w.game.teams.map(t=>(t.abbr||t.name)+' '+(t.score||'')).join(' vs ')):''}</p>
      ${(w.stats||[]).map(m=>`<div class="ls-i-progress"><div><b>${esc(statNames[m.stat]||m.stat)}</b><span>${m.current==null?'N/A':esc(m.current)}${m.target!=null?' / '+esc(m.target):''} ${m.complete?'✓':''}</span></div><div class="ls-i-track"><i style="width:${m.target!=null&&m.current!=null?Math.min(100,Math.max(0,m.current/m.target*100)):0}%"></i></div></div>`).join('')}
      <div class="ls-i-controls"><span class="ls-i-chip">${goals.done}/${goals.total} TARGETS</span><button data-action="intel-pin" data-watch="${esc(w.id)}">${state.pinned.includes(w.id)?'★ PINNED':'☆ PIN GAME'}</button>${goals.total>0&&goals.complete?'<span class="ls-i-chip success">MISSION COMPLETE</span>':''}<button data-action="intel-open" data-sport="${esc(w.sport)}" data-game="${esc(w.gameId)}">OPEN GAME ↗</button></div></article>`;
  }
  function commandView(){
    if(state.loading&&!state.tracker)return notice('Loading saved players and game statistics…');
    if(state.error&&!state.tracker)return notice('Player tracker: '+state.error);
    const watches=(state.tracker?.tracker||[]).slice().sort((a,b)=>Number(state.pinned.includes(b.id))-Number(state.pinned.includes(a.id)));
    return `<div class="ls-i-title"><span>YOUR MULTI-GAME OPERATIONS HUB</span><h1>COMMAND <em>CENTER</em></h1><p>Live player goals, mission progress, and comparisons. Numbers are only shown when ESPN provides them.</p></div>
      <div class="ls-i-actions"><button data-action="intel-reload">↻ UPDATE TRACKER</button><button data-action="intel-leagueopen">LEAGUE STANDINGS / INJURIES ↗</button><span>${watches.length} SAVED PLAYERS & TEAMS</span></div>
      ${watches.length?`<div class="ls-i-grid">${watches.map(trackerCard).join('')}</div>`:notice('No saved alerts yet. Choose a game, select a player, and save an alert loadout first.')}
      <section class="ls-i-panel"><h2>PLAYER COMPARISON</h2><p>Compare players tracked in the same or different games.</p>
      <div class="ls-i-compare-chooser"><select id="ls-i-left"><option value="">Choose first player</option>${watches.filter(w=>w.kind==='player').map(w=>`<option value="${esc(w.id)}" ${state.compare[0]===w.id?'selected':''}>${esc(w.name)}</option>`).join('')}</select>
      <select id="ls-i-right"><option value="">Choose second player</option>${watches.filter(w=>w.kind==='player').map(w=>`<option value="${esc(w.id)}" ${state.compare[1]===w.id?'selected':''}>${esc(w.name)}</option>`).join('')}</select></div>
      ${(()=>{const a=watches.find(x=>x.id===state.compare[0]),b=watches.find(x=>x.id===state.compare[1]);if(!a||!b)return notice('Select two players to compare their tracked statistics.');const stats=[...new Set([...a.stats,...b.stats].map(x=>x.stat))];return `<div class="ls-i-compare-head"><strong>${esc(a.name)}</strong><strong>${esc(b.name)}</strong></div>${stats.map(k=>{const l=a.stats.find(x=>x.stat===k),r=b.stats.find(x=>x.stat===k);return `<div class="ls-i-compare-row"><strong>${l?.current??'—'}</strong><span>${esc(statNames[k]||k)}</span><strong>${r?.current??'—'}</strong></div>`}).join('')}`})()}</section>`;
  }
  function timeline(plays,heading){
    if(!plays?.length)return notice('No plays available from the data provider.');
    const tracked=(getWatches()||[]).filter(w=>w.sport===state.sport&&String(w.gameId||'')===String(state.game?.id||''));
    let lastQuarter=null;
    const rows=plays.slice(-350).reverse().map(p=>{
      const quarter=p.period||'?',group=quarter!==lastQuarter?'<h3>QUARTER '+esc(quarter)+'</h3>':'';
      lastQuarter=quarter;
      const watched=tracked.filter(w=>w.kind==='player'&&w.name&&p.text?.toLowerCase().includes(w.name.toLowerCase()));
      return group+'<button data-action="intel-play" data-play="'+esc(p.id)+'" class="'+(p.scoring?'scoring ':'')+(watched.length?'watched':'')+'"><span class="ls-i-time">'+esc(clock(p))+'</span><strong>'+esc(p.type||(p.scoring?'SCORING PLAY':'PLAY'))+(watched.length?' · ★ WATCHLIST':'')+'</strong><p>'+esc(p.text||'No description')+'</p></button>';
    }).join('');
    return '<div class="ls-i-panel"><h2>'+heading+'</h2><div class="ls-i-timeline">'+rows+'</div></div>';
  }
  function overview(){
    const d=state.details;
    if(!d)return notice('No game data loaded.');
    const mm=d.momentumSummary||{};
    return `<div class="ls-i-grid">${[
      ['LEAD CHANGES',mm.leadChanges],['BIGGEST HOME LEAD',mm.biggestHomeLead],['BIGGEST AWAY LEAD',mm.biggestAwayLead],['SCORING PLAYS',d.scoring?.length]
    ].map(([k,v])=>`<article class="ls-i-metric"><small>${k}</small><strong>${v??'—'}</strong></article>`).join('')}</div>
      <section class="ls-i-panel"><h2>SCORING BY PERIOD</h2>${statRows((d.periods||[]).map(p=>['Q'+p.period,p.away+' – '+p.home]))}${!d.periods?.length?notice('Per-period scoring data is unavailable for this game.'):''}</section>
      ${timeline((d.plays||[]).slice(-12),'RECENT GAME EVENTS')}`;
  }
  function momentumView(){
    const d=state.details||{};
    const n=d.momentum||[];
    const p=d.probabilities||[];
    return `<section class="ls-i-panel"><h2>SCORE DIFFERENTIAL</h2><p class="ls-i-muted">Above zero: home team ahead. Below zero: away team ahead. Derived from recorded scores.</p>${lineChart(n,'margin')}${statRows([['LEAD CHANGES',d.momentumSummary?.leadChanges],['HOME BIGGEST LEAD',d.momentumSummary?.biggestHomeLead],['AWAY BIGGEST LEAD',d.momentumSummary?.biggestAwayLead]])}</section>
    <section class="ls-i-panel"><h2>ESPN WIN PROBABILITY</h2>${p.length?`${lineChart(p,'home',0,1)}<p class="ls-i-muted">Latest available home win probability: ${Math.round(p.at(-1).home*1000)/10}%</p>`:notice('ESPN did not provide win-probability data for this game. No probability has been estimated.')}</section>`;
  }
  function shotsView(){
    const shots=state.details?.shots||[];
    if(!shots.length)return notice('No shot coordinates were supplied for this game. The shot chart cannot be shown.');
    const coords=shots.map(p=>({x:Math.max(1,Math.min(99,(p.coordinate.x+25)*2)),y:Math.max(1,Math.min(99,(p.coordinate.y+25)*2)),made:p.made}));
    return `<section class="ls-i-panel"><h2>SHOT MAP</h2><p class="ls-i-muted">Shot location coordinates as provided by ESPN; diagram is an approximate normalized court view.</p><svg viewBox="0 0 100 100" class="ls-i-court" aria-label="Shot locations on a stylized court" role="img">
      <rect x="1" y="1" width="98" height="98" rx="2" fill="#191316" stroke="#bfb5bb" stroke-width=".6"/>
      <path d="M50 1 V99 M1 50 H99 M20 36 H80 V64 H20 Z M35 35 A15 15 0 1 0 35 65 M65 35 A15 15 0 1 1 65 65" fill="none" stroke="#7b555d" stroke-width=".45"/>
      ${coords.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="1.4" fill="${p.made?'#34cb96':'#ed4b59'}" stroke="#000" stroke-width=".25"/>`).join('')}</svg>
      <p class="ls-i-muted">● Green: made &nbsp; ● Red: missed · ${shots.length} located shots</p></section>`;
  }
  function driveView(){
    const d=state.details?.drives||[];
    if(!d.length)return notice('No football drive data was supplied.');
    return `<div class="ls-i-grid">${d.map((drive,i)=>`<article class="ls-i-card"><div class="ls-i-card-head"><strong>DRIVE ${i+1}</strong><span>${esc(drive.result?.slice(0,35)||'')}</span></div>${statRows([['PLAYS',drive.count],['YARDS',drive.yardage??'—'],['START',drive.start||'—'],['TIME',drive.time||'—']])}
      <details><summary>View drive plays</summary><div class="ls-i-detail">${drive.plays.map(p=>`<p>${esc(p)}</p>`).join('')}</div></details></article>`).join('')}</div>`;
  }
  function clutchView(){
    const d=state.details||{},plays=(d.plays||[]).filter(p=>{
      const time=(p.clock||'').match(/^(\d+):(\d+)/);
      const remaining=time?Number(time[1])*60+Number(time[2]):Infinity;
      const finalPeriod=isFootball()?4:4;
      const latest=(d.momentum||[]).filter(m=>m.index<=p.index).at(-1);
      return p.period>=finalPeriod&&remaining<=120&&latest&&Math.abs(latest.margin)<=8;
    });
    return `<section class="ls-i-panel"><h2>CLUTCH TIME</h2><p>Fourth period or later, final two minutes, within eight points.</p></section>${timeline(plays,'CLOSE-FINISH EVENTS')}`;
  }
  function gameView(){
    if(state.loading&&!state.details)return notice('Loading play-by-play, momentum, drives and game intelligence…');
    const d=state.details||{};
    const items=[['overview','OVERVIEW'],['plays','PLAY-BY-PLAY'],['momentum','MOMENTUM'],['scoring','SCORING'],['clutch','CLUTCH'],['replay','REPLAY'],...(isFootball()?[['drives','DRIVES']]:[['shots','SHOT CHART']])];
    const p=state.selected&&d.plays?.find(x=>x.id===state.selected);
    return `<div class="ls-i-actions"><button data-action="intel-back">← BACK TO GAMES</button><button data-action="intel-reload">↻ REFRESH</button></div>${gameHeader()}
    ${state.error?notice(state.error):''}${tabs(items)}${p?`<div class="ls-i-selected"><button data-action="intel-clear">✕</button><strong>${esc(clock(p))}</strong><p>${esc(p.text)}</p>${p.homeScore!=null?`<small>HOME ${p.homeScore} · AWAY ${p.awayScore}</small>`:''}</div>`:''}
    ${state.tab==='plays'?timeline(d.plays,'PLAY BY PLAY'):state.tab==='momentum'?momentumView():state.tab==='scoring'?timeline(d.scoring,'SCORING SUMMARY'):state.tab==='clutch'?clutchView():state.tab==='drives'?driveView():state.tab==='shots'?shotsView():state.tab==='replay'?`<div class="ls-i-panel"><h2>PERSONAL GAME REPLAY</h2><p>Review scoring plays and personalized alert events after the game. Video playback is not included.</p><button class="ls-i-replay" data-action="intel-copy">COPY TEXT RECAP</button>${(()=>{const entries=(getAlerts()||[]).filter(x=>x.sport===state.sport&&x.game&&(x.game===state.game?.name||x.game.includes(state.game?.name||'____')));return entries.length?`<div class="ls-i-timeline">${entries.slice(0,60).map(x=>`<div class="ls-i-log"><strong>${esc(x.name)} — ${esc(x.label)}</strong><p>${esc(x.detail)}</p></div>`).join('')}</div>`:notice('No saved alerts associated with this game yet.')})()}</div>${timeline(d.scoring,'SCORING HIGHLIGHTS')}`:overview()}`;
  }
  function tableFromStats(stats){
    const categories=stats?.categories||[];
    if(!categories.length)return notice('Season statistics are not available from this provider.');
    return categories.slice(0,7).map(c=>`<section class="ls-i-panel"><h2>${esc(c.displayName||c.name||'Statistics')}</h2>
       <div class="ls-i-statgrid">${(c.labels||[]).slice(0,35).map((name,i)=>`<div><small>${esc(name)}</small><strong>${esc(c.totals?.[i]??'—')}</strong></div>`).join('')}</div></section>`).join('');
  }
  function profileView(){
    const p=state.profileData||{};
    const gameLog=p.gamelog;
    return `<div class="ls-i-actions"><button data-action="intel-back">← BACK TO GAME</button><button data-action="intel-reload">↻ REFRESH</button></div>
    <div class="ls-i-title"><span>${esc(sportName())} / PLAYER PROFILE</span><h1>PLAYER <em>SCOUTING</em></h1><p>Season statistics, recent form, and game-log availability.</p></div>
    ${state.error?notice(state.error):''}
    ${tableFromStats(p.stats)}
    <section class="ls-i-panel"><h2>RECENT GAME LOG</h2>${Array.isArray(gameLog?.events)&&gameLog.events.length?`<div class="ls-i-timeline">${gameLog.events.slice(0,12).map(x=>`<div class="ls-i-log"><strong>${esc(x.date||'')}</strong><span>${esc(x.opponent?.abbreviation||'')}</span><p>${esc((x.stats||[]).join(' · '))}</p></div>`).join('')}</div>`:notice('No supported game log was returned.')}</section>`;
  }
  function leagueView(){
    return `<div class="ls-i-title"><span>LEAGUE DATA / ${esc(sportName())}</span><h1>LEAGUE <em>CENTER</em></h1><p>Standings and player availability from free data feeds, when accessible.</p></div>
    <div class="ls-i-actions"><select id="ls-i-league-sport">${Object.entries(names).map(([k,v])=>`<option value="${k}" ${state.sport===k?'selected':''}>${esc(v)}</option>`).join('')}</select>
    <button data-action="intel-league" data-value="standings">STANDINGS</button><button data-action="intel-league" data-value="injuries">INJURIES</button></div>
    ${state.error?notice(state.error):''}
    ${state.loading?notice('Loading league statistics…'):state.league?(()=>{
      const obj=state.league.data||{},entries=[];
      if(state.leagueSection==='standings'){
        const walk=(value,depth=0)=>{
          if(depth>6||entries.length>=120||!value||typeof value!=='object')return;
          if(Array.isArray(value)){value.forEach(x=>walk(x,depth+1));return}
          const name=value.team?.displayName||value.team?.name;
          if(name&&value.stats)entries.push({name,stats:value.stats});
          Object.values(value).forEach(x=>{if(typeof x==='object')walk(x,depth+1)});
        };walk(obj);
        return entries.length?`<section class="ls-i-panel"><h2>STANDINGS</h2>${entries.map(x=>`<div class="ls-i-standing"><strong>${esc(x.name)}</strong><span>${esc((x.stats||[]).slice(0,3).map(s=>s.displayValue||s.value||'').join(' · '))}</span></div>`).join('')}</section>`:notice('No standings entries were returned in a supported format.');
      }
      const injuries=obj.injuries||obj.teams||obj.items||[];
      return injuries.length?`<section class="ls-i-panel"><h2>INJURY REPORT</h2>${injuries.slice(0,60).map(x=>`<div class="ls-i-standing"><strong>${esc(x.athlete?.displayName||x.team?.displayName||x.displayName||'Team')}</strong><span>${esc(x.status||x.type?.name||x.injuries?.length||'')}</span></div>`).join('')}</section>`:notice('No injury report was returned by ESPN for this league.');
    })():notice('Choose a league section to load standings or injuries.')}`;
  }
  function render(){
    return `<div class="ls-intelligence">${state.kind==='game'?gameView():state.kind==='profile'?profileView():state.kind==='league'?leagueView():commandView()}<footer class="ls-i-data-note">Data: unofficial ESPN endpoints. Missing values are not estimated. Free hosting can sleep; live updates are not guaranteed.</footer></div>`;
  }
  async function reload(){
    state.error='';state.loading=true;refresh();
    try {
      if(state.kind==='game'){
        const result=await api('/api/intelligence?sport='+encodeURIComponent(state.sport)+'&game='+encodeURIComponent(state.game.id));state.details=result.insights;
      } else if(state.kind==='command'){
        state.tracker=await api('/api/tracker');
      } else if(state.kind==='profile'){
        const result=await api('/api/profile?sport='+encodeURIComponent(state.sport)+'&athlete='+encodeURIComponent(state.profile));state.profileData=result.profile;
      } else if(state.kind==='league'){
        const result=await api('/api/league?sport='+encodeURIComponent(state.sport)+'&section='+state.leagueSection);state.league=result.league;
      }
    }catch(e){state.error=e.message||String(e)}
    finally{state.loading=false;refresh();}
  }
  function openGame(sport,game){
    if(!game?.id)return;
    state.kind='game';state.sport=sport;state.game=game;state.tab='overview';state.selected=null;state.details=null;state.error='';
    return reload();
  }
  function openCommand(){state.kind='command';state.error='';return reload()}
  function openLeague(sport){state.kind='league';state.sport=sport||state.sport;state.leagueSection='standings';state.league=null;return reload()}
  function openProfile(sport,athlete){state.kind='profile';state.sport=sport;state.profile=athlete;state.profileData=null;return reload()}
  function handle(action,node){
    if(action==='intel-copy'){
      const d=state.details||{};
      const summary=[(state.game?.name||'Game')+' — LiveStat Replay',...((d.scoring||[]).map(p=>'Q'+p.period+' '+p.clock+' '+p.text))].join('\n');
      if(typeof navigator!=='undefined'&&navigator.clipboard?.writeText)navigator.clipboard.writeText(summary).catch(()=>{});
      return true;
    }
    if(action==='intel-pin'){
      const id=node.dataset.watch;
      state.pinned=state.pinned.includes(id)?state.pinned.filter(x=>x!==id):[...state.pinned,id];
      try{if(typeof localStorage!=='undefined')localStorage.setItem('livestat-pinned',JSON.stringify(state.pinned))}catch{}
      refresh();return true;
    }
    if(action==='intel-tab'){state.tab=node.dataset.value;state.selected=null;refresh();return true}
    if(action==='intel-play'){state.selected=node.dataset.play;refresh();return true}
    if(action==='intel-clear'){state.selected=null;refresh();return true}
    if(action==='intel-reload'){reload();return true}
    if(action==='intel-league'){state.leagueSection=node.dataset.value;reload();return true}
    return false;
  }
  function input(node){
    if(node.id==='ls-i-left'){state.compare[0]=node.value;refresh();return true}
    if(node.id==='ls-i-right'){state.compare[1]=node.value;refresh();return true}
    if(node.id==='ls-i-league-sport'){state.sport=node.value;state.league=null;reload();return true}
    return false;
  }
  return {state,render,openGame,openCommand,openLeague,openProfile,handle,input,reload};
}
