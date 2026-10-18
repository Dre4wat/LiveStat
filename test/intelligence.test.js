import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeIntelligence,extractBoxTotals} from '../src/providers/intelligence.js';
import {normalizeWatch,matchPlay} from '../src/engine/events.js';
import {createInsights} from '../public/intelligence-ui.js';

const nba=()=>({
 header:{competitions:[{status:{type:{state:'post',detail:'Final'}},competitors:[
  {team:{id:'13',abbreviation:'LAL',displayName:'Lakers'},homeAway:'away',score:'103'},
  {team:{id:'9',abbreviation:'GSW',displayName:'Warriors'},homeAway:'home',score:'101'}
 ]}]},
 plays:[
 {id:'one',period:{number:1},clock:{displayValue:'11:20'},team:{id:'13'},text:'LeBron James makes layup',scoringPlay:true,scoreValue:2,homeScore:0,awayScore:2,shootingPlay:true,coordinate:{x:10,y:12}},
 {id:'two',period:{number:1},clock:{displayValue:'10:58'},team:{id:'9'},text:'Stephen Curry makes three point jumper',scoringPlay:true,scoreValue:3,homeScore:3,awayScore:2,shootingPlay:true,coordinate:{x:8,y:11}},
 {id:'three',period:{number:2},clock:{displayValue:'09:00'},team:{id:'13'},text:'LeBron James makes free throw',scoringPlay:true,scoreValue:1,homeScore:3,awayScore:3}
 ],
 winprobability:[{playId:'one',homeWinPercentage:0.47},{playId:'three',homeWinPercentage:0.51}]
});
test('game detail has all plays, scoring periods, lead changes, shots and source probabilities',()=>{
 const x=normalizeIntelligence('nba','401766122',nba());
 assert.equal(x.plays.length,3);
 assert.equal(x.scoring.length,3);
 assert.equal(x.periods[0].away,2);
 assert.equal(x.periods[1].away,1);
 assert.equal(x.momentumSummary.leadChanges,1);
 assert.equal(x.shots.length,2);
 assert.equal(x.probabilities[1].home,.51);
 assert.equal(x.homeId,'9');
});
test('football drives retain play descriptions and start/end',()=>{
 const d={header:{competitions:[]},drives:{previous:[{id:'d1',team:{id:'7'},start:{text:'Own 25'},plays:[{id:'p1',text:'Pass complete',period:{number:2},clock:{displayValue:'02:00'}}],displayResult:'Touchdown',yards:75}]}};
 const x=normalizeIntelligence('nfl','401123456',d);
 assert.equal(x.plays.length,1);
 assert.equal(x.drives[0].yardage,75);
 assert.equal(x.drives[0].result,'Touchdown');
});
test('live tracker takes structured player totals only when present',()=>{
 const box={groups:[{teamId:'13',sections:[{name:'Game',labels:['PTS','REB','AST'],rows:[{id:'1966',stats:['25','8','5']}],totals:[]}]}]};
 assert.deepEqual(extractBoxTotals(box,{kind:'player',teamId:'13',playerId:'1966'}),{points:25,rebounds:8,assists:5});
 assert.deepEqual(extractBoxTotals(box,{kind:'player',teamId:'13',playerId:'missing'}),{});
});
test('smart rule configuration validates combined missions and quarter filters',()=>{
 const rule=normalizeWatch({sport:'nba',kind:'player',name:'Demo Athlete',playerId:'1966',teamId:'13',gameId:'401766122',rules:{points:{every:true,target:25},assists:{every:false,target:5}},smart:{combine:'all',near:3,periodMin:4,maxMargin:8}});
 assert.equal(rule.smart.combine,'all');
 assert.equal(rule.smart.near,3);
 assert.equal(rule.smart.maxMargin,8);
});
test('football drive events include red zone, scoring drive, and turnover',()=>{
 const w=normalizeWatch({sport:'nfl',kind:'team',name:'Atlanta',teamId:'1',rules:{redZoneEntries:{every:true},scoringDrives:{every:true},turnovers:{every:true}}});
 const events=matchPlay({id:'5',text:'Pass complete at DAL 17. TOUCHDOWN, recovered by ATL',teamId:'1',opponentAbbr:'DAL',driveId:'D7',scoringPlay:true},w);
 assert.ok(events.some(e=>e.stat==='redZoneEntries'));
 assert.ok(events.some(e=>e.stat==='scoringDrives'));
 const fumble=matchPlay({id:'6',text:'ATL runner FUMBLES recovered by DAL',teamId:'1',opponentAbbr:'DAL',driveId:'D8'},w);
 assert.ok(fumble.some(e=>e.stat==='turnovers'));
});
test('mobile game center shows a real-data empty state rather than invented statistics',async()=>{
 const screen=createInsights({api:async()=>({insights:normalizeIntelligence('nba','401766122',{})}),escape:x=>String(x).replace(/</g,'&lt;'),refresh:()=>{}});
 await screen.openGame('nba',{id:'401766122',name:'Example Game',teams:[]});
 assert.match(screen.render(),/GAME INTELLIGENCE/);
 screen.handle('intel-tab',{dataset:{value:'shots'}});
 assert.match(screen.render(),/No shot coordinates/);
});
