import {createAnalyticsLab} from './analytics-lab.js';
import {calculateFormula} from './formula.js';
import {positionOptions,filterRoster} from './roster-select.js';
import {FOOTBALL_PLAYER_STATS,footballStatsForPosition} from './football-stats.js';
import {createInsights} from './intelligence-ui.js';
import {boxscoreMarkup} from './boxscore.js';
import {createRosterBrowser} from './roster-browser.js';
const $ = (s,root=document)=>root.querySelector(s);
/* UI init selector fixes: querySelectorAll for collections; keep startup regression test */
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const leagues={nfl:{name:'NFL',short:'PRO FOOTBALL',icon:'🏈',code:'01'},nba:{name:'NBA',short:'PRO BASKETBALL',icon:'🏀',code:'02'},cfb:{name:'COLLEGE FOOTBALL',short:'NCAA FOOTBALL',icon:'🏈',code:'03'},ncaam:{name:'COLLEGE BASKETBALL',short:'NCAA MEN',icon:'🏀',code:'04'},ncaaw:{name:'WOMEN’S COLLEGE HOOPS',short:'NCAA WOMEN',icon:'🏀',code:'05'}};
const labels={points:'Points',rebounds:'Rebounds',assists:'Assists',steals:'Steals',blocks:'Blocks',threePointers:'3-pointers',turnovers:'Turnovers',targets:'Targets',receivingYards:'Receiving yards',receptions:'Receptions',receivingTouchdowns:'Receiving TDs',fumbles:'Fumbles',touchdowns:'Touchdowns',fieldGoals:'Field goals',redZoneEntries:'Red-zone entries',scoringDrives:'Scoring drives',turnovers:'Turnovers',sacks:'Sacks allowed',interceptions:'Interceptions'};
Object.assign(labels,FOOTBALL_PLAYER_STATS);
const options={bbPlayer:['points','rebounds','assists','threePointers','steals','blocks','turnovers'],bbTeam:['points','threePointers'],fbPlayer:['targets','receivingYards','receptions','receivingTouchdowns','fumbles'],fbTeam:['touchdowns','fieldGoals','redZoneEntries','scoringDrives','turnovers','sacks','interceptions','fumbles']};
const sportVisuals={nfl:'sport-nfl.jpg',nba:'sport-nba.jpg',cfb:'sport-cfb.jpg',ncaam:'sport-cbb.jpg',ncaaw:'sport-cbb.jpg'};
const teamPalette={LAL:'#ffd65b',GSW:'#22a7ff',BOS:'#00a879',NYK:'#fa812b',PHX:'#ee702e',DEN:'#62aaff',MIA:'#d71d47',MIL:'#19ab6a',NO:'#d6af63',ATL:'#d8343a',DAL:'#45aaff',GB:'#e6b74d',ALA:'#bf2136',UGA:'#cf2432',DUKE:'#2877ff',UNC:'#60b5ed',SC:'#9a1b4a',CONN:'#75a5d8'};
const teamHue=x=>'#f43c4d';
const teamFace=x=>`<span class="team-mark" style="--team-color:${teamHue(x)}">${esc(x?.abbr||'--')}</span>`;
const demoGames={nba:[{id:'401000001',sport:'nba',name:'Los Angeles Lakers at Golden State Warriors',status:'7:30 PM ET',state:'pre',date:'2026-10-21T23:30:00Z',teams:[{id:'13',abbr:'LAL',name:'Los Angeles Lakers',homeAway:'away',score:'0'},{id:'9',abbr:'GSW',name:'Golden State Warriors',homeAway:'home',score:'0'}]},{id:'401000002',sport:'nba',name:'Boston Celtics at New York Knicks',status:'8:00 PM ET',state:'pre',teams:[{id:'2',abbr:'BOS',name:'Boston Celtics',homeAway:'away',score:'0'},{id:'18',abbr:'NYK',name:'New York Knicks',homeAway:'home',score:'0'}]},{id:'401000003',sport:'nba',name:'Phoenix Suns at Denver Nuggets',status:'Q3 · 05:43',state:'in',teams:[{id:'21',abbr:'PHX',name:'Phoenix Suns',homeAway:'away',score:'78'},{id:'7',abbr:'DEN',name:'Denver Nuggets',homeAway:'home',score:'82'}]},{id:'401000004',sport:'nba',name:'Miami Heat at Milwaukee Bucks',status:'Tomorrow 7:00 PM ET',state:'pre',teams:[{id:'14',abbr:'MIA',name:'Miami Heat',homeAway:'away',score:'0'},{id:'15',abbr:'MIL',name:'Milwaukee Bucks',homeAway:'home',score:'0'}]}],nfl:[{id:'401001001',sport:'nfl',name:'New Orleans Saints at Atlanta Falcons',status:'SUN · 1:00 PM',state:'pre',teams:[{id:'18',abbr:'NO',name:'New Orleans Saints',homeAway:'away',score:'0'},{id:'1',abbr:'ATL',name:'Atlanta Falcons',homeAway:'home',score:'0'}]},{id:'401001002',sport:'nfl',name:'Dallas Cowboys at Green Bay Packers',status:'SUN · 8:20 PM',state:'pre',teams:[{id:'6',abbr:'DAL',name:'Dallas Cowboys',homeAway:'away',score:'0'},{id:'9',abbr:'GB',name:'Green Bay Packers',homeAway:'home',score:'0'}]}],cfb:[{id:'401002001',sport:'cfb',name:'Alabama at Georgia',status:'SAT · 3:30 PM',state:'pre',teams:[{id:'333',abbr:'ALA',name:'Alabama Crimson Tide',homeAway:'away',score:'0'},{id:'61',abbr:'UGA',name:'Georgia Bulldogs',homeAway:'home',score:'0'}]}],ncaam:[{id:'401003001',sport:'ncaam',name:'Duke at North Carolina',status:'SAT · 7:00 PM',state:'pre',teams:[{id:'150',abbr:'DUKE',name:'Duke Blue Devils',homeAway:'away',score:'0'},{id:'153',abbr:'UNC',name:'North Carolina Tar Heels',homeAway:'home',score:'0'}]}],ncaaw:[{id:'401004001',sport:'ncaaw',name:'South Carolina at Connecticut',status:'SUN · 3:00 PM',state:'pre',teams:[{id:'2579',abbr:'SC',name:'South Carolina Gamecocks',homeAway:'away',score:'0'},{id:'41',abbr:'CONN',name:'UConn Huskies',homeAway:'home',score:'0'}]}]};
const demoPlayers={'13':[{id:'1966',name:'LeBron James',position:'F',teamId:'13'}, {id:'9990001',name:'Luka Dončić',position:'G',teamId:'13'},{id:'9990002',name:'Austin Reaves',position:'G',teamId:'13'}], '9':[{id:'3975',name:'Stephen Curry',position:'G',teamId:'9'},{id:'9990003',name:'Jimmy Butler',position:'F',teamId:'9'}],'18':[{id:'9990011',name:'Chris Olave',position:'WR',teamId:'18'}, {id:'9990012',name:'Alvin Kamara',position:'RB',teamId:'18'}], '333':[{id:'9990021',name:'Demo Quarterback',position:'QB',teamId:'333'}], '150':[{id:'9990031',name:'Demo Guard',position:'G',teamId:'150'}],'2579':[{id:'9990041',name:'Demo Forward',position:'F',teamId:'2579'}]};
const previewMode=new URLSearchParams(location.search).get('preview')==='1';
const s={boxscoreGame:null,boxscoreData:null,boxscoreLoading:false,boxscoreError:'',boxscoreTeam:null,preview:previewMode,authorized:true,tab:'arena',step:0,sport:null,game:null,gameDate:new Date(),filter:'all',team:null,roster:[],player:null,kind:'player',rules:{},discord:{configured:false,enabled:false,types:['target']},smart:{combine:'off',near:0,periodMin:0,maxMargin:null},watchList:[],alerts:[],config:null,loading:false,error:'',search:'',rosterGroup:null};
const app=$('#app');let toastTimer;
const intelligence=createInsights({api,escape:esc,refresh:()=>{if(['insights','command','league'].includes(s.tab))render()},getWatches:()=>s.watchList,getAlerts:()=>s.alerts});
const analytics=createAnalyticsLab({api,refresh:()=>{if(s.tab==='analytics')render()},toast,getWatches:()=>s.watchList,calculateFormula});
const rosterBrowser=createRosterBrowser({
 api,refresh:()=>{if(s.tab==='rosters')render()},toast,
 onAnalytics:(player,sport,ctx)=>{
   s.tab='analytics';
   analytics.openPlayer({...player,team:ctx.team?.name||player.team,
     teamAbbr:ctx.team?.abbreviation||'',teamColor:ctx.team?.color||''},sport);
   render();
 },
 onTrack:sport=>selectSport(sport)
});
function toast(msg){const e=$('#toast');e.textContent=msg;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),3700)}
const isBB=()=>['nba','ncaam','ncaaw'].includes(s.sport);
const configuredStats=()=>!isBB()&&s.kind==='player'?(s.showAllFootballStats?Object.keys(FOOTBALL_PLAYER_STATS):footballStatsForPosition(s.player?.position)):options[(isBB()?'bb':'fb')+(s.kind==='team'?'Team':'Player')];
const gameTeams=()=>s.game?.teams||[];
const playerInitials=p=>(p?.name||'PLAYER').split(' ').map(x=>x[0]).slice(0,2).join('');
const dateCode=()=>`${s.gameDate.getFullYear()}${String(s.gameDate.getMonth()+1).padStart(2,'0')}${String(s.gameDate.getDate()).padStart(2,'0')}`;
const prettyDate=()=>s.gameDate.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();
async function api(path,method='GET',data){const r=await fetch(path,{method,credentials:'same-origin',headers:{...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});const result=await r.json();if(!r.ok)throw Error(result.error||`HTTP ${r.status}`);return result}
function navigatorUI(){const labels=['SPORT','GAME','PLAYER','ALERTS'];const descriptions=['CHOOSE ARENA','SELECT MATCHUP','PICK ATHLETE','BUILD LOADOUT'];return `<div class="step-strip">${labels.map((v,i)=>`<button class="step ${i===s.step?'active':i<s.step?'passed':''}" data-action="step" data-step="${i}" ${i>s.step?'disabled':''}><span class="step-num">${i<s.step?'✓':String(i+1).padStart(2,'0')}</span><span><strong>${v}</strong><small>${descriptions[i]}</small></span></button>`).join('')}</div>`}
function header(eyebrow,title,highlight,subtitle,showSteps=true){return `<div class="hud-heading"><span class="hud-notch"></span><span class="eyebrow">${eyebrow}</span><h1 class="display-title">${title} <em>${highlight}</em></h1><p class="subtitle">${subtitle}</p></div>${showSteps?navigatorUI():''}`}
function ribbon(){return s.preview?`<div class="preview-ribbon">◈ INTERACTIVE DESIGN DEMO — Example matchups and players; alerts shown here are simulated, not live data.</div>`:''}
function sportView(){return `${ribbon()}
<section class="cinema-hero"><div class="hero-photo"></div><div class="hero-text"><span class="hud-mini">⚡ LIVESTAT / PLAYER TRACKING</span><h2>THE GAME.<br><em>YOUR MOMENTS.</em></h2><p>Every play. Every milestone. Your favorite players, on your terms.</p><div class="hero-features"><span>◉ PER-PLAY</span><span>◎ MILESTONES</span><span>▰ LIVE FEED</span></div></div><span class="hero-slides"><b></b><i></i><i></i></span></section>
${header('01 / SELECT YOUR ARENA','SELECT','SPORT','Choose a league to start your alert journey.',false)}
<div class="sport-grid cinematic-sports">${Object.entries(leagues).map(([id,x])=>`<button class="sport-card sport-${id}" data-sport="${id}" data-action="sport" aria-label="Open ${esc(x.name)} games"><span class="sport-image"></span><span class="sport-glass"></span><span class="sport-index">${x.code} / LIVESTAT ARENA</span><span class="sport-content"><span class="sport-overline">${esc(x.short)}</span><strong>${esc(x.name)}</strong><small>SELECT MATCHUP &nbsp;•&nbsp; BUILD ALERTS</small></span><span class="sport-chevron">➜</span></button>`).join('')}</div>
<div class="arena-footer"><span>5 LEAGUES</span><span>2 ALERT MODES</span><span>FREE DATA / UPGRADE READY</span></div>`}
function formatStatus(g){if(g.state==='in')return `<span class="live">● LIVE · ${esc(g.status)}</span>`;if(g.state==='post')return `<span class="post">FINAL · ${esc(g.status)}</span>`;return `<span class="pre">◈ ${esc(g.status||'SCHEDULED')}</span>`}
function gameView(){const gs=(s.filter==='all'?s.games||[]:(s.games||[]).filter(g=>s.filter==='live'?g.state==='in':g.state!=='in'&&g.state!=='post'));
return `${ribbon()}<div class="route-pill"><span>${esc(leagues[s.sport]?.name||'SPORT')}</span><b>›</b><span>SELECT GAME</span></div>${header('02 / MATCHUP SELECT','SELECT','GAME','Select a matchup to open the game roster.')}
<div class="toolbar arena-toolbar"><div class="tab-row">${[['all','ALL GAMES'],['live','● LIVE'],['upcoming','UPCOMING']].map(([id,t])=>`<button class="chip ${s.filter===id?'active':''}" data-action="filter" data-filter="${id}">${t}</button>`).join('')}</div>${!s.preview?`<div class="date-tools"><button data-action="date" data-days="-1" aria-label="Previous day">‹</button>${prettyDate()}<button data-action="date" data-days="1" aria-label="Next day">›</button></div>`:'<div class="date-tools">DEMO FIXTURES</div>'}</div>
${s.error?`<div class="notice-card"><strong>Feed unavailable:</strong> ${esc(s.error)}</div>`:''}
<div class="games-grid arena-matchups">${s.loading?'<div class="empty-card">Loading matchups…</div>':gs.length?gs.map((g,i)=>{const t=g.teams||[],away=t[0],home=t[1];return `<div class="bs-game-wrap"><button class="game-card cinematic-game" style="--away-color:#ed263c;--home-color:#f2f2f5" data-action="game" data-game="${esc(g.id)}" aria-label="${esc(g.name)}"><span class="game-art"></span><div class="game-meta"><span>MATCHUP ${String(i+1).padStart(2,'0')} // ${esc(leagues[s.sport].short)}</span>${formatStatus(g)}</div><div class="game-players"><div class="game-team away">${teamFace(away)}<strong>${esc(away?.abbr||'AWAY')}</strong><small>${esc(away?.name||'')}</small></div><div class="game-vs"><span>VS</span><small>${g.state==='in'||g.state==='post'?esc(t.map(z=>z.score).join(' - ')):'SELECT GAME'}</small></div><div class="game-team home">${teamFace(home)}<strong>${esc(home?.abbr||'HOME')}</strong><small>${esc(home?.name||'')}</small></div></div><div class="game-footer"><span>${esc(g.status||'SCHEDULED')}</span><span>ENTER MATCHUP &nbsp; ➜</span></div></button><div class="ls-game-actions"><button class="bs-open" data-action="boxscore" data-game="${esc(g.id)}">▤ BOX SCORE <span>↗</span></button><button class="bs-open" data-action="intelgame" data-game="${esc(g.id)}">◈ GAME CENTER <span>↗</span></button></div></div>`}).join(''):`<div class="empty-card">No games found for this date. Try another date or filter.</div>`}</div>`}

function demoBoxScore(game){
 const basketball=['nba','ncaam','ncaaw'].includes(s.sport);
 const teams=game.teams.map(t=>({...t,stats:basketball?[
   {name:'fieldGoalPct',label:'FG%',value:t.homeAway==='away'?'46.2':'48.8'},
   {name:'rebounds',label:'Rebounds',value:t.homeAway==='away'?'39':'42'},
   {name:'assists',label:'Assists',value:t.homeAway==='away'?'22':'25'}
 ]:[{name:'totalYards',label:'Total Yards',value:'321'},{name:'firstDowns',label:'First Downs',value:'19'}]}));
 const groups=teams.map((team,i)=>{
   const names=basketball?(i===0?['LeBron James','Luka Dončić','Austin Reaves']:['Stephen Curry','Jimmy Butler','Draymond Green']):(i===0?['Starting QB','Starting RB','Starting WR']:['Opposing QB','Opposing RB','Opposing WR']);
   const labels=basketball?['MIN','FG','3PT','FT','REB','AST','STL','BLK','TO','PTS']:['REC','YDS','AVG','TD','LONG','TGTS'];
   const stats=basketball?[['34','8-17','2-5','3-3','7','8','1','0','3','21'],['33','7-16','3-8','4-4','6','5','2','0','2','21'],['28','4-9','2-4','2-2','3','3','1','0','1','12']]:[['6','88','14.7','1','32','8'],['4','52','13.0','0','21','5'],['3','41','13.7','0','18','4']];
   return {teamId:String(team.id),sections:[{name:basketball?'Game Statistics':'Receiving',labels,rows:names.map((name,n)=>({id:'demo'+n,name,position:basketball?'G':'WR',stats:stats[n]})),totals:[]}]};
 });
 return {sport:s.sport,gameId:String(game.id),teams,groups,hasStats:true,state:game.state,status:game.status};
}
function renderBoxScore(){return boxscoreMarkup({game:s.boxscoreGame,boxscore:s.boxscoreData,sport:s.sport,loading:s.boxscoreLoading,error:s.boxscoreError,selectedTeam:s.boxscoreTeam,preview:s.preview})}
async function refreshBoxScore(){
 if(!s.boxscoreGame||s.boxscoreLoading||s.preview)return;
 const gameId=String(s.boxscoreGame.id),sport=s.sport;
 s.boxscoreLoading=true;
 try{
   const result=await api('/api/boxscore?sport='+encodeURIComponent(sport)+'&game='+encodeURIComponent(gameId));
   if(!s.boxscoreGame||String(s.boxscoreGame.id)!==gameId||s.sport!==sport)return;
   s.boxscoreData=result.boxscore;
   s.boxscoreError='';
 }catch(err){if(s.boxscoreGame&&String(s.boxscoreGame.id)===gameId)s.boxscoreError=err.message}
 finally{
   if(s.boxscoreGame&&String(s.boxscoreGame.id)===gameId){s.boxscoreLoading=false;render()}
 }
}
async function openBoxScore(id){
 const game=(s.games||[]).find(g=>String(g.id)===String(id));
 if(!game)return;
 s.boxscoreGame=game;
 s.boxscoreTeam=String(game.teams?.[0]?.id||'');
 s.boxscoreData=null;s.boxscoreError='';s.boxscoreLoading=false;
 setTab('arena');
 if(s.preview){s.boxscoreData=demoBoxScore(game);render();return}
 await refreshBoxScore();
}
function closeBoxScore(){s.boxscoreGame=null;s.boxscoreData=null;s.boxscoreError='';s.boxscoreLoading=false;setTab('arena')}
function trackFromBoxScore(){const gameId=s.boxscoreGame?.id;closeBoxScore();if(gameId)selectGame(String(gameId))}

function matchup(){let t=gameTeams();return `<div class="matchup-strip"><div><small>ACTIVE MATCHUP / ${esc(leagues[s.sport].name)}</small><div><strong>${esc(t[0]?.abbr||'AWAY')} <span style="color:#69bcff">VS</span> ${esc(t[1]?.abbr||'HOME')}</strong></div></div><div style="text-align:right"><small>${formatStatus(s.game)}</small></div></div>`}
function selectTeamView(){const t=gameTeams();return `${ribbon()}${header('03 / ROSTER SELECT','SELECT A','PLAYER','Select a position group, then choose a player. Starters and stat leaders appear first when ESPN provides rankings.')}${matchup()}<div class="toolbar"><div class="tab-row">${t.map(x=>`<button class="chip ${s.team?.id===x.id?'active':''}" data-action="team" data-team="${esc(x.id)}">${esc(x.abbr)} ROSTER</button>`).join('')}</div><div class="ls-roster-sort-label">ESPN DEPTH CHART / TEAM LEADERS</div></div><label class="search-field"><span>⌕</span><input type="search" id="player-search" value="${esc(s.search)}" placeholder="Search across players and positions..." autocomplete="off" /></label><div id="roster-results">${rosterSection()}</div>${s.team?`<button class="team-pick" data-action="trackteam"><span><strong>TRACK ${esc(s.team.name.toUpperCase())}</strong><small>Set alerts for team totals and team events instead</small></span><span>↗</span></button>`:''}`;}
function rosterSection(){
  if(s.loading)return '<div class="empty-card">Loading team roster and ESPN rankings…</div>';
  if(s.error)return '<div class="empty-card">'+esc(s.error)+'</div>';
  const groups=positionOptions(s.roster,s.sport);
  if(!s.rosterGroup&&!s.search.trim()){
    return `<div class="ls-position-heading"><div><span>ROSTER / STEP 01</span><h2>CHOOSE A POSITION</h2><p>Choose a position group to browse its players.</p></div><span class="ls-position-count">${s.roster.length} TOTAL PLAYERS</span></div>
      <div class="ls-position-grid">${groups.map(g=>`<button class="ls-position-card" data-action="position" data-group="${esc(g.id)}"><span class="ls-position-icon">${g.icon}</span><span class="ls-position-text"><strong>${g.title}</strong><small>${g.subtitle}</small></span><span class="ls-position-meta"><b>${g.count}</b><small>PLAYERS</small></span><span class="ls-position-go">➜</span></button>`).join('')}</div>
      <button class="ls-show-all" data-action="position" data-group="ALL">VIEW ALL ${s.roster.length} PLAYERS <span>↗</span></button>`;
  }
  const selected=groups.find(g=>g.id===s.rosterGroup);
  const count=filterRoster(s.roster,s.sport,s.rosterGroup,s.search).length;
  return `<div class="ls-roster-heading"><button class="ls-back-position" data-action="positions">← POSITION GROUPS</button>
    <div><strong>${esc(selected?.title|| (s.search.trim()?'SEARCH RESULTS':'ALL PLAYERS'))}</strong><small>${count} PLAYERS · DEPTH / STAT LEADERS FIRST</small></div></div>
    <div class="roster-grid" id="roster-grid">${rosterCards()}</div>`;
}
function rosterCards(){
  if(s.loading)return '<div class="empty-card">Loading players…</div>';
  const filtered=filterRoster(s.roster,s.sport,s.rosterGroup,s.search);
  return filtered.length?filtered.slice(0,120).map((p,i)=>{
    const rank=p.depthRank!=null?'#'+p.depthRank+' DEPTH CHART':p.leaderRank!=null?'★ TEAM STAT LEADER':p.starter?'GAME STARTER':p.gameScore>0?'GAME PERFORMER':'';
    return `<button class="player-card ${i===0?'featured':''}" data-action="player" data-player="${esc(p.id)}">
      <div class="headshot">${!s.preview&&p.headshot?`<img src="${esc(p.headshot)}" alt="" onerror="this.style.display='none'"/>`:esc(playerInitials(p))}</div>
      <div class="player-detail"><small>${esc(p.position||'ATHLETE')}${p.jersey?' · #'+esc(p.jersey):''} / ${esc(s.team?.abbr||'TEAM')}</small><strong>${esc(p.name)}</strong><span>${rank?'<b class="ls-rank-tag">'+esc(rank)+'</b> ':''}BUILD ALERT LOADOUT →</span></div><span class="player-next">➜</span></button>`;
  }).join(''):'<div class="empty-card">No players match this position and search. Choose another position group or clear the search.</div>';
}
function defaultRules(){s.showAllFootballStats=false;const list=configuredStats();const group=!isBB()&&s.kind==='player'?String(s.player?.position||'').toUpperCase():'';const wanted=group==='QB'?'passingYards':['RB','FB','HB'].includes(group)?'rushingYards':['WR','TE'].includes(group)?'receivingYards':'tackles';const key=list.includes(wanted)?wanted:list[0];s.rules=Object.fromEntries(list.map(k=>[k,{every:k===key,target:k==='points'?15:null}]));s.smart={combine:'off',near:0,periodMin:0,maxMargin:null}}
function profileView(){const x=s.kind==='player'?s.player:s.team;const basketball=isBB();const title=s.kind==='player'?'PLAYER LOADOUT':'TEAM LOADOUT';const statCols=configuredStats();const first=statCols[0],rule=s.rules[first]||{};const target=rule.target;
return `${ribbon()}${header('04 / ALERT LOADOUT','CUSTOMIZE','ALERTS','Build your personal alert loadout. Both per-play updates and special targets can be active at once.')}
<div class="loadout-head arena-loadout-head"><div class="loadout-avatar">${s.kind==='player'&&!s.preview&&x?.headshot?`<img src="${esc(x.headshot)}" alt="" />`:esc(s.kind==='team'?(s.team?.abbr||'T'):playerInitials(x))}</div><div class="loadout-name"><small>${title} / ${esc(leagues[s.sport].short)}</small><h2>${esc(x?.name||'Choose an athlete')}</h2><span>${esc(s.kind==='player'?(x?.position||'ATHLETE'):'TEAM TOTALS')} &nbsp;·&nbsp; ${esc(s.team?.abbr||'')} &nbsp;·&nbsp; ${esc(s.game?.name||'')}</span>${s.kind==='player'?`<button class="btn-secondary" data-action="intelprofile" data-athlete="${esc(s.player?.id)}">PLAYER PROFILE ↗</button><button class="btn-secondary" data-action="labfromplayer">ANALYTICS LAB ↗</button>`:''} </div></div>
${!basketball&&s.kind==='player'? `<div class="ls-position-summary"><span>POSITION: <strong>${esc(s.player?.position||'UNKNOWN')}</strong></span><span>${s.showAllFootballStats?'ALL FOOTBALL STATS':'RECOMMENDED FOR THIS POSITION'}</span><button data-action="footballall">${s.showAllFootballStats?'SHOW POSITION STATS':'SHOW ALL STATS'}</button><small>${['DE','DT','NT','DL','EDGE','LB','MLB','OLB','ILB','CB','DB','FS','SS','S'].includes(String(s.player?.position||'').toUpperCase())?'Defensive statistics are verified from ESPN box scores. Updates can be grouped or delayed.':'Stat availability and event timing depend on ESPN. You can show all stats for versatile players.'}</small></div>`:''}
<div class="loadout-layout"><div class="config-card premium-loadout"><div class="config-header"><h3>STAT TRACKER</h3><small>EVERY PLAY + SPECIAL TARGET</small></div><div class="config-columns"><span>STATISTIC</span><span>EVERY PLAY</span><span>TARGET</span></div>${statCols.map((stat,i)=>`<div class="rule"><label class="rule-name"><span class="rule-mark">${i===0?'⚡':stat==='rebounds'?'◎':stat==='assists'?'↗':stat==='receivingYards'?'⇧':'◈'}</span><span>${esc(labels[stat])}</span></label><label class="toggle-wrap switch"><input type="checkbox" data-rule-every="${stat}" ${s.rules[stat]?.every?'checked':''} aria-label="Every play alerts for ${esc(labels[stat])}"/><span></span></label><input class="target-field" type="number" data-rule-target="${stat}" min="1" max="100000" placeholder="—" inputmode="numeric" value="${s.rules[stat]?.target??''}" aria-label="Target for ${esc(labels[stat])}" /></div>`).join('')}<div class="rule-hint">⚡ One regular notification per stat per play, regardless of quantity. A 3-pointer sends <b>one +3 points</b> alert. Reaching your target also triggers a separate milestone notification once per game.</div>
<div class="ls-smart-builder"><div class="ls-smart-title"><strong>🎯 SMART ALERT BUILDER</strong><small>OPTIONAL MISSION & SITUATIONAL RULES</small></div>
<div class="ls-smart-grid">
<label>Combine targets<select data-smart="combine"><option value="off" ${s.smart.combine==='off'?'selected':''}>Separate milestones only</option><option value="all" ${s.smart.combine==='all'?'selected':''}>ALL targets must be reached</option><option value="any" ${s.smart.combine==='any'?'selected':''}>ANY target is reached</option></select></label>
<label>Almost-there warning<select data-smart="near">${[0,1,2,3,5,10].map(v=>`<option value="${v}" ${s.smart.near===v?'selected':''}>${v===0?'Off':v+' units before target'}</option>`).join('')}</select></label>
<label>Only combine from quarter<select data-smart="periodMin">${[0,2,3,4,5].map(v=>`<option value="${v}" ${s.smart.periodMin===v?'selected':''}>${v===0?'Any period':'Q'+v+' or later'}</option>`).join('')}</select></label>
<label>Maximum score margin<select data-smart="maxMargin">${[null,3,5,8,10,14].map(v=>`<option value="${v??''}" ${s.smart.maxMargin===v?'selected':''}>${v==null?'Any margin':'Within '+v+' points'}</option>`).join('')}</select></label>
</div><p>Combined mission alerts trigger once per game when eligible targets are reached. Margin filters require a score in the play feed. Normal per-play and individual target alerts remain unchanged.</p></div><button class="save-button" data-action="save">ACTIVATE ALERT LOADOUT &nbsp; ↗</button></div>
<div class="preview-card premium-preview"><h3>NOTIFICATION PREVIEW</h3><p>Here’s how this setup will appear on your phone when a matching event is detected.</p><div class="notification-preview"><small>⚡ EVERY PLAY &nbsp;·&nbsp; SAMPLE</small><strong>${esc(x?.name)} — ${basketball?'+3 Points':'+24 Receiving Yards'}</strong><p>${basketball?'Made three-point field goal. Total: 17 pts':'24-yard reception. Total: 64 yards'}</p></div><div class="notification-preview milestone"><small>🎯 MILESTONE UNLOCKED &nbsp;·&nbsp; SAMPLE</small><strong>${esc(x?.name)} — Target reached!</strong><p>${target?`Your ${esc(target)} ${esc(labels[first].toLowerCase())} goal was reached.`:'Choose a numeric target to enable a milestone.'}</p></div><div class="preview-footnote">Notifications require an HTTPS deployment and permission on your device. ESPN free feeds are unofficial and may miss or delay play events.</div></div></div>`}
function watchView(){const watches=s.watchList||[];return `${ribbon()}${header('YOUR CONTROL ROOM','ACTIVE','ALERTS','All your favorite players and goals, in one command center.',false)}<div class="toolbar"><span class="chip active">${watches.length} SAVED LOADOUT${watches.length===1?'':'S'}</span><button class="btn-secondary" data-action="new">+ BUILD NEW ALERT</button></div>${watches.length?`<div class="watch-grid">${watches.map(w=>`<div class="watch-item"><div class="watch-item-header"><div><strong>${esc(w.name)}</strong><small>${esc(leagues[w.sport]?.name||w.sport)} · ${w.kind==='team'?'TEAM':'PLAYER'} · ${w.gameId?'SELECTED GAME':'ALL GAMES'}</small></div><span style="color:#68b8fa">◎</span></div><div class="watch-stats">${Object.entries(w.rules||{}).map(([k,r])=>`<span class="mini-tag ${r.target!=null?'gold':''}">${esc(labels[k]||k)} ${r.every?'⚡':''}${r.target!=null?' 🎯'+r.target:''}</span>`).join('')}</div><div class="watch-actions"><button class="btn-secondary" data-action="demoalert" data-id="${esc(w.id)}">SIMULATE</button><button class="btn-secondary" data-action="intelwatch" data-id="${esc(w.id)}">TRACK LIVE</button>${w.kind==='player'?`<button class="btn-secondary" data-action="labfromwatch" data-id="${esc(w.id)}">ANALYTICS</button>`:''}<button class="danger-btn" data-action="delete" data-id="${esc(w.id)}">REMOVE</button></div></div>`).join('')}</div>`:`<div class="empty-card">No saved rules yet. Choose a sport, then a game and player to build your first loadout. <button class="btn-secondary" data-action="new" style="display:block;margin-top:14px">SELECT A SPORT ↗</button></div>`}`}
function feedView(){const alerts=s.alerts||[];return `${ribbon()}${header('EVENT INTELLIGENCE','ALERT','FEED','The moments you chose to follow, in real time.',false)}<div class="toolbar"><span class="chip active">${alerts.length} EVENTS</span><button class="btn-secondary" data-action="sample">+ GENERATE DEMO EVENTS</button></div>${alerts.length?`<div class="feed-list">${alerts.slice(0,100).map(a=>`<div class="feed-item ${a.category==='target'?'special':''}"><div class="feed-symbol">${a.category==='target'?'🎯':'⚡'}</div><div class="feed-main"><strong>${esc(a.name)} — ${esc(a.label)}</strong><p>${esc(a.detail||'')} · ${esc(a.game||'')}</p></div><div class="feed-date">${a.demo?'DEMO':'EVENT'}</div></div>`).join('')}</div>`:`<div class="empty-card">Your alerts will appear here. Try a demonstration to see how milestone and per-play alerts look.</div>`}`}
function settingsView(){return `${ribbon()}${header('SYSTEM CONTROL','APP','SETTINGS','Configure push notifications and check the selected live-data provider.',false)}<div class="settings-grid"><div class="settings-card"><div class="eyebrow">PUSH CONTROL</div><h3>Phone notifications</h3><p>Add LiveStat to your iPhone Home Screen using Safari, then enable Web Push. A public HTTPS server is required.</p><button class="btn-secondary" data-action="push">ENABLE NOTIFICATIONS ↗</button><button class="btn-secondary" style="margin-left:7px" data-action="testpush">TEST PUSH</button></div><div class="settings-card"><div class="eyebrow">DATA PROVIDER</div><h3>ESPN / Unofficial free feed</h3><p>Polls play-by-play data as available. May be delayed or inaccurate. Architecture remains compatible with a licensed API later.</p><span class="chip active">FREE DATA MODE</span></div><div class="settings-card"><div class="eyebrow">ALERT BEHAVIOR</div><h3>Per-play, not per unit</h3><p>One regular alert per changed statistic per play. Targets trigger separately when the threshold is reached or exceeded.</p></div><div class="settings-card ls-discord-card"><div class="eyebrow">DISCORD ALERT RELAY</div><h3>Send alerts to Discord</h3><p>Connect a channel webhook from Discord → Channel Settings → Integrations → Webhooks. The link stays on the server and is not displayed after saving.</p>
<label class="ls-discord-field">Webhook URL<input id="ls-discord-url" type="password" autocomplete="off" placeholder="${s.discord.configured?'Webhook already saved · enter a new one to replace':'https://discord.com/api/webhooks/…'}" /></label>
<label class="ls-discord-toggle"><input type="checkbox" id="ls-discord-enabled" ${s.discord.enabled?'checked':''}/> Enable Discord messages</label>
<div class="ls-discord-modes">${[['every','Every play'],['target','Milestones & missions'],['near','Almost there'],['correction','Stat corrections']].map(([key,value])=>`<label><input type="checkbox" data-discord-type="${key}" ${s.discord.types.includes(key)?'checked':''}/>${value}</label>`).join('')}</div>
<button class="btn-secondary" data-action="discord-save">SAVE DISCORD SETTINGS</button><button class="btn-secondary" data-action="discord-test">TEST MESSAGE</button>
<p class="ls-discord-warning">Optional and off by default. Saved webhooks are lost on free-host restarts. Do not share your webhook URL publicly.</p></div><div class="settings-card"><div class="eyebrow">YOUR VERSION</div><h3>LiveStat Arena v0.8</h3><p>Five leagues. Game-specific watch assignments. Select sport → game → player → stat loadout.</p></div></div>`}
function render(){const pages={arena:()=>s.boxscoreGame?renderBoxScore():[sportView,gameView,selectTeamView,profileView][s.step](),watches:watchView,activity:feedView,settings:settingsView,insights:()=>intelligence.render(),command:()=>intelligence.render(),league:()=>intelligence.render(),analytics:()=>analytics.render(),rosters:()=>rosterBrowser.render()};app.innerHTML=pages[s.tab]();if(s.tab==='analytics')analytics.afterRender();$$('[data-tab]').forEach(e=>{const active=e.dataset.tab===s.tab;e.classList.toggle('active',active);e.classList.toggle('is-active',active)});$('#side-watch-count').textContent=s.watchList.length}
function setTab(tab){s.tab=tab;render();if(tab==='command')intelligence.openCommand();if(tab==='league')intelligence.openLeague(s.sport||'nba');
if(tab==='rosters')rosterBrowser.open(s.sport||null);window.scrollTo({top:0,behavior:'instant'})}
async function gamesLoad(){s.error='';s.loading=true;render();try{const d=s.preview?{games:demoGames[s.sport]||[]}:await api(`/api/games?sport=${encodeURIComponent(s.sport)}&date=${dateCode()}`);s.games=d.games||[];}catch(e){s.error=e.message;s.games=[]}finally{s.loading=false;render()}}
async function selectSport(id){s.boxscoreGame=null;s.boxscoreData=null;s.sport=id;s.game=null;s.team=null;s.player=null;s.rosterGroup=null;s.step=1;s.filter='all';s.gameDate=new Date();setTab('arena');await gamesLoad()}
async function selectGame(id){s.game=s.games.find(g=>g.id===id);if(!s.game)return;s.step=2;s.team=s.game.teams?.[0]||null;s.search='';s.rosterGroup=null;s.roster=[];setTab('arena');await loadRoster()}
async function loadRoster(){s.loading=true;s.error='';render();try{const data=s.preview?{players:demoPlayers[s.team.id]||[{id:'9999001',name:'Sample Player',position:isBB()?'G':'WR',teamId:s.team.id}]}:await api(`/api/roster?sport=${s.sport}&team=${s.team.id}&game=${s.game?.id||''}`);s.roster=data.players||[]}catch(e){s.roster=[];s.error=e.message}finally{s.loading=false;render()}}
function setPlayer(id){s.player=s.roster.find(p=>p.id===id);if(!s.player)return;s.kind='player';s.step=3;defaultRules();render();scrollTo({top:0,behavior:'instant'})}
function trackTeam(){s.player=null;s.kind='team';s.step=3;defaultRules();render();scrollTo({top:0,behavior:'instant'})}
async function save(){const rules=Object.fromEntries(Object.entries(s.rules).filter(([,r])=>r.every||r.target!=null).map(([k,r])=>[k,{every:Boolean(r.every),target:r.target||null}]));if(!Object.keys(rules).length)return toast('Choose at least one per-play alert or target');const watch={sport:s.sport,gameId:String(s.game.id),kind:s.kind,teamId:String(s.team.id),playerId:s.kind==='player'?String(s.player.id):'',name:s.kind==='player'?s.player.name:s.team.name,position:s.kind==='player'?(s.player.position||''):'',rules,smart:s.smart};try{if(s.preview){const existing=s.watchList.findIndex(w=>w.sport===watch.sport&&w.gameId===watch.gameId&&w.playerId===watch.playerId&&w.teamId===watch.teamId&&w.kind===watch.kind);if(existing>=0)s.watchList[existing]={...s.watchList[existing],...watch};else s.watchList.unshift({...watch,id:'preview-'+Date.now()});localStorage.setItem('livestat-preview-watches',JSON.stringify(s.watchList));toast('Demo alert saved — preview only')}else{await api('/api/watches','POST',watch);await loadStatus();toast('Alert loadout activated!')}setTab('watches')}catch(e){toast(e.message)}}
async function loadDiscord(){
 if(s.preview)return;
 try{s.discord=await api('/api/discord')}catch{}
}
async function saveDiscord(){
 if(s.preview)return toast('Discord is unavailable in preview mode');
 const url=$('#ls-discord-url')?.value?.trim()||'';
 const enabled=Boolean($('#ls-discord-enabled')?.checked);
 const types=$$('[data-discord-type]:checked').map(x=>x.dataset.discordType);
 try{
  s.discord=await api('/api/discord','POST',{url,enabled,types});
  toast('Discord settings saved');
  render();
 }catch(err){toast(err.message)}
}
async function testDiscord(){
 if(s.preview)return toast('Discord requires a live server');
 try{await api('/api/discord/test','POST');toast('Discord test request sent')}
 catch(err){toast(err.message)}
}
async function loadStatus(){if(s.preview)return;try{const result=await api('/api/status');s.watchList=result.watches||[];s.alerts=result.alerts||[]}catch(e){toast(e.message)}}
async function deleteWatch(id){if(s.preview){s.watchList=s.watchList.filter(w=>w.id!==id);localStorage.setItem('livestat-preview-watches',JSON.stringify(s.watchList))}else{try{await api(`/api/watches/${id}`,'DELETE');await loadStatus()}catch(e){toast(e.message)}}render();toast('Alert removed')}
async function simulate(id){if(s.preview){sampleAlerts();return}try{const d=await api('/api/demo','POST',{watchId:id});await loadStatus();toast(`${d.count} sample alert(s) recorded`);render()}catch(e){toast(e.message)}}
function sampleAlerts(){s.alerts=[{id:'demo-'+Date.now(),name:'LeBron James',label:'🎯 TARGET REACHED · Points',detail:'Reached 15 points (now 17)',game:'LAL vs GSW',category:'target',demo:true},{id:'demo2-'+Date.now(),name:'LeBron James',label:'Points',detail:'+3 points on this play · Total: 17',game:'LAL vs GSW',category:'every',demo:true},{id:'demo3-'+Date.now(),name:'Chris Olave',label:'Receiving yards',detail:'+24 receiving yards · Total: 64',game:'NO vs ATL',category:'every',demo:true},...s.alerts].slice(0,100);setTab('activity');toast('Preview notifications generated')}
function b64ToUint8(b){const s=(b+'='.repeat((4-b.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function push(){if(s.preview)return toast('Demo mode: phone push requires an HTTPS live deployment');try{if(!s.config?.pushConfigured)throw Error('Configure Web Push on the server first');if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)||!window.isSecureContext)throw Error('Use HTTPS and Add to Home Screen on iPhone');if(await Notification.requestPermission()!=='granted')throw Error('Notification permission denied');await navigator.serviceWorker.register('/sw.js');const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(s.config.vapidPublicKey)});await api('/api/subscription','POST',sub.toJSON());toast('Push enabled!')}catch(e){toast(e.message)}}
async function testPush(){if(s.preview)return toast('Demo only — notifications are simulated');try{const d=await api('/api/test-push','POST');toast(`Test sent to ${d.subscribers} devices`)}catch(e){toast(e.message)}}
app.addEventListener('click',async e=>{const b=e.target.closest('button[data-action]');if(!b)return;const a=b.dataset.action;
if(intelligence.handle(a,b))return;
if(analytics.handle(a,b))return;
if(rosterBrowser.handle(a,b))return;
if(a==='labfromplayer'&&s.player){s.tab='analytics';analytics.openPlayer(s.player,s.sport,{gameId:s.game?.id,teamId:s.team?.id,team:s.team,game:s.game});render();return}
if(a==='labfromwatch'){const w=s.watchList.find(w=>w.id===b.dataset.id);if(w?.playerId){s.tab='analytics';analytics.openPlayer({id:w.playerId,name:w.name,position:w.position},w.sport,{gameId:w.gameId,teamId:w.teamId});render()}return}
if(a==='intelgame'){
 const game=(s.games||[]).find(g=>String(g.id)===String(b.dataset.game));
 if(!game)return;
 s.tab='insights';intelligence.openGame(s.sport,game);render();return;
}
if(a==='intelwatch'){
 const watch=s.watchList.find(w=>String(w.id)===String(b.dataset.id));if(!watch?.gameId)return toast('Select a game for this alert first');
 s.tab='insights';intelligence.openGame(watch.sport,{id:watch.gameId,name:watch.name+' — Game '+watch.gameId,status:'Loading game details',teams:[]});render();return;
}
if(a==='intelprofile'){
 s.tab='insights';intelligence.openProfile(s.sport,b.dataset.athlete);render();return;
}
if(a==='intel-open'){
 const w=intelligence.state.tracker?.tracker?.find(x=>x.gameId===b.dataset.game&&x.sport===b.dataset.sport);
 if(!w)return;
 s.tab='insights';intelligence.openGame(w.sport,{id:w.gameId,name:w.name+' Game',status:w.game?.status,teams:w.game?.teams});render();return;
}
if(a==='intel-leagueopen'){s.tab='league';intelligence.openLeague(s.sport||'nba');render();return}
if(a==='footballall'){s.showAllFootballStats=!s.showAllFootballStats;render();return}
if(a==='discord-save')return saveDiscord();if(a==='discord-test')return testDiscord();
if(a==='intel-back'){s.tab='arena';render();return}
if(a==='nav')return setTab(b.dataset.tab);if(a==='sport')return selectSport(b.dataset.sport);if(a==='filter'){s.filter=b.dataset.filter;return render()}if(a==='date'){s.gameDate.setDate(s.gameDate.getDate()+Number(b.dataset.days));return gamesLoad()}if(a==='game')return selectGame(b.dataset.game);if(a==='boxscore')return openBoxScore(b.dataset.game);if(a==='boxclose')return closeBoxScore();if(a==='boxrefresh')return refreshBoxScore();if(a==='boxtrack')return trackFromBoxScore();if(a==='boxteam'){s.boxscoreTeam=b.dataset.team;return render()}if(a==='team'){s.team=gameTeams().find(t=>t.id===b.dataset.team);s.search='';s.rosterGroup=null;return loadRoster()}if(a==='position'){s.rosterGroup=b.dataset.group;s.search='';return render()}if(a==='positions'){s.rosterGroup=null;s.search='';return render()}if(a==='player')return setPlayer(b.dataset.player);if(a==='trackteam')return trackTeam();if(a==='save')return save();if(a==='step'){const i=Number(b.dataset.step);if(i<=s.step){s.step=i;render()};return}if(a==='new'){s.sport=null;s.step=0;return setTab('arena')}if(a==='delete')return deleteWatch(b.dataset.id);if(a==='demoalert')return simulate(b.dataset.id);if(a==='sample'){if(s.preview)return sampleAlerts();try{await api('/api/sample','POST',{sport:'nba'});await loadStatus();render()}catch(err){toast(err.message)}return}if(a==='push')return push();if(a==='testpush')return testPush();if(a==='preview'){location.href='/?preview=1';return}});
app.addEventListener('input',e=>{if(e.target?.tagName==='SELECT'&&String(e.target.id||'').startsWith('gp-roster-'))return;if(analytics.input(e.target))return;if(rosterBrowser.input(e.target))return;if(intelligence.input(e.target))return;if(e.target.matches('[data-smart]')){const k=e.target.dataset.smart,v=e.target.value;s.smart[k]=k==='combine'?v:k==='maxMargin'?(v===''?null:Number(v)):Number(v);return;}if(e.target.id==='player-search'){s.search=e.target.value;const results=$('#roster-results');if(results)results.innerHTML=rosterSection()}if(e.target.matches('[data-rule-every]')){const k=e.target.dataset.ruleEvery;s.rules[k]||={every:false,target:null};s.rules[k].every=e.target.checked}if(e.target.matches('[data-rule-target]')){const k=e.target.dataset.ruleTarget;s.rules[k]||={every:false,target:null};const v=e.target.value.trim();s.rules[k].target=v?Math.max(1,Math.floor(Number(v))):null}});
// iOS select menus reliably dispatch change, while input varies by browser.
app.addEventListener('change',e=>{if(e.target?.tagName==='SELECT'&&String(e.target.id||'').startsWith('gp-roster-'))rosterBrowser.input(e.target)});
app.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.id==='lab-search'){e.preventDefault();analytics.handle('lab-search',{dataset:{}})}});
$$('.mobile-nav,.side').forEach(n=>n.addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(b)setTab(b.dataset.tab)}));
async function boot(){
  if(s.preview){try{s.watchList=JSON.parse(localStorage.getItem('livestat-preview-watches')||'[]')}catch{};render();return}
  try{s.config=await(await fetch('/api/config',{credentials:'same-origin'})).json()}catch(e){s.error='Could not reach the LiveStat server';}
  await Promise.all([loadStatus(),loadDiscord()]);render();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
  setInterval(async()=>{await loadStatus();if(s.tab==='watches'||s.tab==='activity')render()},7000)
  setInterval(()=>{if(s.tab==='arena'&&s.boxscoreGame&&s.boxscoreGame.state==='in'&&!document.hidden)refreshBoxScore()},25000);
  setInterval(()=>{if(!document.hidden&&['insights','command'].includes(s.tab)&&!intelligence.state.loading)intelligence.reload()},25000);
}boot();
