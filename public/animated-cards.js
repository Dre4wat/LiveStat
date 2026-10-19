// LiveStat Animated Card Studio: real ESPN values only, no fabricated game stats.
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const numeric=v=>v==null||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const round=(v,d=1)=>Number(v.toFixed(d)).toString();
const slug=s=>String(s||'player').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
const ESPN_PHOTO=/^https:\/\/(?:a|a1|a2)\.espncdn\.com\/i\/headshots\//i;
const defaultColors={redline:'#ed3d54',gold:'#f6c351',electric:'#55b7ff'};
const mappers={points:'PTS',rebounds:'REB',assists:'AST',threePointers:'3PM',passingYards:'YDS',passingTouchdowns:'TD',rushingYards:'YDS',rushingTouchdowns:'TD',receivingYards:'YDS',receptions:'REC',tackles:'TOT',sacks:'SACKS'};
function fitText(ctx,value,x,y,maxWidth,fontSize,fontWeight=900){
  ctx.font=fontWeight+' '+fontSize+'px Arial, sans-serif';
  const text=String(value||'').toUpperCase().slice(0,64);
  ctx.fillText(text,x,y,maxWidth);
}
function rounded(ctx,x,y,w,h,r,color){
  ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
}
export function createAnimatedCardsStudio({getData,refresh,notify=()=>{}}){
  const state={template:'performance',format:'vertical',mode:'auto',palette:'redline',duration:5,playing:false,exporting:false,
    metric:null,goal:null,error:'',image:null,imageUrl:'',imageStatus:'unavailable',imagePromise:null,supported:null};
  const formats={square:[1080,1080],portrait:[1080,1350],vertical:[1080,1920]};
  const scenes={performance:'PERFORMANCE RECAP',target:'TARGET REACHED',mission:'MISSION COMPLETE'};
  const choices=[['square','DISCORD · 1:1'],['portrait','SOCIAL · 4:5'],['vertical','TIKTOK · 9:16']];
  const data=()=>getData()||{};
  const history=()=>Array.isArray(data().games)?data().games:[];
  const seasonLabels=()=>Array.isArray(data().labels)?data().labels:[];
  const avg=k=>{
    const rows=history().filter(x=>Number.isFinite(numeric(x.stats?.[k])));
    return rows.length?rows.reduce((sum,x)=>sum+Number(x.stats[k]),0)/rows.length:null;
  };
  const metricRows=()=>{
    const d=data(),live=d.current?.available ? d.current.stats||{} : {};
    const available=seasonLabels();
    const raw=Object.keys(live).map(k=>({key:k,display:k.replace(/([A-Z])/g,' $1').toUpperCase(),
      value:numeric(live[k]),avg:avg(mappers[k]||k.toUpperCase())}));
    const last=history()[0]||{};
    const hrows=available.map(k=>({key:k,display:k,value:numeric(last.stats?.[k]),avg:avg(k)}));
    const mode=state.mode==='auto'?(d.current?.available?'live':'latest'):state.mode;
    if(mode==='live')return raw;
    if(mode==='average')return available.map(k=>({key:k,display:k,value:avg(k),avg:avg(k)}));
    if(mode==='best'){
      return available.map(k=>({key:k,display:k,value:Math.max(...history().map(g=>numeric(g.stats?.[k])).filter(x=>x!==null),-Infinity),avg:avg(k)}))
        .map(x=>({...x,value:x.value===-Infinity?null:x.value}));
    }
    return hrows;
  };
  const fieldRows=()=>metricRows().filter(x=>x.value!==null);
  const watchGoals=()=>{
    const d=data(),rules=d.watchRules||{};
    return Object.entries(rules).filter(([,rule])=>numeric(rule.target)!=null&&Number(rule.target)>0).map(([key,rule])=>{
      const metrics=metricRows();
      const match=metrics.find(m=>m.key===key||mappers[key]===m.key);
      return {label:key.replace(/([A-Z])/g,' $1').toUpperCase(),target:Number(rule.target),value:match?.value??null,key};
    }).slice(0,4);
  };
  const selectedMetrics=()=>{
    const rows=fieldRows();
    if(!rows.length)return [];
    const preferred=['PTS','REB','AST','YDS','TD','REC','TOT','SACKS','points','passingYards','receivingYards','rushingYards','tackles'];
    return [...rows].sort((a,b)=>{const rank=k=>{let x=preferred.indexOf(k);return x<0?99:x};return rank(a.key)-rank(b.key)}).slice(0,4);
  };
  const targetMetric=()=>metricRows().find(x=>x.key===state.metric)||fieldRows()[0]||null;
  const targetGoal=()=>{
    const goal=numeric(state.goal);if(goal!=null&&goal>0)return goal;
    const chosen=targetMetric();const w=watchGoals().find(g=>g.key===chosen?.key||mappers[g.key]===chosen?.key);
    return w?.target??null;
  };
  function controls(){
    const stats=metricRows();
    return '<div class="animated-creator">'+
      '<div class="animated-intro"><span>LIVE<span>STAT</span> / MOTION STUDIO</span><h3>ANIMATED STAT CARDS</h3><p>Build cinematic clips from recorded player statistics. Share them with Discord, TikTok, Reels, or friends.</p></div>'+
      '<div class="animated-control-layout"><div class="animated-controls">'+
      '<div class="animated-control"><strong>01 / TEMPLATE</strong><div class="animated-switches">'+Object.entries(scenes).map(([k,v])=>'<button data-action="motion-template" data-key="'+k+'" class="'+(k===state.template?'selected':'')+'">'+v+'</button>').join('')+'</div></div>'+
      '<div class="animated-control"><strong>02 / FORMAT</strong><div class="animated-switches">'+choices.map(([k,v])=>'<button data-action="motion-format" data-key="'+k+'" class="'+(k===state.format?'selected':'')+'">'+v+'</button>').join('')+'</div></div>'+
      '<div class="animated-control"><strong>03 / STAT SOURCE</strong><select id="motion-mode">'+
      [['auto','AUTO · LIVE IF AVAILABLE'],['latest','LAST RECORDED GAME'],['average','GAME-LOG AVERAGE'],['best','BEST IN RECORDED SAMPLE'],['live','SELECTED GAME BOX SCORE']].map(([v,label])=>'<option value="'+v+'" '+(state.mode===v?'selected':'')+' '+(v==='live'&&!data().current?.available?'disabled':'')+'>'+label+'</option>').join('')+
      '</select><small>Recorded data only. Missing statistics are never filled with sample numbers.</small></div>'+
      '<div class="animated-control"><strong>04 / TEAM COLOR</strong><div class="animated-switches">'+Object.keys(defaultColors).map(x=>'<button data-action="motion-palette" data-key="'+x+'" class="'+(state.palette===x?'selected':'')+'">'+x.toUpperCase()+'</button>').join('')+'</div></div>'+
      (state.template==='target'?'<div class="animated-control"><strong>05 / MILESTONE</strong><select id="motion-metric">'+stats.map(x=>'<option value="'+escapeHTML(x.key)+'" '+(x.key===(state.metric||targetMetric()?.key)?'selected':'')+'>'+escapeHTML(x.display)+'</option>').join('')+'</select><label for="motion-goal">TARGET VALUE</label><input id="motion-goal" type="number" min="0.1" step="any" value="'+escapeHTML(state.goal??targetGoal()??'')+'" placeholder="Select or enter target" /><small>Without a verified value and target, the card will say UNAVAILABLE.</small></div>':'')+
      (state.template==='mission'?'<div class="animated-control"><strong>05 / YOUR SAVED GOALS</strong>'+(watchGoals().length?watchGoals().map(g=>'<div class="animated-goal"><span>'+escapeHTML(g.label)+'</span><b>'+escapeHTML(g.value??'—')+' / '+g.target+'</b></div>').join(''):'<p class="animated-missing">Save a multi-stat alert loadout for this player in Arena to create a verified mission card.</p>')+'</div>':'')+
      '<div class="animated-export"><button data-action="motion-play" '+(state.playing||state.exporting?'disabled':'')+'>▶ PREVIEW</button>'+
      '<button data-action="motion-png" '+(state.exporting?'disabled':'')+'>↓ PNG</button>'+
      '<button data-action="motion-video" '+(state.exporting?'disabled':'')+'>↓ EXPORT VIDEO</button></div>'+
      '<p class="animated-note">A supported browser can export MP4 or WebM. iPhone support varies; PNG always remains available. Videos do not include copyrighted broadcast footage.</p>'+
      '</div><div class="animated-preview"><div class="animated-preview-header"><span>REAL-TIME RENDER PREVIEW</span><span>'+formats[state.format].join(' × ')+' · '+state.duration+' SECONDS</span></div>'+
      '<canvas id="animated-preview-canvas" width="'+formats[state.format][0]+'" height="'+formats[state.format][1]+'" aria-label="Animated stat card preview"></canvas>'+
      '<p class="animated-preview-caption">Source: ESPN unofficial · '+escapeHTML(data().player?.name||'Player profile unavailable')+' · '+escapeHTML(data().season||'')+'</p>'+
       '<p id="animated-photo-status" class="animated-preview-caption">PHOTO: '+escapeHTML(state.imageStatus==='ready'?'ESPN headshot loaded':state.imageStatus==='loading'?'Loading ESPN headshot…':state.imageStatus==='failed'?'Headshot unavailable at ESPN':'Not provided by ESPN')+'</p></div></div></div>';
  }
  function draw(t=1){
    const canvas=document.getElementById('animated-preview-canvas');if(!canvas)return;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const w=canvas.width,h=canvas.height,accent=state.palette==='redline'&&/^([0-9a-f]{6}|#[0-9a-f]{6})$/i.test(data().player?.teamColor||'')
      ? '#'+String(data().player.teamColor).replace('#',''):defaultColors[state.palette];
    const p=clamp(t,0,1),ease=v=>1-Math.pow(1-clamp(v,0,1),3);
    ctx.fillStyle='#080a0e';ctx.fillRect(0,0,w,h);
    const grad=ctx.createRadialGradient(w*.73,h*.12,40,w*.45,h*.33,w*.9);
    grad.addColorStop(0,accent+'88');grad.addColorStop(1,'#080a0e');
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    ctx.fillStyle=accent;ctx.fillRect(0,0,w,15);ctx.fillRect(0,h-12,w,12);
    ctx.globalAlpha=.17;
    for(let i=0;i<12;i++){ctx.save();ctx.translate((i*160+t*420)%(w+250)-170,h*.53);ctx.rotate(-.38);ctx.fillStyle='#fff';ctx.fillRect(0,-h,14,h*2);ctx.restore();}
    ctx.globalAlpha=1;
    const left=80,top=125,player=data().player||{},name=player.name||('PLAYER PROFILE UNAVAILABLE'+(player.id?' · ESPN #'+player.id:''));
    ctx.fillStyle='#fff';fitText(ctx,'LIVE',left,top,240,65);
    ctx.fillStyle=accent;fitText(ctx,'STAT',245,top,250,65);
    ctx.fillStyle='#c7c5cb';fitText(ctx,'ANALYTICS LAB  /  MOTION STUDIO',left,top+52,w-left*2,24,700);
    ctx.textAlign='right';ctx.fillStyle='#fff';fitText(ctx,(data().sport||'SPORT').toUpperCase(),w-left,top,w*.4,24);ctx.textAlign='left';
    const photoScale=ease((p-.03)/.35);
    const headshot=state.image;
    if(headshot){
      const ph=Math.min(h*.49,950),pw=ph*headshot.width/headshot.height,x=w-pw+Math.round((1-photoScale)*130),y=h*.13;
      ctx.globalAlpha=photoScale*.95;ctx.drawImage(headshot,x,y,pw,ph);ctx.globalAlpha=1;
    } else {
      const letters=name.trim().split(/\s+/).map(x=>x[0]||'').slice(0,2).join('').toUpperCase();
      ctx.globalAlpha=.20*photoScale;ctx.fillStyle='#fff';fitText(ctx,letters,w*.54,h*.39,w*.42,260);ctx.globalAlpha=1;
      ctx.fillStyle='rgba(255,255,255,.65)';ctx.globalAlpha=photoScale;
      fitText(ctx,state.imageStatus==='loading'?'LOADING HEADSHOT':'ESPN HEADSHOT UNAVAILABLE',w*.55,h*.43,w*.4,21,700);
      ctx.globalAlpha=1;
    }
    const nameReveal=ease((p-.10)/.25);
    ctx.globalAlpha=nameReveal;
    ctx.fillStyle='#fff';fitText(ctx,name.toUpperCase(),left,h*.60,w-left*2,72);
    ctx.fillStyle=accent;fitText(ctx,scenes[state.template],left,h*.65,w-left*2,46);
    ctx.fillStyle='#d4c4c9';fitText(ctx,player.team||'TEAM UNKNOWN',left,h*.684,w-left*2,25,700);
    ctx.globalAlpha=1;
    const rows=selectedMetrics(), y0=h*.72,boxW=(w-190)/4;
    if(state.template==='performance'){
      if(rows.length){
        rows.forEach((row,i)=>{
          const show=ease((p-.3-i*.105)/.22),x=left+i*(boxW+10);
          ctx.globalAlpha=show;
          rounded(ctx,x,y0,boxW,h*.17,14,'#1b171e');
          ctx.fillStyle=accent;ctx.fillRect(x,y0,boxW,6);
          ctx.fillStyle='#fff';fitText(ctx,row.display,x+17,y0+48,boxW-34,21,700);
          ctx.fillStyle='#fff';fitText(ctx,row.value===null?'—':round(row.value*show,row.value%1?1:0),x+15,y0+h*.102,boxW-30,56);
          ctx.fillStyle='#bcb4bd';fitText(ctx,row.avg===null?'NO AVERAGE':'AVG '+round(row.avg),x+15,y0+h*.145,boxW-30,20,700);
        });ctx.globalAlpha=1;
      } else {ctx.fillStyle='#fff';fitText(ctx,'NO RECORDED GAME STATISTICS',left,y0+80,w-2*left,36);}
    } else if(state.template==='target'){
      const metric=targetMetric(),goal=targetGoal(),value=metric?.value;
      rounded(ctx,left,y0,w-2*left,h*.16,16,'#241923');
      ctx.fillStyle='#fff';fitText(ctx,metric?.display||'SELECT STAT',left+22,y0+55,w*.52,28,700);
      ctx.fillStyle='#fff';fitText(ctx,value===null||value===undefined?'—':round(value),left+22,y0+h*.105,w*.55,72);
      ctx.fillStyle='#bbb8c5';fitText(ctx,goal===null?'TARGET UNSET':'GOAL '+goal,w*.58,y0+h*.105,w*.3,34,700);
      const r=goal&&value!=null?clamp(value/goal,0,1):0;
      rounded(ctx,left+20,y0+h*.126,w-2*left-40,20,10,'#4a3745');
      if(r>0)rounded(ctx,left+20,y0+h*.126,(w-2*left-40)*r*ease((p-.4)/.3),20,10,accent);
      if(goal&&value!=null&&value>=goal&&p>.80){ctx.fillStyle=accent;fitText(ctx,'✓ TARGET ACHIEVED',left,h*.92,w-2*left,32);}
      if(!goal||value==null){ctx.fillStyle='#bcb5bd';fitText(ctx,'NO VERIFIED TARGET RESULT',left,h*.92,w-2*left,28,700);}
    } else {
      const goals=watchGoals(),step=h*.065;
      if(!goals.length){ctx.fillStyle='#fff';fitText(ctx,'SAVE A MULTI-STAT WATCHLIST TO ACTIVATE',left,y0+55,w-left*2,27,700);}
      goals.forEach((goal,i)=>{
        const show=ease((p-.33-i*.13)/.18),x=left,y=y0+i*step,done=goal.value!==null&&goal.value>=goal.target;
        ctx.globalAlpha=show;rounded(ctx,x,y,w-2*left,step-15,12,'#241b22');
        ctx.fillStyle=done?accent:'#aea4b3';fitText(ctx,done?'✓':'○',x+17,y+36,40,35);
        ctx.fillStyle='#fff';fitText(ctx,goal.label,x+76,y+34,w*.52,27,700);
        ctx.textAlign='right';fitText(ctx,(goal.value===null?'—':round(goal.value))+' / '+goal.target,w-left-20,y+34,w*.28,28);ctx.textAlign='left';
      });ctx.globalAlpha=1;
      if(goals.length&&goals.every(g=>g.value!==null&&g.value>=g.target)&&p>.84){ctx.fillStyle=accent;fitText(ctx,'MISSION COMPLETE',left,h*.975,w-left*2,34);}
    }
    ctx.fillStyle='#b7aeb7';fitText(ctx,'ESPN UNOFFICIAL · VERIFIED STATS ONLY',left,h-45,w-left*2,20,700);
  }
  function updatePhotoCaption(){
    const el=typeof document!=='undefined'?document.getElementById('animated-photo-status'):null;
    if(el)el.textContent=state.imageStatus==='ready'?'PHOTO: ESPN headshot loaded':
      state.imageStatus==='loading'?'PHOTO: Loading from ESPN…':
      state.imageStatus==='failed'?'PHOTO: ESPN image unavailable; initials fallback used':
      'PHOTO: ESPN headshot not provided';
  }
  function loadHeadshot(){
    const src=String(data().player?.headshot||'');
    if(src===state.imageUrl)return;
    state.imageUrl=src;state.image=null;state.imagePromise=null;
    state.imageStatus=ESPN_PHOTO.test(src)?'loading':'unavailable';
    updatePhotoCaption();
    if(!ESPN_PHOTO.test(src))return;
    const img=new Image();
    state.imagePromise=new Promise(resolve=>{
      img.onload=()=>{
        if(state.imageUrl===src){state.image=img;state.imageStatus='ready';updatePhotoCaption();
          if(!state.playing&&!state.exporting)draw(1);}
        resolve();
      };
      img.onerror=()=>{
        if(state.imageUrl===src){state.imageStatus='failed';updatePhotoCaption();
          if(!state.playing&&!state.exporting)draw(1);}
        resolve();
      };
      img.src='/api/analytics/headshot?url='+encodeURIComponent(src);
    });
  }
  async function awaitHeadshot(){
    loadHeadshot();
    if(state.imagePromise)await Promise.race([state.imagePromise,new Promise(resolve=>setTimeout(resolve,5000))]);
    return state.imageStatus==='ready';
  }
  function afterRender(){loadHeadshot();draw(1)}
  function redraw(){loadHeadshot();draw(1)}
  async function play(){
    if(state.playing||state.exporting)return;
    state.playing=true;const start=performance.now();
    return new Promise(resolve=>{
      const frame=now=>{
        if(!document.getElementById('animated-preview-canvas')){state.playing=false;resolve();return;}
        const t=clamp((now-start)/(state.duration*1000),0,1);draw(t);
        if(t<1)requestAnimationFrame(frame);else{state.playing=false;resolve();}
      };requestAnimationFrame(frame);
    });
  }
  function download(blob,ext){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='LiveStat-'+slug(data().player?.name)+'-'+state.template+'.'+ext;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  async function png(){
    if(!data().player?.name){notify('Player name unavailable. Select a player in Analytics Lab before exporting.');return;}
    if(!fieldRows().length){notify('No recorded stats for this player yet');return;}
    await awaitHeadshot();
    draw(1);const canvas=document.getElementById('animated-preview-canvas');if(!canvas)return;
    await new Promise(resolve=>canvas.toBlob(blob=>{if(blob)download(blob,'png');else notify('PNG export failed');resolve()},'image/png'));
  }
  async function video(){
    if(!data().player?.name){notify('Player name unavailable. Select a player in Analytics Lab before exporting.');return;}
    if(!fieldRows().length){notify('No recorded stats for this player yet');return;}
    await awaitHeadshot();
    const canvas=document.getElementById('animated-preview-canvas');
    if(!canvas?.captureStream||typeof MediaRecorder==='undefined'){notify('This browser cannot record canvas video. Use PNG export or try a desktop browser.');return;}
    const formats=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
    const mime=formats.find(m=>MediaRecorder.isTypeSupported(m));
    if(!mime){notify('Video recording is unavailable in this browser. PNG still works.');return;}
    state.exporting=true;
    const btn=document.querySelector('[data-action="motion-video"]');if(btn){btn.disabled=true;btn.textContent='RECORDING…';}
    let recorder,stream;
    try {
      stream=canvas.captureStream(30);
      const chunks=[];recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6500000});
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
      const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=()=>reject(Error('Recording interrupted'))});
      recorder.start(250);
      const started=performance.now();
      await new Promise(resolve=>{const frame=now=>{
        if(recorder.state==='inactive'){resolve();return}
        const t=clamp((now-started)/(state.duration*1000),0,1);draw(t);
        if(t<1)requestAnimationFrame(frame);else resolve();
      };requestAnimationFrame(frame)});
      await new Promise(resolve=>setTimeout(resolve,120));
      if(recorder.state!=='inactive')recorder.stop();
      await stopped;
      const blob=new Blob(chunks,{type:mime});
      if(blob.size<512)throw Error('No video frames were recorded');
      download(blob,mime.startsWith('video/mp4')?'mp4':'webm');
      notify('Animated card exported');
    } catch(e){notify('Video export failed: '+(e.message||'unsupported browser'))}
    finally {stream?.getTracks().forEach(t=>t.stop());state.exporting=false;if(btn){btn.disabled=false;btn.textContent='↓ EXPORT VIDEO';}draw(1);}
  }
  function handle(action,node){
    const k=node?.dataset?.key;
    if(action==='motion-template'&&scenes[k]){state.template=k;refresh();return true}
    if(action==='motion-format'&&formats[k]){state.format=k;refresh();return true}
    if(action==='motion-palette'&&defaultColors[k]){state.palette=k;refresh();return true}
    if(action==='motion-play'){play();return true}
    if(action==='motion-png'){png();return true}
    if(action==='motion-video'){video();return true}
    return false;
  }
  function input(node){
    if(node.id==='motion-mode'){state.mode=node.value;state.metric=null;state.goal=null;refresh();return true}
    if(node.id==='motion-metric'){state.metric=node.value;state.goal=null;refresh();return true}
    if(node.id==='motion-goal'){state.goal=node.value;redraw();return true}
    return false;
  }
  return {state,render:controls,afterRender,handle,input,selectedMetrics};
}
