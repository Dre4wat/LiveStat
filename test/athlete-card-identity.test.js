import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {normalizeAthleteIdentity} from '../src/providers/athlete-identity.js';
import {espnProviderFor} from '../src/providers/espn.js';
import {createAnalyticsLab} from '../public/analytics-lab.js';
import {calculateFormula} from '../public/formula.js';
import {fetchOrArchivePlayer} from '../src/engine/analytics-archive.js';

const athleteRoot={athlete:{
 id:'3139477',displayName:'Patrick Mahomes',
 position:{abbreviation:'QB'},jersey:'15',
 team:{id:'12',displayName:'Kansas City Chiefs',abbreviation:'KC',color:'E31837'},
 headshot:{href:'https://a.espncdn.com/i/headshots/nfl/players/full/3139477.png'}
}};
const overviewOnly={statistics:{labels:['GP','YDS'],values:[17,4500]}};
test('player identity comes from ESPN athlete root instead of the overview stats response',()=>{
 const p=normalizeAthleteIdentity({root:athleteRoot,overview:overviewOnly,sport:'nfl',id:'3139477'});
 assert.deepEqual([p.name,p.position,p.team,p.teamAbbr,p.jersey,p.teamColor],
 ['Patrick Mahomes','QB','Kansas City Chiefs','KC','15','E31837']);
 assert.match(p.headshot,/a\.espncdn\.com\/i\/headshots\/nfl\/players\/full\/3139477\.png$/);
 assert.equal(p.headshotSource,'espn-profile');
});
test('ESPN CDN headshot uses an athlete-ID fallback when feed contains no photo',()=>{
 const p=normalizeAthleteIdentity({root:{athlete:{displayName:'Test Player'}},sport:'nba',id:'1966'});
 assert.equal(p.name,'Test Player');
 assert.equal(p.headshot,'https://a.espncdn.com/i/headshots/nba/players/full/1966.png');
 assert.equal(p.headshotSource,'espn-cdn-candidate');
});
test('ESPN provider fetches athlete root and combines it with independent gamelog',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{
  const path=String(url);calls.push(path);
  let data={};
  if(/\/athletes\/3139477\/?$/.test(path))data=athleteRoot;
  else if(path.includes('/overview'))data=overviewOnly;
  else if(path.includes('/stats?'))data={categories:[{name:'General',labels:['YDS'],totals:['4500']}]};
  else if(path.includes('/gamelog?'))data={events:[{id:'401111111',date:'2026-09-20',stats:['287','3']}],labels:['YDS','TD']};
  else throw Error('Unexpected ESPN endpoint '+path);
  return {ok:true,json:async()=>data};
 };
 try{
  const result=await espnProviderFor('nfl').analyticsPlayer('3139477',2026);
  assert.equal(result.player.name,'Patrick Mahomes');
  assert.equal(result.player.team,'Kansas City Chiefs');
  assert.ok(result.player.headshot.includes('3139477.png'));
  assert.equal(result.history.games.length,1);
  assert.equal(result.history.games[0].stats.YDS,287);
  assert.ok(calls.some(x=>/\/athletes\/3139477$/.test(x)),'root identity endpoint must be fetched');
 }finally{globalThis.fetch=original}
});
test('Analytics Lab keeps the known roster identity if an older archived profile has blank values',async()=>{
 const api=async url=>{
  if(url.startsWith('/api/analytics/player'))return {analytics:{
   season:2026,player:{id:'3139477',name:'',team:'',headshot:'',teamColor:''},
   history:{games:[{id:'g1',stats:{YDS:297,TD:4}}],labels:['YDS','TD'],count:1},
   seasonStats:{categories:[]},feedWarnings:[]
  }};
  if(url.startsWith('/api/analytics/archive'))return {mode:'ephemeral-disk',seasons:[]};
  throw Error('Unexpected request '+url);
 };
 const lab=createAnalyticsLab({api,refresh:()=>{},toast:()=>{},getWatches:()=>[],calculateFormula});
 await lab.openPlayer({
  id:'3139477',name:'Patrick Mahomes',team:'Kansas City Chiefs',
  headshot:'https://a.espncdn.com/i/headshots/nfl/players/full/3139477.png'
 },'nfl');
 assert.equal(lab.state.player.name,'Patrick Mahomes');
 lab.handle('lab-tab',{dataset:{value:'animated'}});
 const html=lab.render();
 assert.match(html,/Patrick Mahomes/);
 assert.doesNotMatch(html,/No player chosen/);
 lab.handle('lab-tab',{dataset:{value:'cards'}});
 assert.match(lab.render(),/Patrick Mahomes/);
});
test('Archived seasons missing player identity re-fetch rather than perpetually using the bad snapshot',async()=>{
 const oldData=process.env.LIVESTAT_DATA_DIR,oldDB=process.env.DATABASE_URL;
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'livestat-player-identity-'));
 delete process.env.DATABASE_URL;process.env.LIVESTAT_DATA_DIR=dir;
 try{
  const first=await fetchOrArchivePlayer('nfl','3139477',2020,async()=>({
   player:{id:'3139477',name:''},history:{games:[{id:'g1',stats:{YDS:200}}]},seasonStats:{categories:[]}
  }));
  assert.equal(first.player.name,'');
  let calls=0;
  const corrected=await fetchOrArchivePlayer('nfl','3139477',2020,async()=>{
   calls++;
   return {player:{id:'3139477',name:'Patrick Mahomes'},history:{games:[{id:'g1',stats:{YDS:200}}]},seasonStats:{categories:[]}};
  });
  assert.equal(calls,1);
  assert.equal(corrected.player.name,'Patrick Mahomes');
 }finally{
  if(oldData===undefined)delete process.env.LIVESTAT_DATA_DIR;else process.env.LIVESTAT_DATA_DIR=oldData;
  if(oldDB===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldDB;
  await fs.rm(dir,{recursive:true,force:true});
 }
});
