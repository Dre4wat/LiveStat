import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWatch} from '../src/engine/events.js';
import {makeMonitor} from '../src/engine/monitor.js';

test('game-specific watch persists a selected game ID',()=>{
  const rule=normalizeWatch({sport:'nba',kind:'player',name:'LeBron James',teamId:'13',playerId:'1966',gameId:'401000001',rules:{points:{every:true,target:15}}});
  assert.equal(rule.gameId,'401000001');
  assert.throws(()=>normalizeWatch({...rule,gameId:'not_a_game'}),/Invalid game/);
});

test('game-specific watch does not process identical team stats in another game',async()=>{
  const watch={...normalizeWatch({sport:'nba',kind:'player',name:'LeBron James',teamId:'13',playerId:'1966',gameId:'401000001',rules:{points:{every:true,target:15}}}),id:'w-1'};
  const other={id:'401000002',sport:'nba',name:'LAL at GSW (other)',live:true,teams:[{id:'13'},{id:'9'}]};
  const play={id:'play-3',gameId:other.id,text:'LeBron James makes 24-foot three point jumper',teamId:'13',scoreValue:3,scoringPlay:true};
  const stats={games:0,lastError:null},state={watches:[watch],alerts:[],stats,seen:{},notified:{},totals:{},totalsAt:{},subscriptions:[]};
  const providers={nba:{games:async()=>[other],plays:async()=>[play]}};
  const monitor=makeMonitor({providers,state,deliver:async()=>{}});
  await monitor.poll();
  assert.equal(stats.games,0);
  assert.equal(state.alerts.length,0);
});
