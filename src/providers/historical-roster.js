// Historical team membership. Do not confuse ESPN's current roster with a past season.
// NBA: Basketball-Reference season roster when accessible, verified against ESPN game boxes.
// NFL / college: players evidenced in ESPN historical team game box scores.
const paths={nba:'basketball/nba',nfl:'football/nfl',cfb:'football/college-football',ncaam:'basketball/mens-college-basketball',ncaaw:'basketball/womens-college-basketball'};
const brefCodes={WSH:'WAS',BKN:'BRK',GS:'GSW',NY:'NYK',SA:'SAS',PHX:'PHO',NO:'NOP',CHA:'CHO'};
const n=v=>v==null||v===''?null:Number.isFinite(Number(String(v).replace(/,/g,'')))?Number(String(v).replace(/,/g,'')):null;
const key=name=>String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const decode=s=>String(s||'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_m,x)=>String.fromCodePoint(x[0].toLowerCase()==='x'?parseInt(x.slice(1),16):Number(x)))
 .replace(/&(amp|lt|gt|quot|nbsp|rsquo|lsquo|ndash|mdash|aacute|eacute|ouml|uuml);/gi,(_m,c)=>({amp:'&',lt:'<',gt:'>',quot:'"',nbsp:' ',rsquo:"'",lsquo:"'",ndash:'–',mdash:'—',aacute:'á',eacute:'é',ouml:'ö',uuml:'ü'}[c.toLowerCase()]||''));
const txt=v=>decode(String(v||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function htmlRows(html,tableId){
 const match=new RegExp('<table\\b[^>]*\\bid="'+tableId+'"[^>]*>','i').exec(html);
 if(!match)return [];
 const start=match.index+match[0].length,end=html.indexOf('</table>',start);
 if(end<0)return [];
 const fragment=html.slice(start,end),body=/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(fragment)?.[1]||fragment;
 const rows=[];
 for(const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const obj={};
  for(const cell of row[1].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi)){
   const field=/data-stat="([^"]+)"/.exec(cell[2])?.[1];
   if(!field)continue;
   obj[field]=txt(cell[3]);
   if(field==='player')obj.brefId=/data-append-csv="([^"]+)"/.exec(cell[2])?.[1]||'';
  }
  if(obj.player&&obj.player!=='Player'&&!/team totals/i.test(obj.player))rows.push(obj);
 }
 return rows;
}
const columnMap={games:'GP',games_started:'GS',mp_per_g:'MIN',pts_per_g:'PTS',trb_per_g:'REB',ast_per_g:'AST',stl_per_g:'STL',
 blk_per_g:'BLK',tov_per_g:'TOV',fg3_per_g:'3PM',fg_pct:'FG%',fg3_pct:'3P%',ft_pct:'FT%',
 fg_per_g:'FGM',fga_per_g:'FGA',fg3a_per_g:'3PA',ft_per_g:'FTM',fta_per_g:'FTA'};
export function parseNBASeasonRoster(html,season){
 const roster=htmlRows(html,'roster'),stats=htmlRows(html,'per_game_stats');
 const byId=new Map(stats.map(r=>[r.brefId,r])),byName=new Map(stats.map(r=>[key(r.player),r]));
 return roster.map((p,index)=>{
  const r=byId.get(p.brefId)||byName.get(key(p.player))||{},games=n(r.games)||0,averages={},totals={};
  for(const [field,label] of Object.entries(columnMap)){
   const v=n(r[field]);if(v===null)continue;
   averages[label]=label.endsWith('%')?Number((v*100).toFixed(1)):v;
   if(games&&!label.endsWith('%')&&!['GP','GS'].includes(label))totals[label]=Number((v*games).toFixed(2));
  }
  return {
   id:'bref:'+p.brefId,brefId:p.brefId,espnId:'',name:p.player,position:p.pos||'',
   jersey:p.number||'',height:p.height||'',weight:p.weight?p.weight+' lb':'',college:p.college||'',
   birthDate:p.birth_date||'',age:n(r.age),historical:true,
   headshot:null,rankingSource:'season-roster',leaderRank:index+1,
   seasonStats:{games,averages,totals,source:'Basketball-Reference '+season+' season',sample:false}
  };
 }).sort((a,b)=>(b.seasonStats.games-a.seasonStats.games)||(b.seasonStats.averages.PTS||0)-(a.seasonStats.averages.PTS||0))
  .map((p,i)=>({...p,leaderRank:i+1}));
}
export function historicalGameSample(events,max=16){
 const valid=(events||[]).filter(x=>x?.id&&(!x.season?.type||Number(x.season.type)===2)&&
  (!x.seasonType||Number(x.seasonType)===2));
 const all=valid.length?valid:(events||[]).filter(x=>x?.id);
 if(all.length<=max)return all;
 const seen=new Set(),sample=[];
 for(let i=0;i<max;i++){const g=all[Math.round(i*(all.length-1)/(max-1))];if(!seen.has(g.id)){seen.add(g.id);sample.push(g)}}
 return sample;
}
export function rosterFromHistoricalBoxes(responses,teamId){
 const players=new Map();
 for(const response of responses||[]){
  const encountered=new Set();
  for(const group of response?.boxscore?.players||[]){
   if(String(group.team?.id)!==String(teamId))continue;
   for(const section of group.statistics||[])for(const entry of section.athletes||[]){
    const athlete=entry.athlete||{},id=String(athlete.id||'');
    if(!/^\d{1,14}$/.test(id)||!athlete.displayName)continue;
    if(!players.has(id)){
     players.set(id,{id,espnId:id,name:athlete.displayName,position:athlete.position?.abbreviation||'',
      jersey:athlete.jersey||'',headshot:athlete.headshot?.href||null,teamId:String(teamId),
      gamesSeen:0,startsSeen:0,historical:true,rankingSource:'season-boxscore'});
    }
    const p=players.get(id);
    if(!encountered.has(id)){p.gamesSeen++;encountered.add(id)}
    if(entry.starter)p.startsSeen++;
   }
  }
 }
 return [...players.values()].sort((a,b)=>b.startsSeen-a.startsSeen||b.gamesSeen-a.gamesSeen||a.name.localeCompare(b.name));
}
export function combineHistoricalRosters(roster,boxes,teamId){
 const lookup=new Map(boxes.map(p=>[key(p.name),p]));
 const combined=roster.map(row=>{
  const match=lookup.get(key(row.name));if(!match)return {...row,teamId:String(teamId)};
  lookup.delete(key(row.name));
  return {...row,id:match.id,espnId:match.id,teamId:String(teamId),headshot:match.headshot,startsSeen:match.startsSeen,gamesSeen:match.gamesSeen};
 });
 for(const p of lookup.values())combined.push(p);
 return combined;
}
async function json(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});
 if(!r.ok)throw Error('ESPN historical HTTP '+r.status);
 return r.json();
}
export async function loadHistoricalRoster({sport,teamId,season,abbreviation='',maxGames=16}){
 if(!paths[sport]||!/^\d{1,8}$/.test(String(teamId))||!Number.isInteger(Number(season))||season<1980||season>new Date().getUTCFullYear()+2)
  throw Error('Invalid historical roster selection');
 let roster=[],warning='';
 const code=brefCodes[String(abbreviation).toUpperCase()]||String(abbreviation).toUpperCase();
 if(sport==='nba'&&/^[A-Z]{2,3}$/.test(code)){
  try{
   const r=await fetch('https://www.basketball-reference.com/teams/'+code+'/'+season+'.html',{
    signal:AbortSignal.timeout(14000),headers:{'User-Agent':'Mozilla/5.0'}});
   if(!r.ok)throw Error('HTTP '+r.status);
   const html=await r.text();if(html.length>3000000)throw Error('HTML too large');
   roster=parseNBASeasonRoster(html,season);
  }catch(e){warning='Season roster reference unavailable; rebuilding from ESPN historical games'}
 }
 const base='https://site.api.espn.com/apis/site/v2/sports/'+paths[sport];
 let sample=[],responses=[];
 try{
  const schedule=await json(base+'/teams/'+teamId+'/schedule?season='+season);
  sample=historicalGameSample(schedule.events||[],Math.max(1,Math.min(28,maxGames)));
  for(let i=0;i<sample.length;i+=3){
   const results=await Promise.allSettled(sample.slice(i,i+3).map(g=>json(base+'/summary?event='+g.id)));
   responses.push(...results.filter(x=>x.status==='fulfilled').map(x=>x.value));
  }
 }catch(e){if(!roster.length)throw e;warning=warning||'Some ESPN historical game boxes were unavailable'}
 const boxPlayers=rosterFromHistoricalBoxes(responses,teamId);
 const players=roster.length?combineHistoricalRosters(roster,boxPlayers,teamId):boxPlayers;
 if(!players.length)throw Error('No verified historical roster players found');
 return {players,season:Number(season),historical:true,verifiedYear:true,
  source:roster.length?'Basketball-Reference season roster + ESPN historical game box scores':'ESPN historical team game box scores',
  rosterComplete:Boolean(roster.length),sampledGames:responses.length,scheduledGames:sample.length,warning:
    warning||(!roster.length?'Season game sample may omit players who appeared only in unsampled games':''),
  note:'Roster membership reflects the selected season, not the current team.'};
}
