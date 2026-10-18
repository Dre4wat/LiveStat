import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichRoster,rosterGroups,positionGroup,sortRosterPlayers} from '../src/providers/roster-ranking.js';
import {positionOptions,filterRoster,positionGroupForPlayer} from '../public/roster-select.js';

const player=(id,name,position)=>({id:String(id),name,position,teamId:'12'});
const nfl=[
 player(100,'Alpha Backup','QB'),
 player(101,'Zion Starter','QB'),
 player(102,'Caleb Runner','RB'),
 player(103,'Blake Receiver','WR'),
 player(104,'Dante Pass Rusher','DE'),
 player(105,'Marvin Corner','CB'),
 player(106,'Stefan Safety','FS'),
 player(107,'Jared Kicker','K')
];
test('opens football roster as position groups with player counts',()=>{
 const options=positionOptions(nfl,'nfl');
 assert.deepEqual(options.map(o=>[o.id,o.count]),[['QB',2],['RB',1],['WR',1],['DL',1],['CB',1],['S',1],['ST',1]]);
 assert.deepEqual(rosterGroups('cfb').map(g=>g.id).slice(0,4),['QB','RB','WR','TE']);
 assert.equal(positionGroupForPlayer(nfl[6],'nfl'),'S');
 assert.equal(positionGroup('FS','nfl'),'S');
});
test('group selection restricts roster, while search can find players from any group',()=>{
 assert.deepEqual(filterRoster(nfl,'nfl','QB').map(p=>p.name),['Alpha Backup','Zion Starter']);
 assert.deepEqual(filterRoster(nfl,'nfl',null,'receiver').map(p=>p.name),['Blake Receiver']);
 assert.deepEqual(filterRoster(nfl,'nfl','ALL').length,8);
 assert.equal(filterRoster(nfl,'nfl','QB','receiv').length,0);
});
test('basketball uses guard/forward/center groups on selection',()=>{
 const players=[player(1,'Guard A','PG'),player(2,'Guard B','SG'),player(3,'Forward A','PF'),player(4,'Center A','C')];
 assert.deepEqual(positionOptions(players,'nba').map(x=>[x.id,x.count]),[['G',2],['F',1],['C',1]]);
 assert.equal(positionGroupForPlayer(players[2],'ncaam'),'F');
});
test('official depth chart rank beats alphabetic order',()=>{
 const ranked=enrichRoster(nfl,'nfl',{depthCharts:{depthCharts:[{name:'Offense',positions:{
    quarterback:{position:{abbreviation:'QB'},athletes:[
      {rank:1,athlete:{id:'101'}},{rank:2,athlete:{id:'100'}}
    ]}}
  }]}});
 const qbs=ranked.filter(p=>p.group==='QB');
 assert.deepEqual(qbs.map(p=>p.name),['Zion Starter','Alpha Backup']);
 assert.deepEqual(qbs.map(p=>p.depthRank),[1,2]);
 assert.equal(qbs[0].rankingSource,'depth');
});
test('team statistical leaders take priority when depth information missing',()=>{
 const ranked=enrichRoster(nfl,'nfl',{leaders:{leaders:[{name:'passingYards',leaders:[
   {rank:1,athlete:{id:'101'},value:2200},{rank:2,athlete:{id:'100'},value:300}
 ]}]}});
 assert.deepEqual(ranked.filter(p=>p.group==='QB').map(p=>p.id),['101','100']);
 assert.equal(ranked.find(p=>p.id==='101').rankingSource,'leader');
});
test('game box stats and starter tags help rank when neither depth nor leaders exist',()=>{
 const ranked=enrichRoster(nfl,'nfl',{boxScore:{groups:[{teamId:'12',sections:[{name:'Passing',labels:['YDS','TD'],rows:[
    {id:'100',stats:['23','0'],starter:false},{id:'101',stats:['220','2'],starter:true}
  ]}]}]}});
 const qbs=ranked.filter(p=>p.group==='QB');
 assert.equal(qbs[0].name,'Zion Starter');
 assert.equal(qbs[0].starter,true);
 assert.ok(qbs[0].gameScore>0);
});
test('roster remains browsable alphabetically without rankings',()=>{
 const result=enrichRoster(nfl,'cfb',{});
 assert.deepEqual(result.filter(p=>p.group==='QB').map(p=>p.name),['Alpha Backup','Zion Starter']);
 assert.ok(result.every(p=>p.rankingSource==='alphabetical'));
});
