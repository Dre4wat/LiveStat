import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {makeMonitor} from '../src/engine/monitor.js';
const watch={id:'watch1',kind:'player',name:'Chris Olave',teamId:'18',playerId:'123',stats:['targets','receivingYards','fumbles']};
test('primes previous plays then produces three distinct target alerts without duplicates',async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'livestat-test-'));
  process.env.LIVESTAT_DATA_DIR=tmp;
  try {
  let plays=[{id:'old',text:'D.Carr pass incomplete to C.Olave.',teamId:'18'}];
  const sent=[];
  const state={watches:[watch],subscriptions:[],seen:{},notified:{},alerts:[],stats:{}};
  const provider={games:async()=>[{id:'123456789',name:'Demo game',live:true,teams:[{id:'18'}]}],plays:async()=>plays};
  const monitor=makeMonitor({provider,state,deliver:async x=>sent.push(x),emit:()=>{}});
  await monitor.poll();assert.equal(sent.length,0);
  plays=[...plays,{id:'1',text:'D.Carr pass incomplete to C.Olave.',teamId:'18'},{id:'2',text:'D.Carr pass to C.Olave for 9 yards.',teamId:'18'},{id:'3',text:'D.Carr pass incomplete to C.Olave.',teamId:'18'}];
  await monitor.poll();
  assert.equal(sent.filter(x=>x.stat==='targets').length,3);
  assert.equal(sent.filter(x=>x.stat==='receivingYards').length,1);
  await monitor.poll();assert.equal(sent.length,4);
  } finally { delete process.env.LIVESTAT_DATA_DIR;fs.rmSync(tmp,{recursive:true,force:true}); }
});
