import fs from 'node:fs';
import path from 'node:path';
let webPush=null;try{webPush=(await import('web-push')).default}catch{}
const keyFile=path.join(path.resolve(process.env.LIVESTAT_DATA_DIR||'data'),'vapid.json');
if(webPush){
  if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY){
    let pair;try{pair=JSON.parse(fs.readFileSync(keyFile,'utf8'))}catch{
      fs.mkdirSync(path.dirname(keyFile),{recursive:true});pair=webPush.generateVAPIDKeys();
      fs.writeFileSync(keyFile,JSON.stringify(pair,null,2),{mode:0o600});
    }
    process.env.VAPID_PUBLIC_KEY=pair.publicKey;process.env.VAPID_PRIVATE_KEY=pair.privateKey;
  }
  webPush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:your-email@example.com',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
}
export const pushReady=()=>Boolean(webPush&&process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY);
export const publicVapidKey=()=>pushReady()?process.env.VAPID_PUBLIC_KEY:null;
export async function sendPush(state,alert){
  if(!pushReady())return;
  const milestone=alert.category==='target';
  const title=milestone?`🎯 MILESTONE! ${alert.name}`:`${alert.name} • ${alert.label}`;
  const payload=JSON.stringify({title:title+(alert.demo?' (DEMO)':''),body:`${alert.detail} — ${alert.game}${alert.clock?' · '+alert.clock:''}`,
    url:'/?view=activity',id:alert.id,milestone});
  await Promise.all(state.subscriptions.map(async sub=>{
    try{await webPush.sendNotification(sub,payload,{TTL:120,urgency:'high'});}catch(err){
      if([404,410].includes(err.statusCode))state.subscriptions=state.subscriptions.filter(s=>s.endpoint!==sub.endpoint);
      else console.warn('Push delivery issue:',err.message);
    }
  }));
}
