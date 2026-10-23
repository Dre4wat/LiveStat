import test from 'node:test';
import assert from 'node:assert/strict';
import {flattenRoster,espnProviderFor} from '../src/providers/espn.js';
import {normalizeGameLog} from '../src/providers/analytics.js';
import {rosterSeasonFromStats,rosterSeasonSummary,mergeRosterStats} from '../src/providers/roster-browser.js';

test('ESPN NBA current roster flat list and NFL grouped list both return every athlete',()=>{
 const flat=[{id:'1',displayName:'Player One'},{id:'2',displayName:'Player Two'}];
 const nested=[{position:'Quarterback',items:[{id:'3',displayName:'QB Starter'},{id:'4',displayName:'QB Backup'}]},
 {position:'Receivers',athletes:[{athlete:{id:'5',displayName:'WR One'}},{id:'6',displayName:'WR Two'}]}];
 assert.equal(flattenRoster(flat).length,2);
 assert.deepEqual(flattenRoster(nested).map(x=>x.displayName),['QB Starter','QB Backup','WR One','WR Two']);
 assert.equal(flattenRoster([...nested,{id:'3',displayName:'QB Starter'}]).length,4);
});
test('Official NBA ESPN season stats populate percentages, turnovers and key box stats even without a game log',()=>{
 const season={categories:[{name:'general',displayName:'General',labels:['GP','GS','MIN','PTS','REB','AST','STL','BLK','TO','FG%','3P%','FT%'],
   totals:['56','56','34.2','26.4','4.5','6.1','0.9','0.4','3.1','.502','.408','.924']}]};
 const result=rosterSeasonFromStats('nba',season);
 assert.equal(result.games,56);
 assert.equal(result.averages.PTS,26.4);
 assert.equal(result.averages.REB,4.5);
 assert.equal(result.averages.TOV,3.1);
 assert.equal(result.averages['FG%'],.502);
 assert.equal(result.averages['3P%'],.408);
 assert.equal(result.averages['FT%'],.924);
});
test('Official NFL ESPN categories keep overlapping YDS/TD separate for quarterbacks and receivers',()=>{
 const season={categories:[
  {name:'passing',labels:['GP','CMP','ATT','YDS','TD','INT'],totals:['15','291','400','3272','27','10']},
  {name:'rushing',labels:['CAR','YDS','TD'],totals:['55','269','3']},
  {name:'receiving',labels:['REC','YDS','TD'],totals:['1','9','0']},
  {name:'defensive',labels:['TOT','SACKS','INT'],totals:['0','0','0']}
 ]};
 const data=rosterSeasonFromStats('nfl',season);
 assert.equal(data.totals.PASSYDS,3272);
 assert.equal(data.totals.PASSTD,27);
 assert.equal(data.totals.PASSINT,10);
 assert.equal(data.totals.RUSHYDS,269);
 assert.equal(data.totals.RUSHTD,3);
 assert.equal(data.totals.RECYDS,9);
 assert.equal(data.totals.DEFSACKS,0);
 assert.equal(data.games,15);
});
test('Basketball gamelog shooting splits yield made/attempted and 3PT columns',()=>{
 const raw={labels:['DATE','OPP','RESULT','MIN','FG','3PT','FT','REB','AST','STL','BLK','PTS'],
   events:[{id:'g1',date:'2026-10-22',stats:['36','12-24','4-10','4-4','5','7','1','0','32']}]};
 const log=normalizeGameLog(raw,2027);
 assert.equal(log.games.length,1);
 const row=log.games[0].stats;
 assert.equal(row['3PM'],4);
 assert.equal(row['3PA'],10);
 assert.equal(row['FGM'],12);
 assert.equal(row['FGA'],24);
 assert.equal(row['FTM'],4);
 assert.equal(row['FTA'],4);
 assert.equal(row.PTS,32);
});
test('ESPN season aggregates override partial game logs while retaining available missing split stats',()=>{
 const official=rosterSeasonFromStats('nba',{categories:[{name:'general',labels:['GP','PTS','REB'],totals:['54','26.4','4.5']}]});
 const history=rosterSeasonSummary('nba',[{stats:{PTS:35,'3PM':4}},{stats:{PTS:28,'3PM':5}}]);
 const result=mergeRosterStats('nba',official,history);
 assert.equal(result.averages.PTS,26.4);
 assert.equal(result.averages['3PM'],4.5);
 assert.equal(result.games,54);
 assert.equal(result.sample,false);
});
test('ESPN player stats API can load season aggregates without a gamelog call',async()=>{
 const original=globalThis.fetch,paths=[];
 globalThis.fetch=async url=>{
   const path=String(url);paths.push(path);
   if(path.includes('/stats?'))return {ok:true,json:async()=>({categories:[{name:'general',
     labels:['GP','GS','MIN','PTS','REB','AST','STL','BLK','TO','FG%','3P%','FT%'],
     totals:['55','55','33','24','7','8','1','1','3','.5','.3','.8']}]})};
   throw Error('Unexpected game log request');
 };
 try{
   const r=await espnProviderFor('nba').rosterStats('1966',2026);
   assert.equal(r.averages.PTS,24);
   assert.equal(r.games,55);
   assert.equal(paths.filter(p=>p.includes('/gamelog')).length,0);
 }finally{globalThis.fetch=original}
});
