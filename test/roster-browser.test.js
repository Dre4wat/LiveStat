import test from 'node:test';
import assert from 'node:assert/strict';
import {rosterSeasonSummary,rosterColumnValue,rosterSort,rosterColumns} from '../src/providers/roster-browser.js';
import {createRosterBrowser,gridColumns,defaultRosterSeason} from '../public/roster-browser.js';
import {espnProviderFor} from '../src/providers/espn.js';

test('Gamepoint roster layout has unique sport-specific stat columns',()=>{
 assert.deepEqual(gridColumns('nba','ALL'),['PTS','REB','AST','STL','BLK','TOV','3PM','FG%','3P%','FT%','MIN','GP']);
 assert.deepEqual(gridColumns('ncaaw','ALL'),gridColumns('nba','ALL'));
 assert.deepEqual(gridColumns('cfb','QB'),['PASSYDS','PASSTD','PASSINT','CMP','RUSHYDS','RUSHTD']);
 assert.deepEqual(gridColumns('nfl','DL'),['DEFTOT','DEFSACKS','DEFINT']);
 assert.deepEqual(rosterColumns('nfl','WR'),['REC','RECYDS','RECTD','TGTS','YPR','RUSHYDS']);
});
test('season defaults follow NBA/NCAA calendar and football',()=>{
 assert.equal(defaultRosterSeason('nfl',new Date('2026-10-19')),2026);
 assert.equal(defaultRosterSeason('nba',new Date('2026-10-19')),2027);
 assert.equal(defaultRosterSeason('ncaam',new Date('2026-02-19')),2026);
});
test('roster season stats distinguish per-game scoring from football cumulative scoped totals',()=>{
 const nba=rosterSeasonSummary('nba',[{stats:{PTS:30,REB:10,AST:9}},{stats:{PTS:20,REB:6,AST:5}}]);
 assert.equal(nba.games,2);
 assert.equal(nba.averages.PTS,25);
 assert.equal(nba.totals.PTS,50);
 assert.equal(rosterColumnValue(nba,'nba','PTS','auto'),25);
 const nfl=rosterSeasonSummary('nfl',[{stats:{PASSYDS:310,RUSHYDS:50,RECYDS:undefined}},{stats:{PASSYDS:225,RUSHYDS:30}}]);
 assert.equal(nfl.totals.PASSYDS,535);
 assert.equal(nfl.totals.RUSHYDS,80);
 assert.equal(rosterColumnValue(nfl,'nfl','PASSYDS','auto'),535);
 assert.equal(rosterColumnValue(nfl,'nfl','PASSYDS','average'),267.5);
 assert.equal(rosterColumnValue(nfl,'nfl','RECYDS','auto'),null);
});
test('table sorting prefers available real stats, otherwise depth chart and player name',()=>{
 const rows=[{id:'1',name:'Backup',depthRank:2},{id:'2',name:'Starter',depthRank:1},{id:'3',name:'Unavailable',depthRank:null}];
 const st={'1':rosterSeasonSummary('nfl',[{stats:{PASSYDS:120}}]),
   '2':rosterSeasonSummary('nfl',[{stats:{PASSYDS:310}}])};
 const sorted=rosterSort(rows,'PASSYDS',st,'nfl');
 assert.deepEqual(sorted.map(x=>x.id),['2','1','3']);
 assert.deepEqual(rosterSort(rows,'DEFSACKS',{},'nfl').map(x=>x.id),['2','1','3']);
});
test('Team Rosters browser renders Gamepoint player hero, season/team selectors and scrollable stat table',async()=>{
 const seen=[],events=[];
 const api=async url=>{
   seen.push(url);
   if(url.startsWith('/api/teams'))return {teams:[{id:'13',name:'Los Angeles Lakers',abbreviation:'LAL'}]};
   if(url.startsWith('/api/roster?'))return {players:[
     {id:'1966',name:'LeBron James',position:'SF',jersey:'23',depthRank:1,headshot:'https://a.espncdn.com/i/headshots/nba/players/full/1966.png',age:41},
     {id:'3945274',name:'Austin Reaves',position:'SG',jersey:'15',depthRank:2}
   ]};
   if(url.startsWith('/api/roster/stats?'))return {stats:{
     '1966':{games:2,averages:{PTS:28,REB:7,AST:8},totals:{PTS:56,REB:14,AST:16}},
     '3945274':{games:2,averages:{PTS:16,REB:3,AST:6},totals:{PTS:32,REB:6,AST:12}}
   },errors:[]};
   throw Error('Unknown API '+url);
 };
 const ui=createRosterBrowser({api,refresh:()=>{},toast:()=>{},onAnalytics:(p,sport)=>events.push([p.name,sport])});
 await ui.open('nba');
 await new Promise(resolve=>setImmediate(resolve));
 let markup=ui.render();
 assert.match(markup,/THE <em>ROSTER<\/em>/);
 assert.match(markup,/Los Angeles Lakers/);
 assert.match(markup,/LeBron James/);
 assert.match(markup,/id="gp-roster-team"/);
 assert.match(markup,/class="gp-roster-table"/);
 assert.match(markup,/PTS/);
 assert.ok(seen.some(x=>x.includes('/api/roster?sport=nba&team=13&season=')));
 assert.ok(seen.some(x=>x.includes('/api/roster/stats?sport=nba')));
 ui.handle('roster-select',{dataset:{id:'3945274'}});
 markup=ui.render();
 assert.match(markup,/Austin Reaves/);
 ui.handle('roster-analytics',{dataset:{}});
 assert.deepEqual(events,[['Austin Reaves','nba']]);
 ui.handle('roster-group',{dataset:{key:'F'}});
 assert.equal(ui.sortedList().length,1);
});
test('ESPN basketball roster request excludes unsupported season filter to avoid empty rosters',async()=>{
 const original=globalThis.fetch,seen=[];
 globalThis.fetch=async url=>{
   const u=String(url);seen.push(u);
   const data=u.includes('/roster')?{athletes:[{id:'1966',displayName:'LeBron James',position:{abbreviation:'SF'},age:41}]}
    :{depthCharts:[],leaders:[]};
   return {ok:true,json:async()=>data};
 };
 try{
   const r=await espnProviderFor('nba').roster('13',{season:2025});
   assert.equal(r[0].name,'LeBron James');
   assert.equal(r[0].age,41);
   assert.ok(seen.some(x=>x.endsWith('/teams/13/roster')));
   assert.ok(!seen.some(x=>x.includes('/teams/13/roster?season=')));
   assert.equal(r.length,1);
 }finally{globalThis.fetch=original}
});
test('NFL roster stat aggregation loads from a season-scoped ESPN gamelog endpoint',async()=>{
 const original=globalThis.fetch,seen=[];
 globalThis.fetch=async url=>{
   seen.push(String(url));
   return {ok:true,json:async()=>({events:{e1:{gameDate:'2026-10-01'}},seasonTypes:[{categories:[
     {name:'Passing',labels:['YDS','TD'],events:[{eventId:'e1',stats:['300','4']}]},
     {name:'Rushing',labels:['CAR','YDS'],events:[{eventId:'e1',stats:['4','26']}]}
   ]}]})};
 };
 try{
   const stat=await espnProviderFor('nfl').rosterStats('3139477',2026);
   assert.equal(stat.totals.PASSYDS,300);
   assert.equal(stat.totals.RUSHYDS,26);
   assert.ok(seen.some(url=>url.includes('gamelog?season=2026')));
   assert.ok(!seen.some(url=>url.includes('stats?season=2026'))); // Complete game log avoids redundant career-stat call.
 }finally{globalThis.fetch=original}
});

test('historical roster season picker includes every supported year through 1980, not just 2011',()=>{
 const browser=createRosterBrowser({api:async()=>({teams:[]}),refresh:()=>{}});
 const html=browser.render();
 assert.match(html,/<option value="1980"/);
 assert.match(html,/<option value="1996"/);
 assert.match(html,/<option value="2001"/);
 assert.match(html,/<option value="2011"/);
 assert.doesNotMatch(html,/<option value="1979"/);
});
