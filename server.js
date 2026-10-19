import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {espnProviders,SPORTS} from './src/providers/espn.js';
import {extractBoxTotals} from './src/providers/intelligence.js';
import {analyzePlayer} from './src/providers/analytics.js';
import {makeMonitor} from './src/engine/monitor.js';
import {normalizeWatch,matchPlay} from './src/engine/events.js';
import {loadStore,writeStore} from './src/engine/store.js';
import {sendPush,pushReady,publicVapidKey} from './src/engine/push.js';
import {validateWebhook,sendDiscordAlert} from './src/engine/discord.js';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
process.chdir(ROOT);
const PORT=Number(process.env.PORT||3000),POLL=Math.max(10,Number(process.env.POLL_SECONDS)||12);
const state=loadStore();
state.discord ||= {};
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
const insightCache=new Map();
const analystCooldown=new Map();
function validateAthleteSeason(url){
  const athlete=url.searchParams.get('athlete')||'';
  const season=Number(url.searchParams.get('season')||'0');
  if(!/^[0-9]{1,14}$/.test(athlete))throw Error('Invalid athlete');
  if(!Number.isInteger(season)||season<1980||season>new Date().getUTCFullYear()+2)throw Error('Invalid season');
  return {athlete,season};
}
async function headshotImage(res,raw){
  let u;try{u=new URL(raw)}catch{throw Error('Invalid image URL')}
  if(u.protocol!=='https:'||!['a.espncdn.com','a1.espncdn.com','a2.espncdn.com','a.espn.com'].includes(u.hostname)||
     !/^\/i\/(headshots|teamlogos)\//.test(u.pathname)||
     u.username||u.password||u.port)throw Error('Only ESPN headshot images are supported');
  const remote=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(9000)});
  if(!remote.ok)throw Error('Headshot unavailable');
  const type=(remote.headers.get('content-type')||'').split(';')[0];
  if(!['image/jpeg','image/png','image/webp'].includes(type))throw Error('Unsupported image');
  if(Number(remote.headers.get('content-length')||0)>2500000)throw Error('Image too large');
  const buffer=Buffer.from(await remote.arrayBuffer());
  if(buffer.length>2500000)throw Error('Image too large');
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'same-origin'});
  res.end(buffer);
}

async function cached(key,ttl,fn){
 const previous=insightCache.get(key),now=Date.now();
 if(previous&&now-previous.at<ttl)return previous.data;
 const data=await fn();insightCache.set(key,{at:now,data});
 if(insightCache.size>140)insightCache.delete(insightCache.keys().next().value);
 return data;
}
function providerFrom(url){
 const sport=url.searchParams.get('sport')||'nba';
 if(!espnProviders[sport])throw new Error('Unknown league');
 return {sport,provider:espnProviders[sport]};
}
function safeGame(url){
 const game=url.searchParams.get('game')||'';
 if(!/^[0-9]{6,14}$/.test(game))throw new Error('Invalid game');
 return game;
}


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
  // Independent optional Discord relay; never expose a visitor's webhook.
  const relay=state.discord?.[a.ownerId];
  if(relay?.enabled)await sendDiscordAlert({...relay,ownerId:a.ownerId},a);
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
    if(route==='/api/discord'&&req.method==='GET'){
      const d=state.discord[ownerId]||{};
      return send(res,200,{configured:Boolean(d.url),enabled:Boolean(d.enabled),types:d.types||['target']});
    }
    if(route==='/api/discord'&&req.method==='POST'){
      const d=await body(req),old=state.discord[ownerId]||{};
      const enabled=d.enabled===true,url=String(d.url||'').trim()||old.url||'';
      if(enabled&&!validateWebhook(url))throw new Error('Enter a valid Discord channel webhook URL');
      if(d.url&&!validateWebhook(d.url))throw new Error('Invalid Discord webhook URL');
      const types=Array.isArray(d.types)?d.types.filter(x=>['every','target','near','correction'].includes(x)).slice(0,4):old.types||['target'];
      state.discord[ownerId]={enabled,url:enabled||old.url?url:'',types:types.length?types:['target']};
      writeStore(state);
      return send(res,200,{enabled,configured:Boolean(url),types:state.discord[ownerId].types});
    }
    if(route==='/api/discord/test'&&req.method==='POST'){
      const d=state.discord[ownerId];
      if(!d?.enabled||!validateWebhook(d.url))throw new Error('Enable your Discord integration first');
      const result=await sendDiscordAlert({...d,types:['target']},{ownerId,category:'target',name:'LiveStat',detail:'Test message from LiveStat',game:'Test connection',demo:false});
      if(!result.sent)throw new Error('Discord rejected the test or relay is rate limited');
      return send(res,200,{sent:true});
    }
    if(req.method==='GET'&&route==='/api/teams'){
      const sport=url.searchParams.get('sport')||'nfl',provider=espnProviders[sport];if(!provider)throw new Error('Invalid league');
      let entry=teamCache.get(sport);
      if(!entry||Date.now()-entry.at>86400000){entry={at:Date.now(),data:await provider.teams()};teamCache.set(sport,entry);}
      return send(res,200,{teams:entry.data});
    }
    if(req.method==='GET'&&route==='/api/roster'){
      const sport=url.searchParams.get('sport')||'nfl',teamId=url.searchParams.get('team')||'';
      const gameId=url.searchParams.get('game')||'';
      if(!espnProviders[sport]||!/^\d{1,8}$/.test(teamId))throw new Error('Invalid league or team');
      if(gameId&&!/^[0-9]{6,14}$/.test(gameId))throw new Error('Invalid game');
      const k=`${sport}:${teamId}:${gameId}`,now=Date.now();
      let entry=rosterCache.get(k);
      const ttl=gameId?120000:1800000;
      if(!entry||now-entry.at>ttl){
        entry={at:now,data:await espnProviders[sport].roster(teamId,{gameId})};
        rosterCache.set(k,entry);
        if(rosterCache.size>250)rosterCache.delete(rosterCache.keys().next().value);
      }
      return send(res,200,{players:entry.data,order:'ESPN depth chart, team leaders, game statistics; alphabetical fallback'});
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
    if(req.method==='GET'&&route==='/api/intelligence'){
      const {sport,provider}=providerFrom(url),game=safeGame(url);
      const data=await cached('intel:'+sport+':'+game,18000,()=>provider.intelligence(game));
      // Best-effort tracked-player quarter splits from available play descriptions.
      // These are derived counters, not official period box scores.
      const watches=state.watches.filter(w=>w.ownerId===ownerId&&w.sport===sport&&String(w.gameId)===game).slice(0,40);
      const watchPeriods=watches.map(w=>{
        const periods={};
        for(const play of data.plays||[]){
          const period=String(play.period||'?');periods[period]||={};
          for(const event of matchPlay(play,w)){
            periods[period][event.stat]=(periods[period][event.stat]||0)+event.delta;
          }
        }
        return {watchId:w.id,name:w.name,periods};
      });
      return send(res,200,{insights:{...data,watchPeriods}});

    }
    if(req.method==='GET'&&route==='/api/profile'){
      const {sport,provider}=providerFrom(url),athlete=url.searchParams.get('athlete')||'';
      if(!/^[0-9]{1,14}$/.test(athlete))throw new Error('Invalid athlete');
      const data=await cached('profile:'+sport+':'+athlete,300000,()=>provider.playerProfile(athlete));
      return send(res,200,{profile:data});
    }
    if(req.method==='GET'&&route==='/api/league'){
      const {sport,provider}=providerFrom(url),section=url.searchParams.get('section');
      if(!['standings','injuries'].includes(section))throw new Error('Invalid league section');
      const data=await cached('league:'+section+':'+sport,180000,()=>provider[section]());
      return send(res,200,{league:data});
    }
    if(req.method==='GET'&&route==='/api/tracker'){
      const watches=state.watches.filter(w=>w.ownerId===ownerId).slice(0,40);
      const limit=10,selected=[...new Set(watches.filter(w=>w.gameId).map(w=>w.sport+':'+w.gameId))].slice(0,limit);
      const boxes=new Map();
      await Promise.all(selected.map(async key=>{
        const [sport,game]=key.split(':');
        try{boxes.set(key,await cached('box:'+key,18000,()=>espnProviders[sport].boxScore(game)));}
        catch(err){boxes.set(key,{error:err.message});}
      }));
      const tracker=watches.map(w=>{
        const box=boxes.get(w.sport+':'+w.gameId);
        const current=box&&!box.error?extractBoxTotals(box,w):{};
        const entries=Object.entries(w.rules||{}).map(([stat,rule])=>{
          const val=Object.hasOwn(current,stat)?current[stat]:null;
          return {stat,current:val,target:rule.target??null,
            complete:val!=null&&rule.target!=null&&val>=rule.target,
            dataAvailable:val!=null};
        });
        const goals=entries.filter(x=>x.target!=null),done=goals.filter(x=>x.complete).length;
        return {id:w.id,sport:w.sport,name:w.name,kind:w.kind,gameId:w.gameId,teamId:w.teamId,
          rules:w.rules,stats:entries,goals:{done,total:goals.length,complete:goals.length>0&&done===goals.length},
          source:box?.error?'Unavailable':box?'ESPN box score':'No game box score',error:box?.error||null,
          game:box?{teams:box.teams,status:box.status,state:box.state}:null};
      });
      return send(res,200,{tracker,updatedAt:new Date().toISOString()});
    }
    if(req.method==='GET'&&route==='/api/analytics/player'){
      const {sport,provider}=providerFrom(url),{athlete,season}=validateAthleteSeason(url);
      const data=await cached('analytics:'+sport+':'+athlete+':'+season,900000,()=>provider.analyticsPlayer(athlete,season));
      return send(res,200,{analytics:data});
    }
    if(req.method==='GET'&&route==='/api/analytics/search'){
      const {sport,provider}=providerFrom(url),q=(url.searchParams.get('q')||'').trim();
      if(q.length<2||q.length>70)throw Error('Search term must be 2–70 characters');
      const list=await cached('athletes:'+sport+':'+q.toLowerCase(),180000,()=>provider.searchAthletes(q));
      return send(res,200,{players:list});
    }
    if(req.method==='GET'&&route==='/api/analytics/headshot'){
      return headshotImage(res,url.searchParams.get('url')||'');
    }
    if(req.method==='POST'&&route==='/api/analytics/analyst'){
      const reqData=await body(req),sport=String(reqData.sport||'nba'),
        athlete=String(reqData.athlete||''),season=Number(reqData.season),
        metric=String(reqData.metric||'PTS').replace(/[^A-Za-z0-9%]/g,'').slice(0,18).toUpperCase();
      if(!espnProviders[sport]||!/^[0-9]{1,14}$/.test(athlete)||
         !Number.isInteger(season)||season<1980||season>new Date().getUTCFullYear()+2||!metric)throw Error('Invalid analyst request');
      const data=await cached('analytics:'+sport+':'+athlete+':'+season,900000,
        ()=>espnProviders[sport].analyticsPlayer(athlete,season));
      const evidence=analyzePlayer(data.player,data.history.games,metric);
      if(reqData.ai!==true)return send(res,200,{analysis:evidence,mode:'statistical'});
      if(!process.env.OPENAI_API_KEY)return send(res,200,{analysis:evidence,mode:'statistical',warning:'AI service not configured; showing sourced statistical analysis.'});
      const now=Date.now(),last=analystCooldown.get(ownerId)||0;
      if(now-last<300000)throw Error('AI analysis can be requested once every five minutes.');
      if(!evidence.sentences.length)return send(res,200,{analysis:evidence,mode:'statistical'});
      analystCooldown.set(ownerId,now);
      if(analystCooldown.size>1500)analystCooldown.clear();
      const model=process.env.LIVESTAT_AI_MODEL||'gpt-4.1-mini';
      try{
        const ai=await fetch('https://api.openai.com/v1/responses',{
          method:'POST',signal:AbortSignal.timeout(20000),
          headers:{authorization:'Bearer '+process.env.OPENAI_API_KEY,'content-type':'application/json'},
          body:JSON.stringify({
            model,max_output_tokens:350,
            instructions:'You are LiveStat Analyst. Explain only the supplied statistics. No invented plays, opponents, season averages, injuries, projections or quotes. Cite sample game counts and highlight uncertain coverage. Reply in 3–5 concise sentences, no markdown.',
            input:JSON.stringify({sport,player:data.player.name,season,stat:metric,observations:evidence.sentences})
          })
        });
        if(!ai.ok)throw Error('AI provider is temporarily unavailable');
        const response=await ai.json();
        const parts=(response.output||[]).flatMap(x=>(x.content||[]).filter(y=>y.type==='output_text').map(y=>y.text));
        const textValue=parts.join('\n').trim().slice(0,1800);
        if(!textValue)throw Error('No AI analysis returned');
        return send(res,200,{mode:'ai',analysis:{...evidence,summary:textValue},model});
      }catch{
        return send(res,200,{mode:'statistical',analysis:evidence,warning:'AI service unavailable; showing evidence-based statistical analysis.'});
      }
    }
    if(req.method==='POST'&&route==='/api/watches'){
      const watch=normalizeWatch(await body(req));
      if(state.watches.filter(w=>w.ownerId===ownerId).length>=40)throw new Error('Up to 40 alert rules per browser');
      if(state.watches.length>=500)throw new Error('Public demo is at capacity');
      const duplicate=state.watches.find(w=>w.ownerId===ownerId&&(w.sport||'nfl')===watch.sport&&w.kind===watch.kind&&w.teamId===watch.teamId&&w.playerId===watch.playerId&&String(w.gameId||'')===watch.gameId);
      if(duplicate){duplicate.rules=watch.rules;duplicate.stats=watch.stats;duplicate.smart=watch.smart;duplicate.name=watch.name;duplicate.position=watch.position;writeStore(state);return send(res,200,{watch:duplicate,updated:true});}
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
