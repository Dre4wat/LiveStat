import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeGameData} from '../src/providers/analytics.js';
import {createAnalyticsLab} from '../public/analytics-lab.js';
import {calculateFormula} from '../public/formula.js';
import {createInsights} from '../public/intelligence-ui.js';

test('Game Analyst uses only supplied team scoring, leaders and third down counts',()=>{
 const insights={sport:'nfl',teams:[
  {id:'1',abbr:'AWY',side:'away'},{id:'2',abbr:'HME',side:'home'}
 ],periods:[{period:1,away:3,home:10},{period:2,away:7,home:0}],
 momentumSummary:{leadChanges:2,biggestHomeLead:14,biggestAwayLead:4}};
 const box={teams:[{abbr:'AWY',stats:[{name:'thirdDownEff',label:'3rd Down Efficiency',value:'2-8'}]}]};
 const a=analyzeGameData(insights,box);
 assert.match(a.summary,/lead changed 2 times/);
 assert.match(a.summary,/third-down efficiency: 2-8/);
 assert.ok(a.evidence.find(e=>e.source==='Team box score'));
 assert.doesNotMatch(a.summary,/injury|prediction/i);
});
test('Game Analyst refuses to describe an empty game as if it had stats',()=>{
 const a=analyzeGameData({sport:'nba',periods:[],momentumSummary:{}},{});
 assert.match(a.summary,/not enough verified/);
 assert.equal(a.observations.length,0);
});
test('Analytics cards may use actual selected game stats without changing recorded history',async()=>{
 const games=[{id:'g1',date:'2026-10-20',stats:{PTS:30,REB:7,AST:5}}];
 const api=async(path)=>{
  if(path.startsWith('/api/analytics/player'))return {analytics:{sport:'nba',player:{id:'1966',name:'LeBron James'},history:{games,labels:['PTS','REB','AST'],count:1},seasonStats:{categories:[]},feedWarnings:[]}};
  if(path.startsWith('/api/analytics/current'))return {current:{available:true,state:'in',status:'Q3',stats:{points:21,rebounds:4,assists:7}}};
  throw Error('Unexpected endpoint '+path);
 };
 const ui=createAnalyticsLab({api,refresh:()=>{},toast:()=>{},getWatches:()=>[],calculateFormula});
 await ui.openPlayer({id:'1966',name:'LeBron James'},'nba',{gameId:'401000001',teamId:'13'});
 ui.handle('lab-tab',{dataset:{value:'cards'}});
 assert.match(ui.render(),/SELECTED GAME BOX SCORE|Selected game box score/);
 assert.match(ui.render(),/>21</);
 assert.match(ui.render(),/AVG 30/);
});
test('game center Game Analyst tab loads only verified server-side game analysis',async()=>{
 const ids=[];
 const api=async(path)=>{
  ids.push(path);
  if(path.startsWith('/api/intelligence'))return {insights:{teams:[],plays:[],scoring:[],periods:[],momentum:[],momentumSummary:{},shots:[],drives:[]}};
  if(path.startsWith('/api/analytics/game'))return {analysis:{summary:'Verified game facts.',evidence:[{source:'Scoreboard',detail:'Final'}]}};
  throw Error('Unexpected call');
 };
 const ui=createInsights({api,escape:s=>String(s),refresh:()=>{}});
 await ui.openGame('nfl',{id:'401111111',name:'Test Game',teams:[]});
 ui.handle('intel-tab',{dataset:{value:'analyst'}});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.match(ui.render(),/Verified game facts/);
 assert.ok(ids.some(s=>s.startsWith('/api/analytics/game')));
});
