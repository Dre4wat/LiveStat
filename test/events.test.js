import test from 'node:test';
import assert from 'node:assert/strict';
import {matchPlay,normalizeWatch} from '../src/engine/events.js';
const watch={kind:'player',name:'Chris Olave',teamId:'18',playerId:'1',stats:['targets','receivingYards','fumbles','receptions','receivingTouchdowns']};
const play=text=>({id:'a',text,teamId:'18'});
test('incomplete target is one alert',()=>{
  assert.deepEqual(matchPlay(play('D.Carr pass incomplete short right to C.Olave.'),watch).map(x=>x.stat),['targets']);
});
test('completed catch produces target, reception and yards alerts',()=>{
  assert.deepEqual(matchPlay(play('D.Carr pass short left to C.Olave to NO 42 for 14 yards (M.Smith).'),watch).map(x=>x.stat),['targets','receptions','receivingYards']);
});
test('receiving TD alerts separately',()=>{
  assert.deepEqual(matchPlay(play('D.Carr pass to Chris Olave for 24 yards TOUCHDOWN.'),watch).map(x=>x.stat),['targets','receptions','receivingYards','receivingTouchdowns']);
});
test('player credited for fumble, not recovery',()=>{
  assert.deepEqual(matchPlay(play('Chris Olave FUMBLES (Demo), recovered by DEF.'),watch).map(x=>x.stat),['fumbles']);
  assert.deepEqual(matchPlay(play('D.Carr FUMBLES, recovered by Chris Olave.'),watch).map(x=>x.stat),[]);
});
test('not quarterback when player is passer',()=>{
  assert.deepEqual(matchPlay(play('Chris Olave pass incomplete to Mike Evans.'),watch),[]);
});
test('stat filter is respected',()=>{
  assert.deepEqual(matchPlay(play('D.Carr pass to Chris Olave for 14 yards.'),{...watch,stats:['targets']}).map(x=>x.stat),['targets']);
});
test('validates watch fields',()=>{
  assert.equal(normalizeWatch({...watch,stats:['targets','fake','targets']}).stats.length,1);
  assert.throws(()=>normalizeWatch({...watch,stats:[]}),/statistic/);
});
