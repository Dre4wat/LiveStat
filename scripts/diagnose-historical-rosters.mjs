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
