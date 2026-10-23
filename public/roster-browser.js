// Gamepoint-inspired roster explorer for all LiveStat ESPN sports.
// Separate from the Arena's position-first alert picker.
import {positionOptions,positionGroupForPlayer} from './roster-select.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const leagues={nba:'NBA',nfl:'NFL',cfb:'COLLEGE FOOTBALL',ncaam:'COLLEGE BASKETBALL · MEN',ncaaw:'COLLEGE BASKETBALL · WOMEN'};
const football=s=>s==='nfl'||s==='cfb';
export const GRID_LABELS={
 PTS:'PTS',REB:'REB',AST:'AST',STL:'STL',BLK:'BLK','3PM':'3PM',MIN:'MIN',GP:'G',TOV:'TOV','FG%':'FG%','3P%':'3P%','FT%':'FT%',
 PASSYDS:'PASS YDS',PASSTD:'PASS TD',PASSINT:'PASS INT',RUSHYDS:'RUSH YDS',
 RUSHTD:'RUSH TD',CAR:'CAR',RECYDS:'REC YDS',REC:'REC',RECTD:'REC TD',
 DEFTOT:'TACK',DEFSACKS:'SACK',DEFINT:'INT',CMP:'CMP',TGTS:'TGT',YPR:'Y/REC',
 FGM:'FGM',FGA:'FGA',XPM:'XPM',XPA:'XPA',PUNTYDS:'PUNT YDS'
};
const basketballCols=['PTS','REB','AST','STL','BLK','TOV','3PM','FG%','3P%','FT%','MIN','GP'];
const footballCols=['PASSYDS','PASSTD','RUSHYDS','RUSHTD','REC','RECYDS','RECTD','DEFTOT','DEFSACKS','DEFINT'];
const footballGroups={
 QB:['PASSYDS','PASSTD','PASSINT','CMP','RUSHYDS','RUSHTD'],
 RB:['RUSHYDS','RUSHTD','CAR','REC','RECYDS','RECTD'],
 WR:['REC','RECYDS','RECTD','TGTS','YPR','RUSHYDS'],
 TE:['REC','RECYDS','RECTD','TGTS'],
 OL:['GP'],DL:['DEFTOT','DEFSACKS','DEFINT'],LB:['DEFTOT','DEFSACKS','DEFINT'],
 CB:['DEFTOT','DEFINT','DEFSACKS'],S:['DEFTOT','DEFINT','DEFSACKS'],
 ST:['FGM','FGA','XPM','XPA','PUNTYDS'],OTHER:['GP','PASSYDS','RUSHYDS','RECYDS']
};
export const gridColumns=(sport,group)=>football(sport)?footballGroups[group]||footballCols:basketballCols;
export const defaultRosterSeason=(sport,now=new Date())=>{
 const y=now.getUTCFullYear(),month=now.getUTCMonth();
 return football(sport)?y:y+(month>=6?1:0);
};
const num=x=>x===null||x===undefined||x===''?null:(Number.isFinite(Number(x))?Number(x):null);
const format=x=>x==null?'—':Math.abs(Number(x))<10&&Number(x)%1!==0?Number(x).toFixed(1):String(x);
const FALLBACK_PHOTO={
 nfl:'nfl',cfb:'college-football',nba:'nba',
 ncaam:'mens-college-basketball',ncaaw:'womens-college-basketball'
};
function avatar(sport,p){
 const name=String(p?.name||'').trim();
 const photo=String(p?.headshot||'');
 const src=/^https:\/\/(?:a|a1|a2)\.espncdn\.com\/i\/headshots\//i.test(photo)?photo:
  /^\d{1,14}$/.test(String(p?.id||''))?
    'https://a.espncdn.com/i/headshots/'+FALLBACK_PHOTO[sport]+'/players/full/'+p.id+'.png':'';
 const initials=name.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
 return '<div class="gp-player-image"><div class="gp-player-initials">'+esc(initials||'?')+'</div>'+
   (src?'<img loading="lazy" src="/api/analytics/headshot?url='+encodeURIComponent(src)+
     '" alt="'+esc(name)+' headshot" onerror="this.hidden=true">':'')+'</div>';
}
export function createRosterBrowser({api,refresh,toast=()=>{},onAnalytics=()=>{},onTrack=()=>{}}){
 const state={sport:'nba',season:defaultRosterSeason('nba'),teamId:'',teams:[],players:[],stats:{},
  loaded:new Set(),failed:new Set(),profiled:new Set(),selectedId:null,group:'ALL',search:'',sortKey:'',mode:'auto',
  loadingTeams:false,loadingRoster:false,loadingStats:false,ready:false,error:'',seq:0,statsCursor:0};
 const team=()=>state.teams.find(x=>String(x.id)===state.teamId)||{};
 const selected=()=>state.players.find(x=>String(x.id)===state.selectedId)||null;
 const getColumns=()=>gridColumns(state.sport,state.group);
 const sampleMode=()=>state.mode==='auto'?(football(state.sport)?'total':'average'):state.mode;
 const valueFor=(p,key)=>key==='GP'?num(state.stats[p.id]?.games):
   num(state.stats[p.id]?.[(key.endsWith('%')?'average':sampleMode())==='total'?'totals':'averages']?.[key]);
 function sortedList(){
   const term=state.search.trim().toLocaleLowerCase();
   const rows=state.players.filter(p=>(state.group==='ALL'||positionGroupForPlayer(p,state.sport)===state.group)&&
     (!term||(p.name+' '+(p.position||'')+' '+(p.jersey||'')).toLocaleLowerCase().includes(term)));
   const sort=state.sortKey||getColumns()[0];
   return rows.sort((a,b)=>{
     const aVal=valueFor(a,sort),bVal=valueFor(b,sort);
     if(aVal!==null||bVal!==null){
       if(aVal===null)return 1;if(bVal===null)return -1;
       if(aVal!==bVal)return bVal-aVal;
     }
     const depth=x=>Number.isInteger(x.depthRank)&&x.depthRank>0?x.depthRank:999;
     if(depth(a)!==depth(b))return depth(a)-depth(b);
     const leader=x=>Number.isInteger(x.leaderRank)&&x.leaderRank>0?x.leaderRank:999;
     if(leader(a)!==leader(b))return leader(a)-leader(b);
     return String(a.name).localeCompare(String(b.name));
   });
 }
 function years(){
   const thisYear=new Date().getUTCFullYear()+2;
   return Array.from({length:18},(_,i)=>thisYear-i);
 }
 function nav(){
   return '<div class="gp-roster-controls">'+
   '<label>LEAGUE<select id="gp-roster-sport">'+Object.entries(leagues).map(([id,name])=>'<option value="'+id+'" '+(state.sport===id?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label>'+
   '<label>SEASON<select id="gp-roster-season">'+years().map(y=>'<option value="'+y+'" '+(state.season===y?'selected':'')+'>'+y+'</option>').join('')+'</select></label>'+
   '<label class="gp-team-control">TEAM<select id="gp-roster-team" '+(!state.teams.length?'disabled':'')+'>'+
      state.teams.map(x=>'<option value="'+esc(x.id)+'" '+(String(x.id)===state.teamId?'selected':'')+'>'+esc(x.name)+'</option>').join('')+
      '</select></label>'+
   '</div>';
 }
 function hero(){
   const p=selected();if(!p)return '<div class="gp-empty">Select a team to view its roster.</div>';
   const pos=p.position||'—';
   const s=state.stats[p.id],keys=(getColumns().length>4?getColumns().slice(0,8):getColumns()),
     values=keys.map(k=>({key:k,val:valueFor(p,k)}));
   const best=values.filter(x=>x.val!==null).slice(0,8);
   return '<section class="gp-roster-hero">'+
     '<div class="gp-portrait">'+avatar(state.sport,p)+'<span class="gp-portrait-number">'+(p.jersey?'#'+esc(p.jersey):esc(pos))+'</span></div>'+
     '<div class="gp-hero-main"><div class="gp-roster-teamline">'+esc(team().name||'TEAM')+' / '+esc(state.season)+
       (p.rankingSource==='depth'&&p.depthRank?'<span>DEPTH #'+p.depthRank+'</span>':'')+'</div>'+
     '<h3>'+esc(p.name)+'</h3><div class="gp-hero-tags"><span>'+esc(pos)+'</span>'+
       (p.jersey?'<span>JERSEY #'+esc(p.jersey)+'</span>':'')+
       (p.age!=null?'<span>AGE '+esc(p.age)+'</span>':'')+'</div>'+
     '<div class="gp-hero-statgrid">'+
       (best.length?best.map((x,i)=>'<div class="gp-hero-stat '+(!i?'highlight':'')+'"><strong>'+format(x.val)+'</strong><small>'+
         esc(GRID_LABELS[x.key]||x.key)+'</small></div>').join(''):
         '<div class="gp-hero-stat gp-hero-loading">'+(state.failed.has(p.id)?'ESPN season statistics unavailable':state.loaded.has(p.id)?'No recorded ESPN stats for this season':'Fetching available season statistics…')+'</div>')+
     '</div><div class="gp-bio">'+
       [['COLLEGE',p.college],['HEIGHT',p.height],['WEIGHT',p.weight],['EXPERIENCE',p.experience],['POSITION',p.position],['BIRTHPLACE',p.birthPlace],['DRAFT',p.draft]].map(([k,v])=>
         '<div><small>'+k+'</small><strong>'+esc(v==null||v===''?'—':v)+'</strong></div>').join('')+
     '</div><div class="gp-hero-actions"><button data-action="roster-analytics">CAREER &amp; SEASON STATS ↗</button>'+
       '<button data-action="roster-track">CREATE PLAYER ALERT ↗</button></div>'+
     '</div></section>';
 }
 function tableMarkup(){
   const list=sortedList(),columns=getColumns();
   const heading='<div class="gp-table-head"><div><strong>'+esc(team().name||'')+' ROSTER</strong><small id="gp-roster-total">'+
    list.length+' players · tap a player to feature them</small></div><div class="gp-roster-source">'+
    (state.loadingStats?'LOADING STATS · ':'')+(sampleMode()==='total'?'TOTALS':'PER GAME')+
    ' · ESPN SEASON STATS + GAME LOGS</div></div>';
   return heading+'<div class="gp-roster-table-scroll"><table class="gp-roster-table"><thead><tr>'+
     '<th class="gp-rank-col">#</th><th class="gp-name-col">PLAYER</th><th>POS</th><th>JERSEY</th>'+
     columns.map(k=>'<th><button data-action="roster-sort" data-key="'+esc(k)+'" class="'+((state.sortKey||columns[0])===k?'active':'')+'">'+
       esc(GRID_LABELS[k]||k)+' '+((state.sortKey||columns[0])===k?'↓':'')+'</button></th>').join('')+'</tr></thead><tbody>'+
     list.map((p,i)=>'<tr class="'+(state.selectedId===p.id?'selected':'')+'"><td class="gp-roster-rank">'+(i+1)+'</td>'+
       '<td class="gp-name-col"><button data-action="roster-select" data-id="'+esc(p.id)+'">'+
       '<span>'+esc(p.name)+'</span>'+
       (p.depthRank?'<small>DEPTH '+p.depthRank+'</small>':p.leaderRank?'<small>STAT LEADER</small>':'')+
       '</button></td><td class="gp-pos">'+esc(p.position||'—')+'</td>'+
       '<td class="gp-jersey">'+esc(p.jersey||'—')+'</td>'+
       columns.map((k,idx)=>{const value=valueFor(p,k);
         const val=value===null?(state.loaded.has(p.id)?'—':'…'):format(value);
         return '<td class="'+(idx===0?'gp-primary-col':'')+(value===null?' gp-missing':'')+'" title="'+(value===null?(state.loaded.has(p.id)?'Not provided by ESPN':'Loading player statistics'):'ESPN season statistic')+'">'+val+'</td>';
       }).join('')+'</tr>').join('')+'</tbody></table></div>';
 }
 function render(){
   const teamName=team().name||'TEAM ROSTERS';
   const options=positionOptions(state.players,state.sport);
   const groups=[{id:'ALL',title:'ALL PLAYERS',count:state.players.length},...options];
   return '<div class="gp-roster-page"><div class="gp-roster-heading"><div class="gp-roster-eyebrow">LIVESTAT / ROSTER DATABASE</div>'+
     '<h2>THE <em>ROSTER</em></h2><p>Browse teams by league and season. Tap any athlete to feature their profile and ESPN stats.</p></div>'+
     nav()+
     (state.error?'<div class="gp-error">'+esc(state.error)+'</div>':'')+
     '<div class="gp-roster-scope">CURRENT TEAM ROSTER · '+esc(state.season)+' SEASON STATISTICS <small>ESPN does not reliably provide historical team rosters. Older season selections use today’s roster, not a verified past roster.</small></div>'+
     (state.loadingTeams||state.loadingRoster?'<div class="gp-loading">LOADING ESPN ROSTER…</div>':
       state.players.length?hero()+
         '<div class="gp-roster-filters"><div class="gp-position-filters">'+groups.map(g=>
           '<button data-action="roster-group" data-key="'+esc(g.id)+'" class="'+(state.group===g.id?'active':'')+'">'+
             esc(g.title||g.id)+' <b>'+g.count+'</b></button>').join('')+'</div>'+
         '<div class="gp-roster-searchline"><label>FIND PLAYER<input id="gp-roster-search" type="search" autocomplete="off" value="'+esc(state.search)+'" placeholder="Search name, position or jersey…"></label>'+
         '<label>SHOW<select id="gp-roster-mode"><option value="auto" '+(state.mode==='auto'?'selected':'')+'>SPORT DEFAULT</option>'+
         '<option value="total" '+(state.mode==='total'?'selected':'')+'>TOTALS</option>'+
         '<option value="average" '+(state.mode==='average'?'selected':'')+'>PER GAME</option></select></label></div></div>'+
         '<div id="gp-roster-list">'+tableMarkup()+'</div>'+
         '<div class="gp-roster-end"><p>ESPN data is unofficial. Stats cover only returned games, not guaranteed complete seasons. '+
            'Season stats prioritize ESPN aggregates and fill missing fields from game logs. “…” = loading; “—” = unavailable. '+
            'Historical rosters require an additional verified data source.</p>'+
         (state.statsCursor<state.players.length?'<button data-action="roster-more" '+(state.loadingStats?'disabled':'')+'>'+
          (state.loadingStats?'FETCHING STATISTICS…':'LOAD MORE PLAYER STATS')+'</button>':'<span>ALL ROSTER PLAYERS CHECKED</span>')+
         '</div>':('<div class="gp-empty">'+(state.teamId?'ESPN did not return a roster for this team and season.':'Choose a team to begin.')+'</div>'))+
   '</div>';
 }
 const up=()=>refresh();
 async function loadTeams(){
   const seq=++state.seq;
   state.loadingTeams=true;state.error='';up();
   try{
     const d=await api('/api/teams?sport='+state.sport);
     if(seq!==state.seq)return;
     state.teams=d.teams||[];
     if(!state.teams.some(t=>String(t.id)===state.teamId))state.teamId=String(state.teams[0]?.id||'');
     state.loadingTeams=false;
     if(state.teamId)await loadRoster();
   }catch(e){if(seq!==state.seq)return;state.error=e.message||String(e)}
   finally{if(seq===state.seq){state.loadingTeams=false;up()}}
 }
 async function loadRoster(){
   if(!state.teamId){state.players=[];up();return}
   const seq=++state.seq,sport=state.sport,teamId=state.teamId,season=state.season;
   state.loadingRoster=true;state.error='';state.stats={};state.loaded=new Set();state.failed=new Set();state.profiled=new Set();
   state.statsCursor=0;state.search='';state.group='ALL';state.sortKey='';state.selectedId=null;up();
   try{
     const d=await api('/api/roster?sport='+sport+'&team='+encodeURIComponent(teamId)+'&season='+season);
     if(seq!==state.seq)return;
     state.players=d.players||[];
     state.selectedId=String(state.players[0]?.id||'');
     state.loadingRoster=false;up();
     if(state.players.length){loadSelectedProfile(state.selectedId,seq);prefetchRosterStats(seq)}
   }catch(e){if(seq!==state.seq)return;state.error=e.message||String(e);state.players=[]}
   finally{if(seq===state.seq){state.loadingRoster=false;up()}}
 }
 async function prefetchRosterStats(seq){
   // Request stats progressively so all normal NBA/NFL roster rows get filled,
   // without waiting for the user to press a button 5+ times.
   let cycles=0;
   while(seq===state.seq&&state.loaded.size<state.players.length&&cycles<9){
     if(state.loadingStats){await new Promise(r=>setTimeout(r,150));continue}
     await loadMore(8,seq);
     cycles++;
     if(seq===state.seq&&state.loaded.size<state.players.length)
       await new Promise(r=>setTimeout(r,420));
   }
 }
 async function loadSelectedProfile(id,currentSeq=state.seq){
   if(!id||state.profiled.has(id))return;
   state.profiled.add(id);
   try{
     const response=await api('/api/roster/profile?sport='+state.sport+'&athlete='+encodeURIComponent(id));
     if(currentSeq!==state.seq)return;
     const p=state.players.find(x=>x.id===id);
     if(!p||!response.player)return;
     // Enrichment never removes roster fields ESPN didn't repeat in /bio.
     const good=Object.fromEntries(Object.entries(response.player)
       .filter(([key,v])=>key!=='id'&&key!=='teamId'&&v!=null&&String(v).trim()!==''));
     Object.assign(p,good);
     up();
   }catch(e){/* Some NCAA athletes have no separate ESPN athlete bio. */}
 }
 async function loadMore(count=8,currentSeq=state.seq){
   if(state.loadingStats||currentSeq!==state.seq)return;
   const priority=sortedList(),active=selected();
   const prioritized=[...(active?[active]:[]),...priority,...state.players];
   const candidate=[...new Map(prioritized.map(x=>[x.id,x])).values()]
     .filter(p=>!state.loaded.has(p.id)&&!state.failed.has(p.id)).slice(0,count);
   if(!candidate.length){state.statsCursor=state.players.length;up();return}
   state.loadingStats=true;up();
   try{
     for(let i=0;i<candidate.length;i+=8){
       if(currentSeq!==state.seq)break;
       const ids=candidate.slice(i,i+8).map(x=>x.id);
       try{
         const batch=await api('/api/roster/stats?sport='+state.sport+'&season='+state.season+'&ids='+ids.join(','));
         if(currentSeq!==state.seq)break;
         for(const [id,st] of Object.entries(batch.stats||{})){state.stats[id]=st;state.loaded.add(id)}
         for(const x of batch.errors||[]){state.failed.add(x.id);state.loaded.add(x.id)}
       }catch(e){ids.forEach(id=>{state.failed.add(id);state.loaded.add(id)})}
       state.statsCursor=state.loaded.size;up();
     }
   }finally{if(currentSeq===state.seq){
     state.loadingStats=false;up();
     // A different athlete or position group may have been selected while
     // a batch was loading. Prioritize that athlete immediately afterward.
     if(state.selectedId&&!state.loaded.has(state.selectedId)&&!state.failed.has(state.selectedId))
       loadMore(1,currentSeq);
   }}
 }
 function selectPlayer(id){
   const p=state.players.find(x=>String(x.id)===String(id));if(!p)return;
   state.selectedId=String(p.id);up();
   loadSelectedProfile(p.id);
   if(!state.loaded.has(p.id)&&!state.loadingStats)loadMore(1);
 }
 function setSport(sport){
   if(!leagues[sport])return;
   state.sport=sport;state.season=defaultRosterSeason(sport);state.teamId='';state.teams=[];
   state.players=[];state.stats={};state.ready=true;return loadTeams();
 }
 function open(sport=null){
   if(sport&&sport!==state.sport)return setSport(sport);
   if(!state.ready){state.ready=true;return loadTeams()}
   up();return Promise.resolve();
 }
 function handle(action,node){
   const d=node?.dataset||{};
   if(action==='roster-select'){selectPlayer(d.id);return true}
   if(action==='roster-group'){
     state.group=d.key||'ALL';state.sortKey='';up();
     if(!state.loadingStats)loadMore(8);return true;
   }
   if(action==='roster-sort'){state.sortKey=d.key;up();return true}
   if(action==='roster-more'){loadMore(8);return true}
   if(action==='roster-analytics'){
     const p=selected();if(p)onAnalytics(p,state.sport,{team:team(),season:state.season});return true;
   }
   if(action==='roster-track'){onTrack(state.sport);return true}
   return false;
 }
 function input(node){
   const v=node.value;
   if(node.id==='gp-roster-search'){
     state.search=v;
     const list=typeof document!=='undefined'?document.getElementById('gp-roster-list'):null;
     if(list)list.innerHTML=tableMarkup();
     return true;
   }
   if(node.id==='gp-roster-sport'){setSport(v);return true}
   if(node.id==='gp-roster-season'){state.season=Number(v);loadRoster();return true}
   if(node.id==='gp-roster-team'){state.teamId=v;loadRoster();return true}
   if(node.id==='gp-roster-mode'){state.mode=v;up();return true}
   return false;
 }
 return {state,render,open,handle,input,selectPlayer,loadMore,loadRoster,selected,sortedList};
}
