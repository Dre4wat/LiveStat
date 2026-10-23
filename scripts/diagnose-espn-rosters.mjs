// Optional live ESPN diagnostic. Run with: npm run diagnose:rosters
// Never used as a production requirement or CI gate; ESPN APIs are unofficial.
import {espnProviderFor} from '../src/providers/espn.js';
const tasks=[
 ['NBA team roster',()=>espnProviderFor('nba').roster('13'),x=>({players:x.length,example:x[0]?.name,positions:[...new Set(x.map(p=>p.position))].slice(0,10)})],
 ['NBA player season',()=>espnProviderFor('nba').rosterStats('1966',2025),x=>({source:x.source,games:x.games,keys:Object.keys(x.averages||{}).slice(0,30),pts:x.averages?.PTS})],
 ['NFL team roster',()=>espnProviderFor('nfl').roster('12'),x=>({players:x.length,example:x[0]?.name,positions:[...new Set(x.map(p=>p.position))].slice(0,14)})],
 ['NFL player season',()=>espnProviderFor('nfl').rosterStats('3139477',2025),x=>({source:x.source,games:x.games,keys:Object.keys(x.totals||{}).slice(0,30),yards:x.totals?.PASSYDS})]
];
for(const [label,work,pick] of tasks){
 try{const payload=pick(await work());console.log(label+': '+JSON.stringify(payload))}
 catch(err){console.log(label+': unavailable ('+err.message+')')}
}

for(const [sport,athlete,year] of [
 ['basketball/nba','1966',2025],
 ['football/nfl','3139477',2025]
]){
 const url='https://site.web.api.espn.com/apis/common/v3/sports/'+sport+'/athletes/'+athlete+'/stats?season='+year;
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(9000)});
  const raw=await response.json();
  const cats=(raw.categories||[]).map(c=>({
    name:c.name,displayName:c.displayName,
    labels:c.labels?.slice(0,8),totals:c.totals?.slice(0,8),
    keys:Object.keys(c).slice(0,12)
  }));
  console.log('RAW_STATS '+sport+': '+JSON.stringify({
   responseStatus:response.status,keys:Object.keys(raw),filters:raw.filters?.map(f=>({
     name:f.name,value:f.value,displayName:f.displayName,options:f.options?.slice(0,2)})),
   season:raw.season,seasons:Array.isArray(raw.seasons)?raw.seasons.slice(0,2):null,
   categories:cats,teams:raw.teams?.length
  }).slice(0,3600));
 }catch(err){console.log('RAW_STATS '+sport+': unavailable: '+err.message)}
}
