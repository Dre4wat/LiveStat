import {createAnimatedCardsStudio} from './animated-cards.js';
export function createAnalyticsLab({api,refresh,toast=()=>{},getWatches=()=>[],calculateFormula}){
 const yearNow=new Date().getUTCFullYear();
 const sports={nba:'NBA',nfl:'NFL',cfb:'College Football',ncaam:"Men's College Basketball",ncaaw:"Women's College Basketball"};
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const state={sport:'nba',season:yearNow+1,compareSeason:yearNow,player:null,search:'',results:[],loading:false,searching:false,error:'',
   data:null,compare:null,archive:[],tab:'dashboard',metric:null,layoutName:'My Stat Dashboard',savedLayouts:[],activeLayout:null,
   metrics:[],cardMode:'latest',cardTheme:'redline',formula:'PTS + REB + AST',formulaResult:null,
   report:null,reportLoading:false,comparisonLoading:false,currentGame:null,current:null};
 try{if(typeof localStorage!=='undefined')state.savedLayouts=JSON.parse(localStorage.getItem('livestat-lab-layouts')||'[]')}catch{state.savedLayouts=[]}
 const motion=createAnimatedCardsStudio({
   refresh,notify:toast,
   getData:()=>{
     const player={...state.player,...(state.data?.player||{})};
     const matching=getWatches().find(w=>w.kind==='player'&&String(w.playerId)===String(player.id)&&w.sport===state.sport&&
        (!state.currentGame?.gameId||String(w.gameId)===String(state.currentGame.gameId)));
     return {
       player,sport:state.sport,season:state.season,
       games:state.data?.history?.games||[],
       labels:state.data?.history?.labels||[],
       current:state.current,watchRules:matching?.rules||{}
     };
   }
 });
 const fmt=(n,places=1)=>n==null?'—':Number(n).toFixed(places).replace(/\.0$/,'');
 const rows=()=>state.data?.history?.games||[];
 const labels=()=>state.data?.history?.labels||[];
 const series=(metric=state.metric,list=rows())=>list.filter(g=>Number.isFinite(g?.stats?.[metric])).map(g=>({value:g.stats[metric],id:g.id,date:g.date,opponent:g.opponent}));
 const mean=(list,metric)=>{const a=series(metric,list);return a.length?a.reduce((v,p)=>v+p.value,0)/a.length:null};
 const latest=()=>rows()[0]||null;
 const currentMetrics=()=>state.activeLayout?state.activeLayout.metrics:state.metrics;
 function ensureMetrics(){
   const available=labels();
   const preferred=['PTS','REB','AST','STL','BLK','3PM','YDS','TDS','TD','REC','ATT','CAR','TOT','SOLO','SACKS','INT','COMB','FG%','MIN'];
   if(!available.includes(state.metric))state.metric=preferred.find(k=>available.includes(k))||available[0]||null;
   if(!state.metrics.length)state.metrics=preferred.filter(k=>available.includes(k)).slice(0,4);
   if(!state.metrics.length)state.metrics=available.slice(0,4);
   state.metrics=state.metrics.filter(k=>available.includes(k));
   if(state.activeLayout?.sport!==state.sport)state.activeLayout=null;
 }
 function heading(){
  return `<div class="lab-head"><div class="lab-strap">LIVESTAT // DATA INTELLIGENCE</div><h1>ANALYTICS <em>LAB</em></h1><p>Research players, compare seasons, design stat dashboards and export performance cards.</p></div>`;
 }
 function tabs(){
  return `<div class="lab-tabs">${[
   ['dashboard','DASHBOARD'],['history','HISTORY & TRENDS'],['seasons','SEASON COMPARISON'],
   ['cards','PLAYER CARDS'],['animated','ANIMATED CARDS'],['formula','FORMULA LAB'],['analyst','GAME ANALYST']
  ].map(([id,label])=>`<button data-action="lab-tab" data-value="${id}" class="${state.tab===id?'active':''}">${label}</button>`).join('')}</div>`;
 }
 function chooser(){
  const players=getWatches().filter(w=>w.kind==='player'&&w.playerId&&sports[w.sport]);
  return `<section class="lab-search">
   <div class="lab-search-row"><label>LEAGUE<select id="lab-sport">${Object.entries(sports).map(([id,name])=>`<option value="${id}" ${state.sport===id?'selected':''}>${escape(name)}</option>`).join('')}</select></label>
   <label class="lab-flex">SEARCH PLAYER OR ENTER ESPN ID<input id="lab-search" value="${escape(state.search)}" placeholder="LeBron James, Lamar Jackson, or player ID" autocomplete="off" /></label>
   <button data-action="lab-search">⌕ SEARCH</button></div>
   ${players.length?`<div class="lab-favorites"><small>YOUR SAVED PLAYERS</small>${players.slice(0,12).map(w=>`<button data-action="lab-favorite" data-watch="${escape(w.id)}">${escape(w.name)}</button>`).join('')}</div>`:''}
   ${state.searching?'<p class="lab-muted">Searching ESPN…</p>':''}
   ${state.results.length?`<div class="lab-search-results">${state.results.slice(0,30).map(p=>`<button data-action="lab-player" data-player="${escape(p.id)}"><strong>${escape(p.name)}</strong><small>${escape(p.team||p.position||sports[state.sport])} ↗</small></button>`).join('')}</div>`:''}
   ${state.error?`<p class="lab-warning">${escape(state.error)}</p>`:''}
  </section>`;
 }
 function seasonControls(){
   return `<div class="lab-season-controls"><span>PLAYER: <strong>${escape(state.player?.name||'')}</strong></span>
     <label>SEASON <select id="lab-season">${Array.from({length:13},(_,i)=>yearNow+2-i).map(y=>`<option value="${y}" ${state.season===y?'selected':''}>${y}</option>`).join('')}</select></label>
     <button data-action="lab-reload" ${state.loading?'disabled':''}>↻ REFRESH</button>
     <small>${state.data?.history?.count??0} recorded game${state.data?.history?.count===1?'':'s'} available</small></div>`;
 }
 function profileTop(){
   const p=state.data?.player||state.player||{};
   const logo=String(p.headshot||'');
   return `<div class="lab-profile"><div class="lab-avatar">${/^https:\/\//.test(logo)?`<img src="/api/analytics/headshot?url=${encodeURIComponent(logo)}" alt="" onerror="this.style.display='none'" />`:escape((p.name||'LS').split(' ').slice(0,2).map(x=>x[0]).join(''))}</div>
   <div><small>${escape(sports[state.sport])} / SEASON ${state.season}</small><h2>${escape(p.name||'PLAYER')}</h2><p>${escape(p.team||'Team unavailable')} · ${escape(p.position||'Position unavailable')}</p></div>
   <button data-action="lab-tab" data-value="cards">CREATE PLAYER CARD ↗</button></div>`;
 }
 function chart(metric=state.metric,games=rows()){
   const d=series(metric,games).slice(0,30).reverse();
   if(d.length<2)return '<div class="lab-empty">At least two games with this statistic are needed to display a trend.</div>';
   const min=Math.min(0,...d.map(x=>x.value)),max=Math.max(1,...d.map(x=>x.value)),range=Math.max(1,max-min);
   const points=d.map((x,i)=>`${(i/(d.length-1)*940+30).toFixed(1)},${(215-(x.value-min)/range*175).toFixed(1)}`).join(' ');
   return `<div class="lab-chartwrap"><svg viewBox="0 0 1000 250" preserveAspectRatio="none" role="img" aria-label="${escape(metric)} trend across ${d.length} games">
    <path d="M25 215 H980 M25 127 H980 M25 39 H980" fill="none" stroke="#57404c" stroke-width="1" />
    <polyline points="${points}" fill="none" stroke="#f2445c" stroke-width="4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    ${d.map((x,i)=>`<circle cx="${(i/(d.length-1)*940+30).toFixed(1)}" cy="${(215-(x.value-min)/range*175).toFixed(1)}" r="4" fill="#fff"><title>${escape(x.date||x.opponent)}: ${x.value} ${escape(metric)}</title></circle>`).join('')}
   </svg><div class="lab-chart-axes"><small>${escape(d[0]?.date?.slice(0,10)||'EARLIER')}</small><span>${escape(metric)} / LAST ${d.length} GAMES</span><small>RECENT →</small></div></div>`;
 }
 function metricOptions(){
   const available=labels();
   return `<label class="lab-metric-select">STATISTIC <select id="lab-metric">${available.map(k=>`<option value="${escape(k)}" ${state.metric===k?'selected':''}>${escape(k)}</option>`).join('')}</select></label>`;
 }
 function statTile(metric){
   const last=latest()?.stats?.[metric],avg=mean(rows(),metric);
   return `<div class="lab-stat-tile"><small>${escape(metric)}</small><strong>${last==null?'—':escape(last)}</strong><span>SEASON GAME AVG · ${fmt(avg)}</span></div>`;
 }
 function dashboard(){
   const saved=state.savedLayouts.filter(x=>x.sport===state.sport);
   return `<section class="lab-panel"><div class="lab-panel-title"><div><span>YOUR CUSTOM CONTROL ROOM</span><h3>MY STAT DASHBOARD</h3></div>${metricOptions()}</div>
   <div class="lab-layout-picker"><label>PRESET<select id="lab-layout"><option value="">Custom layout</option>${saved.map(x=>`<option value="${escape(x.id)}" ${state.activeLayout?.id===x.id?'selected':''}>${escape(x.name)}</option>`).join('')}</select></label>
   <label>NAME<input id="lab-layout-name" maxlength="42" value="${escape(state.layoutName)}" placeholder="My QB Dashboard" /></label>
   <button data-action="lab-layout-save">SAVE LAYOUT</button>${state.activeLayout?'<button data-action="lab-layout-delete">DELETE</button>':''}</div>
   <div class="lab-metric-picks">${labels().map(k=>`<button data-action="lab-metric-toggle" data-metric="${escape(k)}" class="${currentMetrics().includes(k)?'active':''}">${escape(k)} ${currentMetrics().includes(k)?'✓':'+'}</button>`).join('')}</div>
   <p class="lab-muted">Choose and reorder statistics. Layouts stay on this device and are saved separately by sport.</p>
   <div class="lab-custom-stats">${currentMetrics().map(k=>`<div><span>${escape(k)}</span><button data-action="lab-up" data-metric="${escape(k)}" aria-label="Move ${escape(k)} earlier">↑</button><button data-action="lab-down" data-metric="${escape(k)}" aria-label="Move ${escape(k)} later">↓</button></div>`).join('')}</div>
   <div class="lab-stats-grid">${currentMetrics().length?currentMetrics().map(statTile).join(''):'<div class="lab-empty">Select statistics above to add them to your dashboard.</div>'}</div>
   <div class="lab-panel-title"><h3>PERFORMANCE TREND</h3>${metricOptions()}</div>${chart()}
   </section>`;
 }
 function history(){
   const data=rows();
   return `<section class="lab-panel"><div class="lab-panel-title"><h3>GAME HISTORY & TRENDS</h3>${metricOptions()}</div>
   ${data.length?`<div class="lab-summary"><div><small>GAMES</small><strong>${data.length}</strong></div><div><small>${escape(state.metric||'STAT')} AVG</small><strong>${fmt(mean(data,state.metric))}</strong></div><div><small>LAST GAME</small><strong>${escape(latest()?.stats?.[state.metric]??'—')}</strong></div></div>`:''}
   ${chart()}<div class="lab-row-actions"><button data-action="lab-csv">↓ EXPORT HISTORY CSV</button></div>
   <div class="lab-table-wrap"><table><thead><tr><th>DATE</th><th>OPPONENT</th><th>RESULT</th>${labels().slice(0,13).map(x=>`<th>${escape(x)}</th>`).join('')}</tr></thead><tbody>${data.slice(0,75).map(g=>`<tr><td>${escape(g.date?.slice(0,10)||'—')}</td><td>${escape(g.opponent||'—')}</td><td>${escape(g.result||'—')}</td>${labels().slice(0,13).map(k=>`<td>${escape(g.stats?.[k]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
   ${!data.length?'<div class="lab-empty">No per-game history was returned for this player and season. Try another season.</div>':''}</section>`;
 }
 function seasons(){
   const years=Array.from({length:13},(_,i)=>yearNow+2-i);
   const b=state.compare?.history?.games||[];
   return `<section class="lab-panel"><div class="lab-panel-title"><h3>SEASON COMPARISON</h3>${metricOptions()}</div>
   <div class="lab-row-actions"><label>COMPARE WITH <select id="lab-compare-year">${years.map(y=>`<option value="${y}" ${state.compareSeason===y?'selected':''}>${y}</option>`).join('')}</select></label>
    <button data-action="lab-compare" ${state.comparisonLoading?'disabled':''}>${state.comparisonLoading?'LOADING…':'COMPARE SEASONS'}</button><button data-action="lab-archive">LOAD 4-SEASON ARCHIVE</button></div>
   <div class="lab-season-pair"><div><small>SEASON ${state.season}</small><strong>${fmt(mean(rows(),state.metric))}</strong><span>${rows().length} recorded games</span></div><div><small>SEASON ${state.compareSeason}</small><strong>${state.compare?fmt(mean(b,state.metric)):'—'}</strong><span>${state.compare?b.length+' recorded games':'Select Compare'}</span></div></div>
   ${state.compare?`<div class="lab-compare-table">${[...new Set([...labels(),...(state.compare?.history?.labels||[])])].slice(0,30).map(k=>`<div><strong>${fmt(mean(rows(),k))}</strong><span>${escape(k)}</span><strong>${fmt(mean(b,k))}</strong></div>`).join('')}</div>`:''}
   ${state.archive.length?`<div class="lab-archive"><h3>HISTORICAL ARCHIVE</h3>${state.archive.map(item=>`<div><strong>${item.season}</strong><span>${item.history?.games?.length||0} recorded games</span><span>${fmt(mean(item.history?.games||[],state.metric))} ${escape(state.metric||'')}</span></div>`).join('')}</div>`:''}
   <p class="lab-muted">Game-log averages are calculated from the games ESPN returned, not assumed to be complete season totals. A season may be unavailable.</p></section>`;
 }
 function cardAverage(metric){
   const basketball=['nba','ncaam','ncaaw'].includes(state.sport);
   if(basketball){
     const categories=state.data?.seasonStats?.categories||[];
     const official=categories.find(c=>/^(general|averages?|per.?game)$/i.test(String(c.name||'').trim()));
     const n=Number(official?.values?.[metric]);
     if(official&&official.values?.[metric]!=null&&Number.isFinite(n))return {avg:fmt(n),avgSource:'ESPN SEASON AVG'};
   }
   const n=mean(rows(),metric);
   return n==null?{avg:null,avgSource:null}:{avg:fmt(n),avgSource:'SAMPLE AVG'};
 }
 function cardMetrics(){
   const list=rows(),last=list[0],avail=labels();
   if(state.cardMode==='live'){
     if(!state.current?.available)return [];
     const data=state.current.stats||{};
     const favored=['points','rebounds','assists','threePointers','passingYards','passingTouchdowns','rushingYards','rushingTouchdowns','receivingYards','receptions','tackles','sacks','interceptionsCaught','forcedFumbles'];
     const entries=Object.keys(data).sort((a,b)=>favored.indexOf(a)<0?1:favored.indexOf(b)<0?-1:favored.indexOf(a)-favored.indexOf(b)).slice(0,4);
     const labels={points:'PTS',rebounds:'REB',assists:'AST',threePointers:'3PM',passingYards:'PASS YDS',passingTouchdowns:'PASS TD',
       rushingYards:'RUSH YDS',rushingTouchdowns:'RUSH TD',receivingYards:'REC YDS',receptions:'REC',tackles:'TACKLES',sacks:'SACKS',interceptionsCaught:'INT'};
     const lookup={points:'PTS',rebounds:'REB',assists:'AST',threePointers:'3PM',passingYards:'PASSYDS',passingTouchdowns:'PASSTD',
        rushingYards:'RUSHYDS',rushingTouchdowns:'RUSHTD',receivingYards:'RECYDS',receivingTouchdowns:'RECTD',
        tackles:'TOT',sacks:'SACKS',receptions:'REC'};
     return entries.map(k=>({label:labels[k]||k,value:data[k],...(lookup[k]?cardAverage(lookup[k]):{avg:null,avgSource:null})}));
   }
   const selected=(currentMetrics().length?currentMetrics():avail).slice(0,4);
   const best=state.cardMode==='best'?list.reduce((a,b)=>b.stats?.[state.metric]>a?.stats?.[state.metric]?b:a,last):last;
   return selected.map(k=>({label:k,value:state.cardMode==='average'?fmt(mean(list,k)):best?.stats?.[k]??null,...cardAverage(k)}));
 }
 function cardView(){
   const player=state.data?.player||state.player||{};
   const cardStats=cardMetrics();
   return `<section class="lab-panel"><div class="lab-panel-title"><h3>PLAYER CARD STUDIO</h3><button class="lab-motion-link" data-action="lab-tab" data-value="animated">▶ ANIMATE THIS CARD ↗</button></div>
   <div class="lab-row-actions"><label>STYLE<select id="lab-theme">${['redline','silver','midnight'].map(x=>`<option value="${x}" ${state.cardTheme===x?'selected':''}>${x.toUpperCase()}</option>`).join('')}</select></label>
   <label>CARD TYPE<select id="lab-card-mode">${[...(state.currentGame?.gameId?[['live','Selected game box score']]:[]),['latest','Latest recorded game'],['average','Game-log average'],['best','Best game in sample']].map(([id,name])=>`<option value="${id}" ${state.cardMode===id?'selected':''}>${name}</option>`).join('')}</select></label>
   <button data-action="lab-export-png">↓ DOWNLOAD PNG</button></div>
   <div class="lab-card-preview theme-${escape(state.cardTheme)}"><div class="lab-card-brand">LIVE<span>STAT</span><small>PERFORMANCE CARD</small></div>
    <div class="lab-card-hero">${player.headshot?`<img alt="" src="/api/analytics/headshot?url=${encodeURIComponent(player.headshot)}" onerror="this.style.display='none'" />`:''}<div><small>${escape(player.team||'TEAM DATA UNAVAILABLE')}</small><h2>${escape(player.name||'PLAYER')}</h2><p>${escape(player.position||sports[state.sport])}</p></div></div>
    <div class="lab-card-metrics">${cardStats.map(x=>`<div><strong>${escape(x.value??'—')}</strong><small>${escape(x.label)}</small>${x.avg!=null?`<small>${escape(x.avgSource||'SAMPLE AVG')} ${escape(x.avg)}</small>`:''} </div>`).join('')}</div>
    <footer>ESPN UNOFFICIAL · ${escape(state.season)} · ${escape(state.cardMode.toUpperCase())}</footer></div>
   <p class="lab-muted">${state.cardMode==='live'?(state.current?.available?'From selected-game ESPN box score · '+escape(state.current.status||'Game status unavailable'):'No selected-game box-score stats available yet.'):'Based on recorded games. Comparison values use ESPN season averages where clearly identified for basketball; otherwise they use available game-log sample averages.'} Headshots appear only when provided by ESPN.</p></section>`;
 }
 function formulaView(){
   const game=latest(),res=state.formulaResult;
   return `<section class="lab-panel"><div class="lab-panel-title"><h3>CUSTOM STAT FORMULA LAB</h3><span>NO CODE REQUIRED</span></div>
     <p>Create a custom index using the stat columns available for this player. Example: <code>PTS + REB + AST</code>, or <code>(PTS + 2 * AST) / 3</code>.</p>
     <div class="lab-row-actions"><label class="lab-flex">FORMULA<input id="lab-formula" spellcheck="false" value="${escape(state.formula)}" /></label><button data-action="lab-formula-run">CALCULATE</button></div>
     <div class="lab-metric-picks">${labels().map(k=>`<button data-action="lab-formula-insert" data-metric="${escape(k)}">${escape(k)}</button>`).join('')}</div>
     ${res?`<div class="lab-formula-result ${res.error?'error':''}"><small>${res.error?'CHECK FORMULA':'LATEST RECORDED GAME'}</small><strong>${escape(res.error||res.value)}</strong></div>`:''}
     <p class="lab-muted">Available fields: ${escape(labels().join(', ')||'No stats returned')}. Formulas operate on the most recently recorded game and support +, −, ×, ÷, parentheses, and numerical constants.</p></section>`;
 }
 function analystView(){
   const a=state.report?.analysis;
   return `<section class="lab-panel"><div class="lab-panel-title"><h3>GAME ANALYST</h3>${metricOptions()}</div>
    <p>Explain what the actual game logs say about a player's form. Statistical mode is free. Optional AI-generated wording requires a configured server-side OpenAI API key.</p>
    <div class="lab-row-actions"><button data-action="lab-analyze" ${state.reportLoading?'disabled':''}>GENERATE DATA-GROUNDED REPORT</button><button data-action="lab-analyze-ai" ${state.reportLoading?'disabled':''}>TRY AI EXPLANATION</button></div>
    ${state.reportLoading?'<div class="lab-empty">Evaluating the available recorded games…</div>':''}
    ${a?`<div class="lab-analysis"><small>${state.report.mode==='ai'?'AI EXPLANATION · EVIDENCE PROVIDED':'STATISTICAL ANALYSIS · NO LLM'}</small><p>${escape(a.summary)}</p><footer>${a.gameCount??0} available games in the selected season · Data: ESPN (unofficial)</footer></div>`:''}
    ${state.report?.warning?`<p class="lab-warning">${escape(state.report.warning)}</p>`:''}
    <div class="lab-evidence">${series().slice(0,10).map(g=>`<span>${escape(g.opponent||g.date?.slice(0,10)||'Game')}: <strong>${escape(g.value)} ${escape(state.metric)}</strong></span>`).join('')}</div>
   </section>`;
 }
 function render(){
   if(!state.player)return `<div class="lab-root">${heading()}${chooser()}<div class="lab-empty">Choose a player from search, a saved alert, or the Arena roster to begin. Pick seasons to research recorded performances.</div></div>`;
   return `<div class="lab-root">${heading()}${chooser()}${seasonControls()}${profileTop()}${tabs()}
     ${state.loading&&!state.data?'<div class="lab-empty">Loading ESPN game logs and season statistics…</div>':
       state.tab==='dashboard'?dashboard():state.tab==='history'?history():state.tab==='seasons'?seasons():state.tab==='cards'?cardView():state.tab==='animated'?motion.render():state.tab==='formula'?formulaView():analystView()}
     ${(state.data?.feedWarnings||[]).length?`<p class="lab-warning">${escape(state.data.feedWarnings.join(' · '))}</p>`:''}
     <p class="lab-footer">Unofficial ESPN data; availability differs across sports, players and seasons. Live predictions are not implied. Dashboard layouts are stored locally.</p></div>`;
 }
 async function load(){
   if(!state.player)return;
   const identity=state.sport+':'+state.player.id,year=state.season;
   state.loading=true;state.error='';refresh();
   try{
     const x=await api('/api/analytics/player?sport='+encodeURIComponent(state.sport)+'&athlete='+encodeURIComponent(state.player.id)+'&season='+year);
     if(identity!==state.sport+':'+state.player?.id||year!==state.season)return;
     state.data=x.analytics;state.player={...state.player,...Object.fromEntries(Object.entries(x.analytics.player||{}).filter(([,v])=>v!=null&&v!==''))};
     ensureMetrics();state.report=null;state.formulaResult=null;
     if(state.currentGame?.gameId&&state.currentGame?.teamId){
       try{
         const current=await api('/api/analytics/current?sport='+encodeURIComponent(state.sport)+'&game='+encodeURIComponent(state.currentGame.gameId)+'&team='+encodeURIComponent(state.currentGame.teamId)+'&athlete='+encodeURIComponent(state.player.id));
         if(identity===state.sport+':'+state.player?.id&&year===state.season)state.current=current.current;
       }catch{state.current=null}
     }
   }catch(e){state.error=e.message||String(e);state.data=null;toast(state.error)}
   finally{state.loading=false;refresh()}
 }
 async function search(){
   const term=state.search.trim();
   if(!term){state.results=[];refresh();return}
   if(/^\d{1,14}$/.test(term)){openPlayer({id:term,name:'ESPN Player '+term},state.sport);return}
   if(term.length<2)return toast('Enter at least 2 characters');
   state.searching=true;state.results=[];state.error='';refresh();
   try{const d=await api('/api/analytics/search?sport='+state.sport+'&q='+encodeURIComponent(term));state.results=d.players||[];
     if(!state.results.length)state.error='No ESPN athlete matches. Try another spelling or select a player from Arena.'}
   catch(e){state.error=e.message||String(e)}
   finally{state.searching=false;refresh()}
 }
 function openPlayer(player,sport,context=null){
   if(!player?.id)return;
   state.sport=sport||state.sport;state.player={...player};state.currentGame=context;state.current=null;state.cardMode=context?.gameId?'live':'latest';
   state.data=null;state.compare=null;state.archive=[];state.activeLayout=null;state.metrics=[];state.metric=null;
   state.tab='dashboard';state.results=[];state.search='';state.error='';
   state.season=['nba','ncaam','ncaaw'].includes(state.sport)?yearNow+(new Date().getUTCMonth()>=6?1:0):yearNow;
   state.compareSeason=state.season-1;refresh();return load();
 }
 async function compare(){
   if(!state.player)return;state.comparisonLoading=true;refresh();
   try{
    const d=await api('/api/analytics/player?sport='+state.sport+'&athlete='+state.player.id+'&season='+state.compareSeason);
    state.compare=d.analytics;
   }catch(e){toast(e.message||String(e))}
   finally{state.comparisonLoading=false;refresh()}
 }
 async function archive(){
   if(!state.player)return;state.comparisonLoading=true;refresh();
   const years=Array.from({length:4},(_,i)=>state.season-i);
   const result=await Promise.allSettled(years.map(y=>api('/api/analytics/player?sport='+state.sport+'&athlete='+state.player.id+'&season='+y)));
   state.archive=result.filter(x=>x.status==='fulfilled').map(x=>x.value.analytics);
   state.comparisonLoading=false;refresh();toast('Archive checked: '+state.archive.length+' seasons returned');
 }
 async function report(ai=false){
   if(!state.player||!state.metric)return;
   state.reportLoading=true;state.report=null;refresh();
   try{state.report=await api('/api/analytics/analyst','POST',{sport:state.sport,athlete:state.player.id,season:state.season,metric:state.metric,ai})}
   catch(e){toast(e.message||String(e))}
   finally{state.reportLoading=false;refresh()}
 }
 function persist(){try{localStorage.setItem('livestat-lab-layouts',JSON.stringify(state.savedLayouts.slice(-40)))}catch{}}
 function toggleMetric(metric){
   const current=[...currentMetrics()];
   state.activeLayout=null;
   state.metrics=current.includes(metric)?current.filter(k=>k!==metric):[...current,metric].slice(0,12);
   refresh();
 }
 function shiftMetric(metric,direction){
   const items=[...currentMetrics()],index=items.indexOf(metric);if(index<0)return;
   const next=index+direction;if(next<0||next>=items.length)return;
   [items[index],items[next]]=[items[next],items[index]];
   state.activeLayout=null;state.metrics=items;refresh();
 }
 function saveLayout(){
   if(!state.metrics.length&&!(state.activeLayout?.metrics?.length))return toast('Choose at least one statistic');
   const layout={id:String(Date.now()),name:state.layoutName.trim().slice(0,42)||'Custom Layout',sport:state.sport,metrics:[...currentMetrics()]};
   state.savedLayouts.push(layout);state.activeLayout=layout;state.metrics=[...layout.metrics];persist();refresh();toast('Dashboard preset saved on this device');
 }
 function csv(){
   if(!rows().length)return toast('No game history to export');
   const columns=['date','opponent','result',...labels()];
   const quoted=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
   const body=[columns.map(quoted).join(','),...rows().map(g=>columns.map(k=>quoted(k in g?g[k]:g.stats?.[k]??'')).join(','))].join('\r\n');
   const blob=new Blob([body],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download='livestat-'+state.player.id+'-'+state.season+'.csv';document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),10000);
 }
 async function png(){
   if(!state.data||(!rows().length&&state.cardMode!=='live'))return toast('No recorded stats for a card');
   if(state.cardMode==='live'&&!state.current?.available)return toast('Selected-game box score not available yet');
   try{
     const {exportPlayerCard}=await import('./analytics-card.js');
     const player={...state.player,...state.data.player};
     const metrics=cardMetrics();
     await exportPlayerCard({player,sport:state.sport,season:state.season,theme:state.cardTheme,metrics,
       title:state.cardMode==='live'?'SELECTED GAME BOX SCORE':state.cardMode==='average'?'GAME LOG AVERAGE':state.cardMode==='best'?'SEASON BEST':'LATEST RECORDED GAME',
       filename:'livestat-'+state.player.name+'-'+state.season});
     toast('Player card PNG created');
   }catch(e){toast(e.message||'Card export failed')}
 }
 function runFormula(){
   const base=latest()?.stats||{};
   try{
     // Imported pure parser through the main browser module.
     state.formulaResult={value:calculateFormula(state.formula,base)};
   }catch(e){state.formulaResult={error:e.message||String(e)}}
   refresh();
 }
 function handle(action,node){
   if(motion.handle(action,node))return true;
   const v=node.dataset.value;
   if(action==='lab-tab'){state.tab=v;refresh();return true}
   if(action==='lab-search'){search();return true}
   if(action==='lab-player'){const p=state.results.find(p=>p.id===node.dataset.player);if(p)openPlayer(p,state.sport);return true}
   if(action==='lab-favorite'){const w=getWatches().find(w=>w.id===node.dataset.watch);if(w)openPlayer({id:w.playerId,name:w.name,position:w.position},w.sport);return true}
   if(action==='lab-reload'){load();return true}
   if(action==='lab-compare'){compare();return true}
   if(action==='lab-archive'){archive();return true}
   if(action==='lab-layout-save'){saveLayout();return true}
   if(action==='lab-layout-delete'){
     state.savedLayouts=state.savedLayouts.filter(x=>x.id!==state.activeLayout?.id);
     state.activeLayout=null;persist();refresh();return true;
   }
   if(action==='lab-metric-toggle'){toggleMetric(node.dataset.metric);return true}
   if(action==='lab-up'){shiftMetric(node.dataset.metric,-1);return true}
   if(action==='lab-down'){shiftMetric(node.dataset.metric,1);return true}
   if(action==='lab-export-png'){png();return true}
   if(action==='lab-formula-run'){runFormula();return true}
   if(action==='lab-formula-insert'){state.formula=(state.formula.trim()?state.formula+' + ':'')+node.dataset.metric;refresh();return true}
   if(action==='lab-analyze'){report(false);return true}
   if(action==='lab-analyze-ai'){report(true);return true}
   if(action==='lab-csv'){csv();return true}
   return false;
 }
 function input(node){
   if(motion.input(node))return true;
   const v=node.value;
   if(node.id==='lab-search'){state.search=v;return true}
   if(node.id==='lab-sport'){state.sport=v;state.results=[];state.data=null;state.player=null;state.metrics=[];state.season=yearNow;refresh();return true}
   if(node.id==='lab-season'){state.season=Number(v);state.metrics=[];load();return true}
   if(node.id==='lab-compare-year'){state.compareSeason=Number(v);return true}
   if(node.id==='lab-metric'){state.metric=v;state.report=null;refresh();return true}
   if(node.id==='lab-theme'){state.cardTheme=v;refresh();return true}
   if(node.id==='lab-card-mode'){state.cardMode=v;refresh();return true}
   if(node.id==='lab-layout-name'){state.layoutName=v;return true}
   if(node.id==='lab-formula'){state.formula=v;return true}
   if(node.id==='lab-layout'){
     const layout=state.savedLayouts.find(x=>x.id===v&&x.sport===state.sport);
     state.activeLayout=layout||null;
     if(layout)state.metrics=[...layout.metrics];
     refresh();return true;
   }
   return false;
 }
 return {state,render,openPlayer,handle,input,load,afterRender:()=>{if(state.tab==='animated')motion.afterRender()}};
}
