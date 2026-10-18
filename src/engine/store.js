import fs from 'node:fs';
import path from 'node:path';
const dir = () => path.resolve(process.env.LIVESTAT_DATA_DIR || 'data');
const file = () => path.join(dir(),'state.json');
const initial = () => ({watches:[], subscriptions:[], alerts:[], seen:{}, notified:{}, totals:{}, totalsAt:{}, stats:{lastPoll:null, lastError:null, games:0}});
export function loadStore(){
  fs.mkdirSync(dir(),{recursive:true});
  try {return {...initial(),...JSON.parse(fs.readFileSync(file(),'utf8'))};}
  catch {return initial();}
}
export function writeStore(state){
  fs.mkdirSync(dir(),{recursive:true});
  const tmp=file()+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(state,null,2));
  fs.renameSync(tmp,file());
}
export function pruneStore(state){
  state.alerts=state.alerts.slice(0,250);
  // Retain a bounded recent record of processed plays; no re-alerting on restart.
  for (const [game,rec] of Object.entries(state.seen)) {
    if(Date.now()-(rec.at || 0)>8*86400000) delete state.seen[game];
    else rec.ids=rec.ids.slice(-1800);
  }
  for (const [game,at] of Object.entries(state.totalsAt||{})) {
    if(Date.now()-at>8*86400000){
      delete state.totalsAt[game];
      for(const k of Object.keys(state.totals))if(k.startsWith(game+':'))delete state.totals[k];
    }
  }
  const keys=Object.keys(state.notified);
  if(keys.length>15000) {
    for(const k of keys.slice(0,keys.length-15000)) delete state.notified[k];
  }
}
