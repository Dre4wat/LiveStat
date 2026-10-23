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
