import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnimatedCardsStudio} from '../public/animated-cards.js';

test('Animated Cards paints the actual ESPN player name, team and headshot, not CHOOSE A PLAYER',async()=>{
  const oldDoc=globalThis.document,oldImage=globalThis.Image;
  const painted=[],images=[];
  const context={
    save(){},restore(){},translate(){},rotate(){},fillRect(){},beginPath(){},
    roundRect(){},fill(){},fillText(value){painted.push(String(value))},
    drawImage(){painted.push('ESPN PHOTO DRAWN')},
    createRadialGradient(){return {addColorStop(){}}}
  };
  const canvas={width:1080,height:1920,getContext(){return context}};
  const status={textContent:''};
  globalThis.document={getElementById:id=>id==='animated-preview-canvas'?canvas:id==='animated-photo-status'?status:null};
  globalThis.Image=class {
    constructor(){this.width=600;this.height=600}
    set src(x){images.push(x);queueMicrotask(()=>this.onload?.())}
  };
  try{
    const lab=createAnimatedCardsStudio({
      getData:()=>({
        sport:'nfl',season:2026,
        player:{id:'3139477',name:'Patrick Mahomes',team:'Kansas City Chiefs',
          headshot:'https://a.espncdn.com/i/headshots/nfl/players/full/3139477.png',teamColor:'E31837'},
        games:[{stats:{YDS:297,TD:4,CMP:25,ATT:34}}],
        labels:['YDS','TD','CMP','ATT']
      }),
      refresh:()=>{}
    });
    lab.afterRender();
    await new Promise(resolve=>setImmediate(resolve));
    assert.ok(images.some(x=>x.startsWith('/api/analytics/headshot?url=')));
    assert.ok(painted.some(x=>x.includes('PATRICK MAHOMES')),'player name must be painted');
    assert.ok(painted.some(x=>x.includes('KANSAS CITY CHIEFS')),'team name must be painted');
    assert.ok(painted.includes('ESPN PHOTO DRAWN'),'actual headshot must be drawn to canvas');
    assert.ok(!painted.some(x=>x.includes('CHOOSE A PLAYER')),'do not render placeholder');
    assert.equal(lab.state.imageStatus,'ready');
    assert.match(status.textContent,/headshot loaded/);
  }finally{if(oldDoc===undefined)delete globalThis.document;else globalThis.document=oldDoc;
    if(oldImage===undefined)delete globalThis.Image;else globalThis.Image=oldImage}
});
test('Missing ESPN headshot visibly reports unavailable rather than silently claiming a photo',async()=>{
 const oldDoc=globalThis.document,oldImage=globalThis.Image;
 const text={textContent:''};
 globalThis.document={getElementById:id=>id==='animated-photo-status'?text:null};
 globalThis.Image=class {set src(_){queueMicrotask(()=>this.onerror?.())}};
 try{
   const studio=createAnimatedCardsStudio({
     getData:()=>({player:{id:'999999',name:'Example',headshot:'https://a.espncdn.com/i/headshots/nfl/players/full/999999.png'},
       games:[{stats:{YDS:100}}],labels:['YDS']}),
     refresh:()=>{}
   });
   studio.afterRender();
   await new Promise(resolve=>setImmediate(resolve));
   assert.equal(studio.state.imageStatus,'failed');
   assert.match(text.textContent,/unavailable/i);
 }finally{
   if(oldDoc===undefined)delete globalThis.document;else globalThis.document=oldDoc;
   if(oldImage===undefined)delete globalThis.Image;else globalThis.Image=oldImage;
 }
});
