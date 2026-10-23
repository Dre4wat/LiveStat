const CACHE='livestat-shell-v14';
const STATIC=['/','/index.html','/styles.css','/cinematic.css','/app.js',
 '/boxscore.css','/boxscore.js','/intelligence.css','/intelligence-ui.js',
 '/football-stats.js','/roster-select.js','/analytics-lab.css','/analytics-lab.js',
 '/analytics-card.js','/animated-cards.js','/roster-browser.js','/roster-browser.css','/formula.js','/icon-192.png','/manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.origin!==location.origin||url.pathname.startsWith('/api/')||e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request)));
});
self.addEventListener('push',e=>{
  let data={title:'LiveStat event',body:'A tracked statistic changed',url:'/'};
  try{data={...data,...e.data.json()}}catch{}
  e.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'/icon-192.png',badge:'/icon-192.png',tag:data.id||undefined,renotify:false,data:{url:data.url},requireInteraction:Boolean(data.milestone)}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();const target=new URL(e.notification.data?.url||'/',self.location.origin).href;
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    const existing=list.find(c=>new URL(c.url).origin===self.location.origin);
    if(existing)return existing.focus().then(()=>existing.navigate(target));
    return clients.openWindow(target);
  }));
});
