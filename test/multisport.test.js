import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {normalizeWatch,matchPlay} from '../src/engine/events.js';
import {makeMonitor} from '../src/engine/monitor.js';
const james={id:'lbj',sport:'nba',kind:'player',teamId:'13',playerId:'1966',name:'LeBron James',
  rules:{points:{every:true,target:15}}};
const play=(id,text,scoreValue)=>({id,text,teamId:'13',scoreValue,scoringPlay:scoreValue>0,period:2,clock:'7:32'});
const setup=()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'livestat-multi-test-'));
  process.env.LIVESTAT_DATA_DIR=tmp;
  const state={watches:[james],subscriptions:[],alerts:[],seen:{},notified:{},totals:{},totalsAt:{},stats:{}};
  const sent=[];
  let plays=[play('1','LeBron James makes 12-foot two point jumper',2)];
  const provider={games:async()=>[{id:'401766122',name:'Lakers vs Celtics',live:true,teams:[{id:'13'},{id:'2'}]}],plays:async()=>plays};
  const monitor=makeMonitor({providers:{nba:provider},state,deliver:async a=>sent.push(a)});
  return {tmp,state,sent,monitor,setPlays:next=>plays=next,dispose:()=>{delete process.env.LIVESTAT_DATA_DIR;fs.rmSync(tmp,{recursive:true,force:true})}};
};
test('LeBron 3-pointer sends one +3 points alert and one 15-point milestone',async()=>{
  const t=setup();try{
    const baseline=[play('old','LeBron James makes 24-foot three point jumper',3),
      play('old2','LeBron James makes 10-foot two point jumper',2),
      play('old3','LeBron James makes 25-foot three point jumper',3),
      play('old4','LeBron James makes 18-foot two point jumper',2),
      play('old5','LeBron James makes 16-foot two point jumper',2),
      play('old6','LeBron James makes free throw 1 of 2',1),
      play('old7','LeBron James makes free throw 2 of 2',1)]; // 14 points
    t.setPlays(baseline);await t.monitor.poll();assert.equal(t.sent.length,0);
    t.setPlays([...baseline,play('new','LeBron James makes 26-foot three point jumper',3)]);
    await t.monitor.poll();
    assert.equal(t.sent.filter(a=>a.category==='every').length,1);
    const pointsAlert=t.sent.find(a=>a.category==='every');
    assert.equal(pointsAlert.delta,3);
    assert.equal(pointsAlert.total,17);
    assert.match(pointsAlert.detail,/\+3 points.*Total: 17/);
    assert.equal(t.sent.filter(a=>a.category==='target').length,1);
    assert.equal(t.sent.find(a=>a.category==='target').target,15);
    await t.monitor.poll();assert.equal(t.sent.length,2);
    t.setPlays([...baseline,play('new','LeBron James makes 26-foot three point jumper',3),play('more','LeBron James makes 3-foot layup',2)]);
    await t.monitor.poll();assert.equal(t.sent.filter(a=>a.category==='every').length,2);
    assert.deepEqual(t.sent.filter(a=>a.category==='every').map(a=>a.delta),[3,2]);
    assert.equal(t.sent.filter(a=>a.category==='target').length,1);
  }finally{t.dispose()}
});
test('target-only rule fires one milestone with no per-play scoring alerts',async()=>{
  const t=setup();try{
    t.state.watches[0]={...james,rules:{points:{every:false,target:3}}};
    await t.monitor.poll();
    t.setPlays([play('1','LeBron James makes 12-foot two point jumper',2),play('2','LeBron James makes 25-foot three point jumper',3)]);
    await t.monitor.poll();assert.equal(t.sent.length,1);assert.equal(t.sent[0].category,'target');
  }finally{t.dispose()}
});
test('points do not go to LeBron when Bronny James scores',()=>{
  assert.deepEqual(matchPlay(play('1','Bronny James makes 25-foot three point jumper',3),james),[]);
  assert.deepEqual(matchPlay(play('2','LeBron James misses 25-foot three point jumper',0),james),[]);
});
test('college basketball uses basketball parser and teams use same scoring feed',()=>{
  const w={...james,sport:'ncaam',name:'Alex Player'};
  assert.deepEqual(matchPlay(play('4','Alex Player makes 2-foot layup',2),w).map(e=>[e.stat,e.delta]),[['points',2]]);
  const tw=normalizeWatch({sport:'ncaaw',kind:'team',teamId:'18',name:'College Team',rules:{points:{every:false,target:80}}});
  assert.deepEqual(matchPlay({...play('5','Taylor Athlete makes three point jumper',3),teamId:'18'},tw).map(e=>e.delta),[3]);
});
test('college football player receives football events',()=>{
  const w=normalizeWatch({sport:'cfb',kind:'player',teamId:'222',playerId:'1234',name:'Alex Receiver',rules:{targets:{every:true,target:3},receivingYards:{every:true,target:15}}});
  assert.deepEqual(matchPlay({text:'A.QB pass to A.Receiver for 16 yards.',teamId:'222'},w).map(e=>e.stat),['targets','receivingYards']);
});
test('reject malformed targets and empty alert methods',()=>{
  assert.throws(()=>normalizeWatch({...james,rules:{points:{every:false,target:0}}}),/Invalid target/);
  assert.throws(()=>normalizeWatch({...james,rules:{points:{every:false,target:null}}}),/Select at least/);
  assert.deepEqual(normalizeWatch(james).rules.points,{every:true,target:15});
});

test('college basketball team 3-pointer produces one +3 points change and one threshold alert',async()=>{
  const t=setup();try{
    t.state.watches[0]={...james,id:'college',sport:'ncaam',kind:'team',name:'College Team',teamId:'18',playerId:'',rules:{points:{every:true,target:4}}};
    const provider={games:async()=>[{id:'123',name:'College Game',live:true,teams:[{id:'18'},{id:'19'}]}],plays:async()=>tPlays};
    let tPlays=[{id:'old',text:'Alex Player makes 3-foot layup',teamId:'18',scoreValue:2,scoringPlay:true}];
    const monitor=makeMonitor({providers:{ncaam:provider},state:t.state,deliver:async a=>t.sent.push(a)});
    await monitor.poll();assert.equal(t.sent.length,0);
    tPlays=[...tPlays,{id:'new',text:'Alex Player makes 26-foot three point jumper',teamId:'18',scoreValue:3,scoringPlay:true}];
    await monitor.poll();
    assert.equal(t.sent.length,2);
    assert.equal(t.sent.filter(a=>a.category==='every').length,1);
    assert.equal(t.sent.filter(a=>a.category==='target').length,1);
    assert.equal(t.sent.find(a=>a.category==='every').delta,3);
    assert.equal(t.sent.find(a=>a.category==='every').total,5);
    assert.equal(t.sent.find(a=>a.category==='target').target,4);
  }finally{t.dispose()}
});

test('football 20-yard catch creates one yardage alert plus target crossing, not 20 notifications',async()=>{
  const t=setup();try{
    const olave={id:'olave',sport:'nfl',kind:'player',teamId:'18',playerId:'123',name:'Chris Olave',rules:{receivingYards:{every:true,target:15}}};
    t.state.watches=[olave];
    let tPlays=[{id:'old',text:'D.Carr pass incomplete to C.Olave.',teamId:'18'}];
    const provider={games:async()=>[{id:'123',name:'Saints Game',live:true,teams:[{id:'18'},{id:'1'}]}],plays:async()=>tPlays};
    const monitor=makeMonitor({providers:{nfl:provider},state:t.state,deliver:async a=>t.sent.push(a)});
    await monitor.poll();assert.equal(t.sent.length,0);
    tPlays=[...tPlays,{id:'catch',text:'D.Carr pass to C.Olave for 20 yards.',teamId:'18'}];
    await monitor.poll();
    assert.equal(t.sent.filter(a=>a.category==='every').length,1);
    assert.equal(t.sent.filter(a=>a.category==='target').length,1);
    assert.equal(t.sent.find(a=>a.category==='every').delta,20);
    assert.match(t.sent.find(a=>a.category==='every').detail,/\+20 receiving yards.*Total: 20/);
    await monitor.poll();assert.equal(t.sent.length,2);
  }finally{t.dispose()}
});
