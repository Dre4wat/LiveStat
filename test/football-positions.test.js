import test from 'node:test';
import assert from 'node:assert/strict';
import {footballStatsForPosition,footballPositionGroup} from '../public/football-stats.js';
import {normalizeWatch,matchPlay} from '../src/engine/events.js';
import {extractBoxTotals} from '../src/providers/intelligence.js';

const watch=(position,name,stats)=>normalizeWatch({
  sport:'nfl',kind:'player',teamId:'1',playerId:'12345',
  name,position,rules:Object.fromEntries(stats.map(k=>[k,{every:true,target:null}]))
});
test('football positions offer appropriate stat options',()=>{
  assert.ok(footballStatsForPosition('QB').includes('passingYards'));
  assert.ok(footballStatsForPosition('QB').includes('rushingYards'));
  assert.ok(!footballStatsForPosition('QB').includes('tackles'));
  assert.ok(footballStatsForPosition('RB').includes('rushingYards'));
  assert.ok(footballStatsForPosition('WR').includes('targets'));
  assert.ok(footballStatsForPosition('TE').includes('receptions'));
  for(const pos of ['DE','DT','LB','OLB','CB','S','FS','SS'])assert.ok(footballStatsForPosition(pos).includes('tackles'),pos);
  assert.ok(footballStatsForPosition('K').includes('fieldGoalsMade'));
  assert.ok(footballStatsForPosition('P').includes('puntingYards'));
  assert.equal(footballPositionGroup('MLB'),'DEF');
});
test('QB passing plays count attempts, completions, yards, scores, interceptions',()=>{
  const w=watch('QB','Patrick Mahomes',['passingAttempts','completions','passingYards','passingTouchdowns','interceptionsThrown']);
  let plays=matchPlay({text:'P.Mahomes pass to T.Kelce for 24 yards, TOUCHDOWN.',teamId:'1'},w);
  assert.deepEqual(Object.fromEntries(plays.map(p=>[p.stat,p.delta])),{passingAttempts:1,completions:1,passingYards:24,passingTouchdowns:1});
  plays=matchPlay({text:'P.Mahomes pass intended for T.Kelce INTERCEPTED by defender.',teamId:'1'},w);
  assert.deepEqual(Object.fromEntries(plays.map(p=>[p.stat,p.delta])),{passingAttempts:1,interceptionsThrown:1});
});
test('rushing plays only credit the ballcarrier, including lost yards',()=>{
  const w=watch('RB','Bijan Robinson',['rushingAttempts','rushingYards','rushingTouchdowns']);
  const events=matchPlay({text:'B.Robinson rushes left guard for -3 yards (T.Watt)',teamId:'1'},w);
  assert.deepEqual(Object.fromEntries(events.map(p=>[p.stat,p.delta])),{rushingAttempts:1,rushingYards:-3});
  assert.equal(matchPlay({text:'Other Player rushes for 10 yards (B.Robinson)',teamId:'1'},w).length,0);
});
test('defensive players can save tackling and interception watches without false positive play credit',()=>{
 const w=watch('CB','Sauce Gardner',['tackles','sacks','interceptionsCaught','passesDefended','forcedFumbles']);
 assert.equal(w.position,'CB');
 assert.equal(w.rules.tackles.every,true);
 assert.equal(matchPlay({text:'Quarterback sacked! Sauce Gardner and other defender mentioned.',teamId:'2'},w).length,0);
});
test('boxscore contextual stats do not confuse passing and receiving YDS',()=>{
 const box={groups:[{teamId:'1',sections:[
   {name:'Passing',labels:['C/ATT','YDS','TD','INT'],rows:[{id:'12345',stats:['25/36','297','3','1']}]},
   {name:'Rushing',labels:['CAR','YDS','TD'],rows:[{id:'12345',stats:['4','35','1']}]},
   {name:'Receiving',labels:['REC','YDS','TGTS'],rows:[{id:'12345',stats:['0','0','0']}]}
 ]}]};
 const got=extractBoxTotals(box,{sport:'nfl',teamId:'1',playerId:'12345',kind:'player'});
 assert.deepEqual(got,{completions:25,passingAttempts:36,passingYards:297,passingTouchdowns:3,interceptionsThrown:1,rushingAttempts:4,rushingYards:35,rushingTouchdowns:1,receptions:0,receivingYards:0,targets:0});
});
test('defensive boxscore totals include tackles, sacks, picks, FF, FR',()=>{
 const box={groups:[{teamId:'1',sections:[
  {name:'Defensive',labels:['TOT','SOLO','AST','SACKS','TFL','PD','INT','FF','FR','TD'],rows:[{id:'12345',stats:['10','7','3','1.5','2','3','1','1','0','1']}]}
 ]}]};
 const got=extractBoxTotals(box,{sport:'cfb',teamId:'1',playerId:'12345',kind:'player'});
 assert.equal(got.tackles,10);assert.equal(got.soloTackles,7);assert.equal(got.assistedTackles,3);
 assert.equal(got.sacks,1.5);assert.equal(got.interceptionsCaught,1);
 assert.equal(got.forcedFumbles,1);assert.equal(got.passesDefended,3);
});
test('special teams parse made/attempted kicking totals',()=>{
 const box={groups:[{teamId:'1',sections:[{name:'Kicking',labels:['FG','XP'],rows:[{id:'12345',stats:['2/3','4/4']}]}]}]};
 const x=extractBoxTotals(box,{sport:'nfl',teamId:'1',playerId:'12345',kind:'player'});
 assert.deepEqual(x,{fieldGoalsMade:2,fieldGoalsAttempted:3,extraPointsMade:4,extraPointsAttempted:4});
});
