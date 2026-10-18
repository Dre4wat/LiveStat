// Optional Discord relay. Never expose or log stored webhook URLs.
const rate=new Map();
export function validateWebhook(url){
 try{
  const u=new URL(String(url||''));
  if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
  if(!['discord.com','discordapp.com'].includes(u.hostname))return false;
  return /^\/api\/webhooks\/[0-9]{10,25}\/[A-Za-z0-9._-]{20,180}$/.test(u.pathname) && !u.search && !u.hash;
 }catch{return false;}
}
export function safeDiscordMessage(alert){
 const name=String(alert?.name||'LiveStat').slice(0,100);
 const detail=String(alert?.detail||'New event').slice(0,600);
 const game=String(alert?.game||'').slice(0,120);
 const type=String(alert?.category||'every');
 return {
  username:'LiveStat Alerts',
  allowed_mentions:{parse:[]},
  embeds:[{
   title:(type==='target'?'🏆 Target Reached':type==='near'?'🎯 Almost There':type==='correction'?'↻ Stat Correction':'⚡ Stat Update')+' — '+name,
   description:detail,
   color:type==='target'?15152430:15011391,
   fields:game?[{name:'Game',value:game,inline:false}]:[],
   footer:{text:'LiveStat · Unofficial ESPN data may be delayed or corrected'}
  }]
 };
}
export async function sendDiscordAlert(config,alert,fetcher=fetch){
 if(!config?.enabled||!validateWebhook(config.url)||alert?.demo)return {sent:false};
 const types=config.types||['target'];
 if(!types.includes(alert.category))return {sent:false};
 const owner=String(alert.ownerId||config.ownerId||'');
 const now=Date.now(),hit=rate.get(owner)||{window:now,count:0};
 if(now-hit.window>=60000){hit.window=now;hit.count=0;}
 if(hit.count>=18)return {sent:false,rateLimited:true};
 hit.count++;rate.set(owner,hit);
 try{
  const r=await fetcher(config.url,{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{'content-type':'application/json'},
   body:JSON.stringify(safeDiscordMessage(alert))
  });
  return {sent:r.ok};
 }catch{return {sent:false};}
}
