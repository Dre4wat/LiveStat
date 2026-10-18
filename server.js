import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {espnProviders,SPORTS} from './src/providers/espn.js';
import {makeMonitor} from './src/engine/monitor.js';
import {normalizeWatch} from './src/engine/events.js';
import {loadStore,writeStore} from './src/engine/store.js';
import {sendPush,pushReady,publicVapidKey} from './src/engine/push.js';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
process.chdir(ROOT);
const PORT=Number(process.env.PORT||3000),POLL=Math.max(10,Number(process.env.POLL_SECONDS)||12);
const state=loadStore();
// Each visitor gets an anonymous, signed browser cookie. There is no code to enter.
// Cookies isolate saved watches, notification history and push subscriptions.
const secretFile=path.join(path.resolve(process.env.LIVESTAT_DATA_DIR||path.join(ROOT,'data')),'session-secret');
let sessionSecret=process.env.SESSION_SECRET;
if(!sessionSecret){
  if(fs.existsSync(secretFile))sessionSecret=fs.readFileSync(secretFile,'utf8').trim();
  else {sessionSecret=crypto.randomBytes(32).toString('hex');fs.writeFileSync(secretFile,sessionSecret,{mode:0o600});}
}
const sign=id=>crypto.createHmac('sha256',sessionSecret).update(id).digest('hex');
function visitorId(req,res){
  const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split('=').slice(0,2)).filter(x=>x.length===2));
  const [raw,signature]=(cookies.livestat_session||'').split('.');
  if(raw&&signature&&/^[a-f0-9]{48}$/.test(raw)&&/^[a-f0-9]{64}$/.test(signature)){
    const expected=sign(raw);
    if(crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))return raw;
  }
  const id=crypto.randomBytes(24).toString('hex');
  const secure=req.socket.encrypted||String(req.headers['x-forwarded-proto']||'').split(',')[0].trim()==='https';
  res.setHeader('Set-Cookie',`livestat_session=${id}.${sign(id)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure?'; Secure':''}`);
  return id;
}
function allowWrite(req){
  // Prevent a malicious third-party website from changing another browser's watches.
  if(req.headers['sec-fetch-site']==='cross-site')return false;
  const origin=req.headers.origin;
  if(!origin)return true;
  try{return new URL(origin).host===req.headers.host;}catch{return false;}
}
const teamCache=new Map(),rosterCache=new Map();
const boxScoreCache=new Map(); // Refresh live box scores frequently without flooding ESPN.

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};

async function body(req){
 let value='';for await(const chunk of req){value+=chunk;if(value.length>100000)throw new Error('Request too large');}
 try{return JSON.parse(value||'{}')}catch{throw new Error('Invalid JSON')}
}
const monitor=makeMonitor({providers:espnProviders,state,deliver:async a=>{
  const rule=state.watches.find(w=>w.id===a.watchId);
  // Do not broadcast someone's alerts to every visitor!
  a.ownerId=rule?.ownerId||null;
  if(!a.ownerId)return;
  const scoped={subscriptions:state.subscriptions.filter(s=>s.ownerId===a.ownerId)};
  await sendPush(scoped,a);
  // Drop expired subscriptions detected by the push sender.
  const valid=new Set(scoped.subscriptions.map(s=>s.endpoint));
  state.subscriptions=state.subscriptions.filter(s=>s.ownerId!==a.ownerId||valid.has(s.endpoint));
}});
async function handle(req,res){
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`),route=url.pathname;
  if(route.startsWith('/api/')){
    const ownerId=visitorId(req,res);
    if(!['GET','HEAD'].includes(req.method)&&!allowWrite(req))return send(res,403,{error:'Cross-site updates are not allowed'});
    if(route==='/api/config'&&req.method==='GET')return send(res,200,{provider:'ESPN unofficial free',sports:SPORTS,pollSeconds:POLL,pushConfigured:pushReady(),vapidPublicKey:publicVapidKey()});
    if(req.method==='GET'&&route==='/api/status'){
      const watches=state.watches.filter(w=>w.ownerId===ownerId);
      return send(res,200,{...state.stats,watches,alerts:state.alerts.filter(a=>a.ownerId===ownerId).slice(0,250),pushConfigured:pushReady(),subscriberCount:state.subscriptions.filter(s=>s.ownerId===ownerId).length,provider:'ESPN unofficial free'});
    }
    if(req.method==='GET'&&route==='/api/teams'){
      const sport=url.searchParams.get('sport')||'nfl',provider=espnProviders[sport];if(!provider)throw new Error('Invalid league');
      let entry=teamCache.get(sport);
      if(!entry||Date.now()-entry.at>86400000){entry={at:Date.now(),data:await provider.teams()};teamCache.set(sport,entry);}
      return send(res,200,{teams:entry.data});
    }
    if(req.method==='GET'&&route==='/api/roster'){
      const sport=url.searchParams.get('sport')||'nfl',teamId=url.searchParams.get('team')||'';
      if(!espnProviders[sport]||!/^\d{1,8}$/.test(teamId))throw new Error('Invalid league or team');
      const k=`${sport}:${teamId}`;let entry=rosterCache.get(k);
      if(!entry||Date.now()-entry.at>21600000){entry={at:Date.now(),data:await espnProviders[sport].roster(teamId)};rosterCache.set(k,entry);}
      return send(res,200,{players:entry.data});
    }
    if(req.method==='GET'&&route==='/api/games'){
      const sport=url.searchParams.get('sport')||'nfl',date=url.searchParams.get('date')||'';
      if(!espnProviders[sport])throw new Error('Invalid league');
      if(date&&!/^\d{8}$/.test(date))throw new Error('Invalid date');
      return send(res,200,{games:await espnProviders[sport].games({date})});
    }
    if(req.method==='GET'&&route==='/api/boxscore'){
      const sport=url.searchParams.get('sport')||'nfl',game=url.searchParams.get('game')||'';
      if(!espnProviders[sport]||!/^[0-9]{6,14}$/.test(game))throw new Error('Invalid league or game');
      const key=sport+':'+game,now=Date.now();
      const cached=boxScoreCache.get(key);
      if(cached && now-cached.at<cached.ttl)return send(res,200,{boxscore:cached.data});
      const data=await espnProviders[sport].boxScore(game);
      const ttl=data.state==='in'?12000:data.state==='post'?120000:30000;
      boxScoreCache.set(key,{at:now,ttl,data});
      if(boxScoreCache.size>150){const old=boxScoreCache.keys().next().value;boxScoreCache.delete(old);}
      return send(res,200,{boxscore:data});
    }
    if(req.method==='POST'&&route==='/api/watches'){
      const watch=normalizeWatch(await body(req));
      if(state.watches.filter(w=>w.ownerId===ownerId).length>=40)throw new Error('Up to 40 alert rules per browser');
      if(state.watches.length>=500)throw new Error('Public demo is at capacity');
      const duplicate=state.watches.find(w=>w.ownerId===ownerId&&(w.sport||'nfl')===watch.sport&&w.kind===watch.kind&&w.teamId===watch.teamId&&w.playerId===watch.playerId&&String(w.gameId||'')===watch.gameId);
      if(duplicate){duplicate.rules=watch.rules;duplicate.stats=watch.stats;duplicate.name=watch.name;writeStore(state);return send(res,200,{watch:duplicate,updated:true});}
      const saved={...watch,ownerId,id:crypto.randomUUID(),createdAt:new Date().toISOString()};
      state.watches.push(saved);writeStore(state);return send(res,201,{watch:saved});
    }
    if(req.method==='DELETE'&&route.startsWith('/api/watches/')){
      const id=route.split('/').pop();state.watches=state.watches.filter(w=>w.id!==id||w.ownerId!==ownerId);writeStore(state);return send(res,200,{ok:true});
    }
    if(req.method==='POST'&&route==='/api/sample'){
      const d=await body(req),sport=d.sport==='nfl'?'nfl':'nba';
      const preset=sport==='nba'
        ?{sport:'nba',kind:'player',playerId:'1966',teamId:'13',name:'LeBron James',rules:{points:{every:true,target:15}},sample:true}
        :{sport:'nfl',kind:'player',playerId:'99999999',teamId:'18',name:'Chris Olave',rules:{targets:{every:true,target:null},receivingYards:{every:true,target:15},fumbles:{every:true,target:null}},sample:true};
      let watch=state.watches.find(w=>w.ownerId===ownerId&&w.name===preset.name&&(w.sport||'nfl')===sport);
      if(!watch){watch={...normalizeWatch(preset),ownerId,id:crypto.randomUUID(),createdAt:new Date().toISOString(),sample:true};state.watches.push(watch);}
      return send(res,200,{count:await monitor.simulate(watch),watch});
    }
    if(req.method==='POST'&&route==='/api/demo'){
      const d=await body(req),watch=state.watches.find(w=>w.id===d.watchId&&w.ownerId===ownerId);
      if(!watch)throw new Error('Select a saved alert rule');
      return send(res,200,{count:await monitor.simulate(watch)});
    }
    if(req.method==='POST'&&route==='/api/subscription'){
      if(!pushReady())throw new Error('Web Push unavailable: run npm install and restart');
      const sub=await body(req);
      if(!/^https:\/\//.test(String(sub.endpoint||''))||!sub.keys?.auth||!sub.keys?.p256dh)throw new Error('Invalid push subscription');
      state.subscriptions=state.subscriptions.filter(s=>s.endpoint!==sub.endpoint);
      state.subscriptions.push({ownerId,endpoint:sub.endpoint,expirationTime:sub.expirationTime||null,keys:{auth:sub.keys.auth,p256dh:sub.keys.p256dh}});
      const own=state.subscriptions.filter(s=>s.ownerId===ownerId).slice(-3);
      state.subscriptions=state.subscriptions.filter(s=>s.ownerId!==ownerId).concat(own);
      writeStore(state);return send(res,200,{ok:true});
    }
    if(req.method==='POST'&&route==='/api/test-push'){
      const scoped={subscriptions:state.subscriptions.filter(s=>s.ownerId===ownerId)};
      await sendPush(scoped,{id:crypto.randomUUID(),name:'LiveStat',label:'Test notification',detail:'Your device is connected',game:'Test only',demo:true});
      return send(res,200,{ok:true,subscribers:scoped.subscriptions.length});
    }
    return send(res,404,{error:'Unknown API route'});
  }
  if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Method not allowed'});
  const file=path.resolve(ROOT,'public','.'+(route==='/'?'/index.html':route));
  if(!file.startsWith(path.join(ROOT,'public')+path.sep))return send(res,403,{error:'Denied'});
  let st;try{st=fs.statSync(file)}catch{return send(res,404,{error:'Not found'})}
  if(!st.isFile())return send(res,404,{error:'Not found'});
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream',
    'Cache-Control':file.endsWith('sw.js')?'no-cache':'public, max-age=300',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});
  if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
}
const server=http.createServer((req,res)=>handle(req,res).catch(err=>{
  console.error(err.message);if(!res.headersSent)send(res,400,{error:err.message||'Request failed'});else res.end();
}));
server.listen(PORT,'0.0.0.0',()=>{
 console.log(`\n⚡ LiveStat Multi-Sport at http://localhost:${PORT}`);
 console.log(`✅ No access code required. Visitors have separate anonymous sessions.`);
 console.log(`🏈🏀 Free ESPN feeds | polling every ${POLL}s when tracking live games`);
 console.log(`📲 Web Push: ${pushReady()?'configured':'install web-push dependency'}\n`);
});
setInterval(()=>{if(state.watches.length)monitor.poll();},POLL*1000).unref?.();
setTimeout(()=>{if(state.watches.length)monitor.poll();},1600).unref?.();
