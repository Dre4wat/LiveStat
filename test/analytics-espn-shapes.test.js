import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGameLog,average,analyzePlayer} from '../src/providers/analytics.js';

test('NBA ESPN top-level events + labels produces real game history and averages',()=>{
  const raw={
    labels:['DATE','OPP','RESULT','MIN','FG','3PT','FT','REB','AST','STL','BLK','PTS'],
    events:[
      {id:'401765000',date:'2025-03-14T00:00Z',opponent:{displayName:'Boston Celtics',abbreviation:'BOS'},gameResult:'W',
        stats:['36','12-24','4-10','4-4','5','7','1','0','32']},
      {id:'401764999',date:'2025-03-12T00:00Z',opponent:{displayName:'New York Knicks'},gameResult:'L',
        stats:['34','8-16','2-5','2-2','6','8','1','0','20']}
    ]
  };
  const result=normalizeGameLog(raw,2025);
  assert.equal(result.count,2);
  assert.equal(result.games[0].stats.MIN,36);
  assert.equal(result.games[0].stats.PTS,32);
  assert.equal(result.games[0].stats.REB,5);
  assert.equal(result.games[0].stats.AST,7);
  assert.equal(result.games[0].opponent,'Boston Celtics');
  assert.equal(average(result.games,'PTS'),26);
  assert.match(analyzePlayer({name:'NBA Sample'},result.games,'PTS').summary,/26\.0 PTS/);
});

test('Football passing and rushing YDS stay distinguishable in same game',()=>{
  const raw={
    events:{game1:{gameDate:'2026-09-20',opponent:{abbreviation:'DAL'}}},
    seasonTypes:[{categories:[
      {name:'passing',displayName:'Passing',labels:['C/ATT','YDS','TD','INT'],events:[{eventId:'game1',stats:['27/37','301','3','0']}]},
      {name:'rushing',displayName:'Rushing',labels:['CAR','YDS','TD'],events:[{eventId:'game1',stats:['7','51','1']}]}
    ]}]
  };
  const result=normalizeGameLog(raw,2026);
  assert.equal(result.count,1);
  const game=result.games[0];
  assert.equal(game.stats.PASSYDS,301);
  assert.equal(game.stats.RUSHYDS,51);
  assert.equal(game.stats.PASSTD,3);
  assert.equal(game.stats.RUSHTD,1);
  assert.equal(game.stats.YDS,301); // Backward-compatible ambiguous column uses first section only.
  assert.equal(average(result.games,'RUSHYDS'),51);
  assert.equal(game.opponent,'DAL');
});

test('No phantom rows from event metadata without stats',()=>{
  const raw={events:[{id:'401123',date:'2025-12-01',opponent:{abbreviation:'LAL'}}],labels:['PTS','REB']};
  assert.equal(normalizeGameLog(raw,2025).count,0);
});

test('Player Cards prefer identifiable ESPN basketball season averages over incomplete sample averages',async()=>{
  const {createAnalyticsLab}=await import('../public/analytics-lab.js');
  const {calculateFormula}=await import('../public/formula.js');
  const gamelog={games:[{id:'g1',date:'2025-04-01',stats:{PTS:40,REB:7,AST:5}}],labels:['PTS','REB','AST']};
  const seasonStats={categories:[{name:'General',values:{PTS:27.2,REB:6.8,AST:7.1}}]};
  const api=async pathname=>{
    if(pathname.includes('/api/analytics/player'))return {analytics:{player:{id:'1966',name:'LeBron James'},history:gamelog,seasonStats,feedWarnings:[]}};
    throw Error('Unexpected request');
  };
  const lab=createAnalyticsLab({api,refresh:()=>{},toast:()=>{},getWatches:()=>[],calculateFormula});
  await lab.openPlayer({id:'1966',name:'LeBron James'},'nba');
  lab.handle('lab-tab',{dataset:{value:'cards'}});
  const markup=lab.render();
  assert.match(markup,/ESPN SEASON AVG 27\.2/);
  assert.doesNotMatch(markup,/SAMPLE AVG 40/);
});

test('Analytics Lab ESPN search respects the selected sport',async()=>{
  const {espnProviderFor}=await import('../src/providers/espn.js');
  const original=globalThis.fetch,requests=[];
  globalThis.fetch=async url=>{
    requests.push(String(url));
    return {ok:true,json:async()=>({results:[{contents:[{id:'1966',type:'athlete',displayName:'LeBron James'}]}]})};
  };
  try{
    const matches=await espnProviderFor('nba').searchAthletes('LeBron');
    assert.equal(matches[0]?.id,'1966');
    assert.match(requests[0],/sport=nba/);
  }finally{globalThis.fetch=original}
});
