import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnimatedCardsStudio} from '../public/animated-cards.js';
import {createAnalyticsLab} from '../public/analytics-lab.js';
import {calculateFormula} from '../public/formula.js';

function maker(input){
  return createAnimatedCardsStudio({getData:()=>input,refresh:()=>{},notify:()=>{}});
}
test('animation studio offers performance, milestone and mission templates in social aspect ratios',()=>{
  const studio=maker({
    sport:'nba',season:2026,player:{id:'1966',name:'LeBron James'},
    labels:['PTS','REB'],games:[{date:'2026-10-20',stats:{PTS:32,REB:9}}]
  });
  const html=studio.render();
  assert.match(html,/PERFORMANCE RECAP/);
  assert.match(html,/TARGET REACHED/);
  assert.match(html,/MISSION COMPLETE/);
  assert.match(html,/1080/);
  assert.match(html,/motion-video/);
  assert.match(html,/motion-png/);
});
test('stat graphics use recorded game-log values and averages, not sample placeholder stats',()=>{
  const studio=maker({
    sport:'nba',season:2026,player:{id:'1966',name:'Example'},
    labels:['PTS','REB','AST'],games:[{stats:{PTS:32,REB:9,AST:7}},{stats:{PTS:20,REB:6,AST:4}}]
  });
  assert.deepEqual(studio.selectedMetrics().map(x=>x.value),[32,9,7]);
  assert.equal(studio.selectedMetrics()[0].avg,26);
  const empty=maker({sport:'nba',player:{name:'Unknown'},games:[],labels:[]});
  assert.deepEqual(empty.selectedMetrics(),[]);
  assert.match(empty.render(),/Missing statistics are never filled with sample numbers/);
});
test('selected game box score takes priority in automatic mode',()=>{
  const studio=maker({
    sport:'nfl',player:{name:'QB Sample'},games:[{stats:{YDS:190}}],
    labels:['YDS'],current:{available:true,stats:{passingYards:300,passingTouchdowns:3}}
  });
  assert.ok(studio.selectedMetrics().some(x=>x.key==='passingYards'&&x.value===300));
});
test('mission template references saved target rules, not invented results',()=>{
  const studio=maker({
    sport:'nba',player:{name:'Player'},games:[{stats:{PTS:25,REB:8}}],labels:['PTS','REB'],
    watchRules:{points:{target:25},rebounds:{target:8}}
  });
  studio.handle('motion-template',{dataset:{key:'mission'}});
  assert.match(studio.render(),/25/);
  assert.match(studio.render(),/8/);
  const unconfigured=maker({sport:'nba',player:{name:'Player'},games:[{stats:{PTS:25}}],labels:['PTS']});
  unconfigured.handle('motion-template',{dataset:{key:'mission'}});
  assert.match(unconfigured.render(),/Save a multi-stat alert loadout/);
});
test('Analytics Lab exposes Animated Cards as native tab',async()=>{
  const api=async path=>{
    if(path.includes('/api/analytics/player'))return {analytics:{
      player:{id:'1966',name:'LeBron James'},history:{games:[{stats:{PTS:23},date:'2026-10-20'}],labels:['PTS']},
      feedWarnings:[],seasonStats:{categories:[]}
    }};
    throw Error('Unexpected call '+path);
  };
  const lab=createAnalyticsLab({api,refresh:()=>{},toast:()=>{},getWatches:()=>[],calculateFormula});
  await lab.openPlayer({id:'1966',name:'LeBron James'},'nba');
  assert.match(lab.render(),/ANIMATED CARDS/);
  lab.handle('lab-tab',{dataset:{value:'animated'}});
  assert.match(lab.render(),/MOTION STUDIO/);
});
