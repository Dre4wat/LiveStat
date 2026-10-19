import test from 'node:test';
import assert from 'node:assert/strict';

// Browser startup regression: unlike syntax-only tests, this executes app.js boot.
// It reproduces the blank-screen bug caused by invoking .forEach on querySelector.
test('LiveStat boots with main content and can navigate to Analytics on mobile',async()=>{
  const descriptors={};
  function define(name,value){
    descriptors[name]=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  }
  const node=()=>({
    innerHTML:'',textContent:'',value:'',listeners:{},dataset:{},
    classList:{add(){},remove(){},toggle(){}},
    addEventListener(name,handler){this.listeners[name]=handler},
    querySelector(){return null},querySelectorAll(){return []}
  });
  const app=node(),toast=node(),watchCount=node(),side=node(),mobile=node();
  const page={
    querySelector(query){
      if(query==='#app')return app;
      if(query==='#toast')return toast;
      if(query==='#side-watch-count')return watchCount;
      return null;
    },
    querySelectorAll(query){
      if(query==='.mobile-nav,.side')return [mobile,side];
      if(query==='[data-tab]')return [];
      return [];
    },
    hidden:false
  };
  const requests=[];
  try{
    define('document',page);
    define('location',{search:'',href:'https://example.test/'});
    define('window',{scrollTo(){}});
    define('navigator',{});
    define('localStorage',{getItem(){return null},setItem(){}});
    define('setInterval',()=>-1);
    define('fetch',async url=>{
      requests.push(String(url));
      const body=String(url)==='/api/status'?{watches:[],alerts:[]}
        :String(url)==='/api/discord'?{configured:false,enabled:false,types:['target']}
        :{pushConfigured:false};
      return {ok:true,json:async()=>body};
    });
    await import('../public/app.js?startup-smoke');
    await new Promise(resolve=>setTimeout(resolve,25));
    assert.ok(app.innerHTML.includes('SELECT YOUR ARENA'), 'Home view should render rather than stay blank');
    assert.ok(app.innerHTML.includes('sport-card'), 'Sports should be selectable');
    assert.equal(typeof app.listeners.click,'function');
    const navBtn={dataset:{action:'nav',tab:'analytics'}};
    await app.listeners.click({target:{closest:()=>navBtn}});
    assert.match(app.innerHTML,/ANALYTICS\s*<em>LAB<\/em>/i);
    const rosterBtn={dataset:{action:'nav',tab:'rosters'}};
    await app.listeners.click({target:{closest:()=>rosterBtn}});
    await new Promise(resolve=>setTimeout(resolve,25));
    assert.match(app.innerHTML,/THE <em>ROSTER<\/em>/i);
    assert.match(app.innerHTML,/gp-roster-sport/);
    const homeBtn={dataset:{action:'nav',tab:'arena'}};
    await app.listeners.click({target:{closest:()=>homeBtn}});
    assert.match(app.innerHTML,/SELECT YOUR ARENA/i);
    assert.ok(requests.includes('/api/config'));
  }finally{
    for(const [k,descriptor] of Object.entries(descriptors)){
      if(descriptor)Object.defineProperty(globalThis,k,descriptor);
      else delete globalThis[k];
    }
  }
});
