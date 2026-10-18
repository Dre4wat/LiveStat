import {espnProviders} from '../src/providers/espn.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBoxScore} from '../src/providers/boxscore.js';
import {boxscoreMarkup} from '../public/boxscore.js';

function fixture(){
 return {
  header:{competitions:[{status:{type:{state:'in',detail:'Q3 · 4:55'}},competitors:[
   {team:{id:'13',displayName:'Los Angeles Lakers',abbreviation:'LAL'},score:'83',homeAway:'away'},
   {team:{id:'9',displayName:'Golden State Warriors',abbreviation:'GSW'},score:'91',homeAway:'home'}
  ]}]},
  boxscore:{
   teams:[{team:{id:'13'},statistics:[{name:'rebounds',label:'Rebounds',displayValue:'36'}]},
          {team:{id:'9'},statistics:[{name:'rebounds',label:'Rebounds',displayValue:'41'}]}],
   players:[{team:{id:'13'},statistics:[{displayName:'Game Stats',labels:['MIN','PTS','REB','AST'],athletes:[
     {athlete:{id:'1966',displayName:'LeBron James',position:{abbreviation:'SF'}},stats:['31','23','7','8']}
   ],totals:['31','23','7','8']}]}]
  }
 };
}
test('NBA box score normalizes scores, team totals, players and game state',()=>{
 const x=normalizeBoxScore('nba','401000001',fixture());
 assert.equal(x.teams[0].abbr,'LAL');
 assert.equal(x.teams[1].score,'91');
 assert.equal(x.teams[0].stats[0].value,'36');
 assert.equal(x.groups[0].sections[0].rows[0].stats[1],'23');
 assert.equal(x.groups[0].sections[0].rows[0].position,'SF');
 assert.equal(x.state,'in');
 assert.equal(x.hasStats,true);
});
test('football categories retain their original columns and are grouped by team',()=>{
 const data=fixture();
 data.boxscore.players=[{team:{id:'13'},statistics:[
  {displayName:'Passing',labels:['C/ATT','YDS','TD','INT'],athletes:[{athlete:{id:'44',displayName:'QB One'},stats:['25/31','326','3','1']}]},
  {displayName:'Receiving',labels:['REC','YDS','TD'],athletes:[{athlete:{id:'55',displayName:'WR One'},stats:['8','111','2']}]}
 ]}];
 const x=normalizeBoxScore('nfl','401000002',data);
 assert.deepEqual(x.groups[0].sections.map(g=>g.name),['Passing','Receiving']);
 assert.equal(x.groups[0].sections[1].rows[0].stats[1],'111');
});
test('pregame with absent statistics is handled without errors',()=>{
 const x=normalizeBoxScore('cfb','401000003',{header:{competitions:[{competitors:[{team:{id:'1',displayName:'Team A',abbreviation:'AAA'},score:'0'}]}]}});
 assert.equal(x.hasStats,false);
 assert.equal(x.teams[0].name,'Team A');
 const html=boxscoreMarkup({game:{state:'pre'},boxscore:x,sport:'cfb'});
 assert.match(html,/No box score is available yet/);
});
test('box score view renders team tabs and scrollable stat tables',()=>{
 const x=normalizeBoxScore('nba','401000001',fixture());
 const html=boxscoreMarkup({game:{state:'in'},boxscore:x,sport:'nba'});
 assert.match(html,/LeBron James/);
 assert.match(html,/TEAM COMPARISON/);
 assert.match(html,/data-action="boxteam"/);
 assert.match(html,/bs-table-scroll/);
 assert.match(html,/data-action="boxtrack"/);
});
test('untrusted athlete and stat strings are escaped',()=>{
 const data=fixture();
 data.boxscore.players[0].statistics[0].athletes[0].athlete.displayName='<img src=x onerror=alert(1)>';
 const x=normalizeBoxScore('nba','401000001',data);
 const html=boxscoreMarkup({game:{state:'in'},boxscore:x,sport:'nba'});
 assert.doesNotMatch(html,/<img src=x/);
 assert.match(html,/&lt;img src=x/);
});

test('each league exposes a box-score data provider',()=>{
 for(const sport of ['nfl','cfb','nba','ncaam','ncaaw'])assert.equal(typeof espnProviders[sport]?.boxScore,'function');
});
