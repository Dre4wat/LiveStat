import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {archiveKey,archiveMode,fetchOrArchivePlayer,listArchivedSeasons} from '../src/engine/analytics-archive.js';
import {detectPlayerMilestones,detectMissionHighlights,milestoneCardStats} from '../src/providers/milestones.js';
import {careerTimeline,careerAnalysis,formAnalysis} from '../src/providers/trends.js';
import {createAnalyticsLab} from '../public/analytics-lab.js';
import {calculateFormula} from '../public/formula.js';

test('durable archive local directory stores historical seasons and serves them during provider failure',async()=>{
 const old=process.env.LIVESTAT_DATA_DIR,db=process.env.DATABASE_URL,folder=await fs.mkdtemp(path.join(os.tmpdir(),'livestat-archive-'));
 process.env.LIVESTAT_DATA_DIR=folder;delete process.env.DATABASE_URL;
 try{
  const payload={season:2022,history:{games:[{id:'abc',stats:{PTS:40},date:'2022-04-01'}]},seasonStats:{categories:[]},player:{id:'1966'}};
  const live=await fetchOrArchivePlayer('nba','1966',2022,async()=>payload);
  assert.equal(live.archive.source,'live');
  const result=await fetchOrArchivePlayer('nba','1966',2022,async()=>{throw Error('Should not request old season')});
  assert.equal(result.archive.source,'saved');
  assert.equal(result.history.games[0].stats.PTS,40);
  const listed=await listArchivedSeasons('nba','1966');
  assert.equal(listed[0].season,2022);
  assert.equal(archiveMode(),'configured-disk');
 }finally{
  if(old===undefined)delete process.env.LIVESTAT_DATA_DIR;else process.env.LIVESTAT_DATA_DIR=old;
  if(db!==undefined)process.env.DATABASE_URL=db;
  await fs.rm(folder,{recursive:true,force:true});
 }
});

test('archive validation rejects invalid identifiers',()=>{
 assert.equal(archiveKey('nfl','123',2020),'nfl:123:2020');
 assert.throws(()=>archiveKey('other','123',2020));
 assert.throws(()=>archiveKey('nba','1;drop',2020));
});
test('NBA milestone gallery detects verified 40-point and triple-double games without fake career records',()=>{
 const games=[{id:'g1',date:'2025-11-01',opponent:'BOS',stats:{PTS:45,REB:12,AST:11}},
 {id:'g2',date:'2025-10-28',stats:{PTS:24,REB:3,AST:8}}];
 const out=detectPlayerMilestones('nba',games);
 assert.ok(out.some(x=>x.type==='forty-point'));
 assert.ok(out.some(x=>x.type==='triple-double'));
 assert.ok(out.every(x=>x.source==='ESPN game log'));
 assert.deepEqual(milestoneCardStats(out.find(x=>x.type==='forty-point'),'nba').slice(0,3).map(x=>x.value),[45,12,11]);
});
test('Football milestones require scoped passing/receiving/rushing columns',()=>{
 const games=[{id:'g1',stats:{PASSYDS:325,RECYDS:116,DEFSACKS:2,RUSHYDS:14}},
 {id:'g2',stats:{YDS:350}}];
 const out=detectPlayerMilestones('nfl',games);
 assert.ok(out.some(x=>x.type==='three-hundred-pass'&&x.gameId==='g1'));
 assert.ok(out.some(x=>x.type==='hundred-receive'&&x.gameId==='g1'));
 assert.ok(out.some(x=>x.type==='two-sack'&&x.gameId==='g1'));
 assert.ok(!out.some(x=>x.gameId==='g2'));
});
test('Saved mission does not mark incomplete or missing numbers as achieved',()=>{
 const games=[{id:'a',stats:{PTS:25,REB:7,AST:5}},{id:'b',stats:{PTS:27,REB:8,AST:6}}];
 const rules={points:{target:25},rebounds:{target:8},assists:{target:5}};
 const res=detectMissionHighlights(games,rules);
 assert.equal(res.length,2);
 assert.equal(res.find(x=>x.gameId==='a').complete,false);
 assert.equal(res.find(x=>x.gameId==='b').complete,true);
});
test('Career trends compare only seasons with recorded values',()=>{
 const years=[
   {season:2023,history:{games:[{stats:{PTS:20}},{stats:{PTS:22}}]}},
   {season:2024,history:{games:[]}},
   {season:2025,history:{games:[{stats:{PTS:30}},{stats:{PTS:32}}]}}
 ];
 const graph=careerTimeline(years,'PTS');
 assert.deepEqual(graph.map(x=>x.season),[2023,2025]);
 assert.deepEqual(graph.map(x=>x.average),[21,31]);
 const analysis=careerAnalysis(years,'PTS');
 assert.equal(analysis.bestSeason,2025);
 assert.match(analysis.summary,/may not represent full seasons/);
});
test('Game-form report uses recent/prior sample and avoids unsupported forecasts',()=>{
 const games=Array.from({length:10},(_,i)=>({stats:{PTS:30-i},id:String(i)}));
 const report=formAnalysis(games,'PTS');
 assert.equal(report.count,10);
 assert.equal(report.recentMean,28);
 assert.equal(report.priorMean,23);
 assert.ok(report.evidence.length);
 assert.doesNotMatch(report.observations.join(' '),/will score|guaranteed/i);
});
test('Player Card Studio offers automatic highlight gallery and Career Lab',async()=>{
 const gamelog={games:[{id:'g1',stats:{PTS:44,REB:10,AST:10}}],labels:['PTS','REB','AST'],count:1};
 const api=async url=>{
   if(url.startsWith('/api/analytics/archive'))return {mode:'ephemeral-disk',seasons:[]};
   if(url.startsWith('/api/analytics/player'))return {analytics:{
     season:2026,history:gamelog,player:{id:'1966',name:'Sample Player'},feedWarnings:[],
     milestones:detectPlayerMilestones('nba',gamelog.games),seasonStats:{categories:[]}
   }};
   throw Error('Unexpected request '+url);
 };
 const lab=createAnalyticsLab({api,refresh:()=>{},toast:()=>{},getWatches:()=>[],calculateFormula});
 await lab.openPlayer({id:'1966',name:'Sample Player'},'nba');
 lab.handle('lab-tab',{dataset:{value:'cards'}});
 assert.match(lab.render(),/AUTO-DETECTED HIGHLIGHT CARDS/);
 assert.match(lab.render(),/40-POINT PERFORMANCE/);
 const milestone=lab.state.data.milestones.find(x=>x.type==='forty-point');
 lab.handle('lab-card-highlight',{dataset:{id:milestone.id}});
 assert.equal(lab.state.cardMode,'milestone');
 assert.match(lab.render(),/44/);
 lab.handle('lab-tab',{dataset:{value:'career'}});
 assert.match(lab.render(),/CAREER HISTORY & TRENDS/);
});
