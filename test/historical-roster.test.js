import test from 'node:test';
import assert from 'node:assert/strict';
import {
 parseNBASeasonRoster,historicalGameSample,rosterFromHistoricalBoxes,combineHistoricalRosters
} from '../src/providers/historical-roster.js';
import {createRosterBrowser} from '../public/roster-browser.js';
const fixture='<table id="roster"><tbody>'+
 '<tr><th data-stat="number">4</th><td data-stat="player" data-append-csv="westbru01"><a>Russell Westbrook</a></td><td data-stat="pos">PG</td><td data-stat="height">6-3</td><td data-stat="weight">200</td></tr>'+
 '<tr><th data-stat="number">3</th><td data-stat="player" data-append-csv="bealbr01"><a>Bradley Beal</a></td><td data-stat="pos">SG</td><td data-stat="height">6-4</td><td data-stat="weight">207</td></tr>'+
 '</tbody></table><table id="per_game_stats"><tbody>'+
 '<tr><td data-stat="player" data-append-csv="westbru01"><a>Russell Westbrook</a></td><td data-stat="games">65</td><td data-stat="pts_per_g">22.2</td><td data-stat="ast_per_g">11.7</td><td data-stat="trb_per_g">11.5</td></tr>'+
 '<tr><td data-stat="player" data-append-csv="bealbr01"><a>Bradley Beal</a></td><td data-stat="games">60</td><td data-stat="pts_per_g">31.3</td><td data-stat="ast_per_g">4.4</td></tr>'+
 '</tbody></table>';
const box={
 boxscore:{players:[
 {team:{id:'27',displayName:'Washington Wizards'},statistics:[
   {athletes:[
      {athlete:{id:'3468',displayName:'Russell Westbrook',position:{abbreviation:'PG'},jersey:'4'},starter:true},
      {athlete:{id:'6580',displayName:'Bradley Beal',position:{abbreviation:'SG'},jersey:'3'},starter:true}
   ]}
 ]},
 {team:{id:'20',displayName:'Philadelphia 76ers'},statistics:[
   {athletes:[{athlete:{id:'3059318',displayName:'Joel Embiid'}}]}
 ]}
 ]}};
test('2020-21 Wizards seasonal roster contains Westbrook and Beal with real season averages, no future athlete',()=>{
 const p=parseNBASeasonRoster(fixture,2021);
 assert.deepEqual(new Set(p.map(x=>x.name)),new Set(['Russell Westbrook','Bradley Beal']));
 assert.equal(p.find(x=>x.name==='Russell Westbrook').seasonStats.averages.PTS,22.2);
 assert.equal(p.find(x=>x.name==='Bradley Beal').seasonStats.averages.PTS,31.3);
 const rosters=rosterFromHistoricalBoxes([box],27);
 assert.deepEqual(rosters.map(x=>x.id),['3468','6580']);
 const merged=combineHistoricalRosters(p,rosters,27);
 assert.equal(merged.find(x=>x.name==='Russell Westbrook').id,'3468');
 assert.equal(merged.find(x=>x.name==='Bradley Beal').id,'6580');
 assert.equal(merged.some(x=>/dybantsa/i.test(x.name)),false);
 assert.equal(merged.some(x=>/embiid/i.test(x.name)),false);
});
test('NBA historic roster with no ESPN ID preserves season membership and stat table under bref id',()=>{
 const roster=parseNBASeasonRoster(fixture,2021);
 const result=combineHistoricalRosters(roster,[],27);
 assert.ok(result.every(p=>p.id.startsWith('bref:')));
 assert.ok(result.every(p=>p.seasonStats.averages.PTS>0));
});
test('Historical games are distributed across season, not all selected from opening week',()=>{
 const games=Array.from({length:72},(_,i)=>({id:String(1000+i),season:{type:2}}));
 const out=historicalGameSample(games,16);
 assert.equal(out.length,16);
 assert.equal(out[0].id,'1000');
 assert.equal(out.at(-1).id,'1071');
});
test('Current roster remains separate while historical UI shows selected-season source and stats',async()=>{
 const sources=[],api=async url=>{
  sources.push(url);
  if(url.startsWith('/api/teams'))return {teams:[{id:'27',name:'Washington Wizards',abbreviation:'WSH'}]};
  if(url.startsWith('/api/roster?'))return {
    historical:true,season:2021,source:'Basketball-Reference season roster + ESPN historical game box scores',
    rosterComplete:true,note:'Roster membership reflects the selected season',players:combineHistoricalRosters(
      parseNBASeasonRoster(fixture,2021),rosterFromHistoricalBoxes([box],27),27)
  };
  if(url.startsWith('/api/roster/profile'))return {player:{name:'Russell Westbrook'}};
  return {stats:{},errors:[]};
 };
 const browser=createRosterBrowser({api,refresh:()=>{},toast:()=>{}});
 browser.state.season=2021;
 await browser.open('nba');
 const html=browser.render();
 assert.match(html,/HISTORICAL 2021 TEAM ROSTER/);
 assert.match(html,/Russell Westbrook/);
 assert.match(html,/Bradley Beal/);
 assert.doesNotMatch(html,/Aj Dybantsa/i);
 assert.match(html,/22\.2/);
 assert.ok(sources.some(x=>x.includes('season=2021')));
});
