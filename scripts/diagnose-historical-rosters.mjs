// One-time research diagnostic for authoritative ESPN historical team membership.
const targets=[
 ["nba_core",'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2021/teams/27/athletes?limit=100'],
 ["nba_core_team",'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2021/teams/27?lang=en&region=us'],
 ["nba_web_roster",'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/teams/27/roster?season=2021'],
 ["nba_site_roster",'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/27/roster?season=2021'],
 ["nba_espn_team_site",'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/27?season=2021&enable=roster'],
 ["nba_schedule",'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/27/schedule?season=2021'],
 ["nfl_core",'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2021/teams/12/athletes?limit=100'],
 ["cfb_core",'https://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/2021/teams/333/athletes?limit=100'],
 ["ncaam_core",'https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/2021/teams/120/athletes?limit=100']
];
for(const [name,url] of targets){
 try{
  const res=await fetch(url,{signal:AbortSignal.timeout(11000)});
  const data=await res.json();
  const vals=Array.isArray(data.items)?data.items:Array.isArray(data.athletes)?data.athletes:[];
  console.log('HISTCHECK '+name+' '+JSON.stringify({
   status:res.status,keys:Object.keys(data).slice(0,22),count:data.count,pageCount:data.pageCount,
   itemCount:vals.length,
   first:vals.slice(0,3).map(x=>({id:x.id,ref:x.$ref,name:x.displayName,keys:Object.keys(x).slice(0,10)})),
   athleteGroup:data.athletes?.length,
   events:data.events?.length,
   links:JSON.stringify(data.error||data.message||data.detail||data.team?.displayName||'').slice(0,250)
  }).slice(0,1100))
 }catch(err){console.log('HISTCHECK '+name+' ERROR '+err.message)}
}

for(const [name,url] of [
 ["nba_web_2021","https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/teams/27/roster?season=2021"],
 ["nba_web_2025","https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/teams/27/roster?season=2025"],
 ["nba_core_2021","https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2021/teams/27/athletes?limit=100"],
 ["nba_core_2025","https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2025/teams/27/athletes?limit=100"]
]){
 try{
  const raw=await (await fetch(url,{signal:AbortSignal.timeout(9000)})).json();
  const ids=raw.items?.map(x=>x.$ref?.match(/athletes\/(\d+)/)?.[1])||[];
  const groups=raw.positionGroups?.map(g=>({name:g.name||g.position?.name||g.displayName,
    keys:Object.keys(g),first:g.athletes?.slice(0,3).map(a=>({name:a.displayName,id:a.id,keys:Object.keys(a).slice(0,9)})),n:g.athletes?.length}));
  console.log("HISTDETAIL "+name+" "+JSON.stringify({ids:ids.slice(0,35),hasWestbrook:ids.includes('3468'),hasBeal:ids.includes('6580'),
    count:raw.count,season:raw.season,groups}));
 }catch(e){console.log("HISTDETAIL "+name+" ERROR "+e.message)}
}
const api='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/27/schedule?season=2021';
try{const raw=await(await fetch(api,{signal:AbortSignal.timeout(9000)})).json();
 console.log('HISTSCHEDULE '+JSON.stringify({games:raw.events?.length,first:raw.events?.slice(0,2).map(e=>({id:e.id,date:e.date,keys:Object.keys(e)}))}));
}catch(e){console.log('HISTSCHEDULE ERROR '+e.message)}

for(const [name,url] of [
 ["nba_season_statistics",'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/27/statistics?season=2021'],
 ["nba_team_web_stats",'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/teams/27/statistics?season=2021'],
 ["nba_team_players",'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/27/athletes?season=2021'],
 ["nba_team_standings",'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/27?enable=statistics&season=2021'],
 ["basketball_reference",'https://www.basketball-reference.com/teams/WAS/2021.html'],
 ["nba_boxscore",'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401267173']
]){
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(12500),headers:{'User-Agent':'Mozilla/5.0'}});
  if(!response.ok){console.log('HISTX '+name+' '+response.status);continue}
  if(name==='basketball_reference'){const html=await response.text();console.log('HISTX bref '+JSON.stringify({length:html.length,containsBeal:html.includes('Bradley Beal'),containsWestbrook:html.includes('Russell Westbrook'),containsRoster:html.includes('id="roster"')}));continue}
  const data=await response.json();
  const groups=(data.boxscore?.players||[]).map(g=>({
    team:g.team?.displayName,
    teamId:g.team?.id,
    athletes:g.statistics?.flatMap(x=>x.athletes||[]).map(x=>({
      id:x.athlete?.id,name:x.athlete?.displayName,position:x.athlete?.position?.abbreviation,starter:x.starter
    })).slice(0,5)
  }));
  console.log('HISTX '+name+' '+JSON.stringify({keys:Object.keys(data),athleteCount:data.athletes?.length,
   statisticsKeys:Object.keys(data.statistics||{}),groupCount:groups.length,groups:groups.slice(0,2),
   teamKeys:Object.keys(data.team||{}).slice(0,15),date:data.header?.competitions?.[0]?.date}).slice(0,2400))
 }catch(e){console.log('HISTX '+name+' ERROR '+e.message)}
}

try{
 const html=await(await fetch('https://www.basketball-reference.com/teams/WAS/2021.html',{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0'}})).text();
 for(const id of ['roster','per_game','per_game-team']){
  const i=html.indexOf('id="'+id+'"');console.log('HISTBREF '+id+' '+JSON.stringify({index:i,chunk:i>=0?html.slice(i,i+1600):''}))
 }
}catch(err){console.log('HISTBREF ERROR '+err.message)}
try{
 const data=await(await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/27/statistics?season=2021',{signal:AbortSignal.timeout(9000)})).json();
 console.log('HISTSTATRESULT '+JSON.stringify({results:data.results?.length,first:data.results?.slice(0,2)}).slice(0,2600))
}catch(e){console.log('HISTSTATRESULT ERROR '+e.message)}

try{
 const html=await(await fetch('https://www.basketball-reference.com/teams/WAS/2021.html',{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0'}})).text();
 const ids=[...html.matchAll(/<table\b[^>]*\bid="([^"]+)"/g)].map(x=>x[1]);
 const per=html.search(/Per Game Table/);
 const firstPlayer=html.indexOf('data-append-csv="westbru01"');
 console.log('HISTBREF_TABLES '+JSON.stringify({ids,per,chunk:per>=0?html.slice(per-160,per+110):'',westbrook:firstPlayer>=0?html.slice(firstPlayer,firstPlayer+440):''}).slice(0,3000));
}catch(err){console.log('HISTBREF_TABLES ERR '+err.message)}

try{
 const {loadHistoricalRoster}=await import('../src/providers/historical-roster.js');
 const x=await loadHistoricalRoster({sport:'nba',teamId:'27',season:2021,abbreviation:'WSH',maxGames:16});
 const west=x.players.find(p=>/westbrook/i.test(p.name)),beal=x.players.find(p=>/bradley beal/i.test(p.name));
 console.log('WIZARDS_2021_REAL '+JSON.stringify({
  count:x.players.length,source:x.source,rosterComplete:x.rosterComplete,sampledGames:x.sampledGames,
  westbrook:west&&{name:west.name,id:west.id,pts:west.seasonStats?.averages?.PTS,reb:west.seasonStats?.averages?.REB},
  beal:beal&&{name:beal.name,id:beal.id,pts:beal.seasonStats?.averages?.PTS},
  futureDybantsa:x.players.some(p=>/dybantsa/i.test(p.name)),all:x.players.map(p=>p.name)
 }).slice(0,2600));
}catch(e){console.log('WIZARDS_2021_REAL FAIL '+e.stack)}
