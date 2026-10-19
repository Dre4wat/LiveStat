import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGameLog,normalizeSeasonStats,metricSeries,average,analyzePlayer,calculateFormula,normalizeESPNPlayerSearch} from '../src/providers/analytics.js';
import {createAnalyticsLab} from '../public/analytics-lab.js';

const sample=()=>{
 const ids=['game1','game2','game3','game4','game5','game6'];
 return {seasonTypes:[{id:'2',categories:[{name:'averages',displayName:'Per Game',
   labels:['PTS','REB','AST','FG%'],
   events:ids.map((id,i)=>({eventId:id,stats:[String(16+i*2),String(5+i),String(4+i),'45.0']}))
 }]}],
 events:Object.fromEntries(ids.map((id,i)=>[id,{gameDate:'2026-10-'+String(i+10).padStart(2,'0'),opponent:{abbreviation:'OP'+i},gameResult:i%2?'W':'L',score:'104-98'}]))
 };
};
test('historic player gamelog normalizes real event metadata and statistical columns',()=>{
 const d=normalizeGameLog(sample(),2027);
 assert.equal(d.count,6);assert.equal(d.games[0].id,'game6');
 assert.equal(d.games[0].stats.PTS,26);
 assert.equal(d.games[0].opponent,'OP5');
 assert.deepEqual(d.labels,['PTS','REB','AST','FG%']);
 assert.equal(d.games[0].date,'2026-10-15');
});
test('unavailable ESPN game log does not pretend a season was played',()=>{
 assert.deepEqual(normalizeGameLog({},2025),{season:2025,games:[],labels:[],count:0});
});
test('season stats normalize only numeric values provided by feed',()=>{
 const d=normalizeSeasonStats({categories:[{name:'Per Game',labels:['PTS','FG'],totals:['23.1','10-19']}]},2025);
 assert.equal(d.categories[0].values.PTS,23.1);
 assert.equal('FG' in d.categories[0].values,false);
});
test('trends and analyst distinguish game sample from full season',()=>{
 const d=normalizeGameLog(sample(),2027);
 assert.equal(metricSeries(d.games,'PTS').length,6);
 assert.equal(average(d.games,'PTS'),21);
 const x=analyzePlayer({name:'Test Player'},d.games,'PTS');
 assert.equal(x.mode,'statistical');
 assert.match(x.summary,/6 available games/);
 assert.match(x.summary,/Most recent recorded game: 26 PTS/);
 const no=analyzePlayer({name:'Unknown'},[],'PTS');
 assert.equal(no.gameCount,undefined);
 assert.match(no.summary,/Not enough/);
});
test('formula calculator is arithmetic only with stat allowlist and no eval',()=>{
 assert.equal(calculateFormula('PTS + REB * 2',{PTS:20,REB:10}),40);
 assert.equal(calculateFormula('(PTS + REB) / 2',{PTS:20,REB:10}),15);
 assert.throws(()=>calculateFormula('process.exit()',{PTS:20}),/Invalid formula/);
 assert.throws(()=>calculateFormula('PTS / 0',{PTS:20}),/Division by zero/);
 assert.throws(()=>calculateFormula('PTS + AST',{PTS:20}),/Unavailable stat/);
});
test('search limits results to ESPN athlete objects matching query',()=>{
 const d={results:[{contents:[
   {type:'athlete',id:'1966',displayName:'LeBron James',position:{abbreviation:'SF'}},
   {type:'article',id:'777777',displayName:'James scores'},
   {type:'athlete',id:'1966',displayName:'LeBron James'}]}]};
 const hits=normalizeESPNPlayerSearch(d,'LeBron','nba');
 assert.equal(hits.length,1);assert.equal(hits[0].id,'1966');
});
test('Analytics Lab loads game history into tabs and supports layouts and reports without browser globals',async()=>{
 const historic=normalizeGameLog(sample(),2027);
 const calls=[];
 const api=async(path,method,body)=>{
   calls.push(path);
   if(path.startsWith('/api/analytics/player'))return {analytics:{sport:'nba',season:2027,player:{id:'1966',name:'LeBron James'},history:historic,seasonStats:{categories:[]},feedWarnings:[]}};
   if(path==='/api/analytics/analyst')return {mode:'statistical',analysis:analyzePlayer({name:'LeBron James'},historic.games,body.metric)};
   throw Error('Unexpected request: '+path);
 };
 const ui=createAnalyticsLab({api,refresh:()=>{},toast:()=>{},getWatches:()=>[],calculateFormula});
 await ui.openPlayer({id:'1966',name:'LeBron James'},'nba');
 assert.match(ui.render(),/ANALYTICS/);
 assert.match(ui.render(),/MY STAT DASHBOARD/);
 ui.handle('lab-tab',{dataset:{value:'history'}});
 assert.match(ui.render(),/GAME HISTORY/);
 assert.match(ui.render(),/OP5/);
 ui.handle('lab-tab',{dataset:{value:'formula'}});
 assert.match(ui.render(),/FORMULA LAB/);
 ui.input({id:'lab-formula',value:'PTS + REB + AST'});
 ui.handle('lab-formula-run',{dataset:{}});
 assert.match(ui.render(),/45/); // latest: PTS26 + REB10 + AST9
});
