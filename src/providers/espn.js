// Best-effort, UNOFFICIAL public ESPN endpoints. Never promise realtime accuracy.
// Multi-league normalization stays behind this interface; licensed feeds can replace it.
import {normalizeBoxScore} from './boxscore.js';
export const SPORTS = {
  nfl:   {label:'NFL', path:'football/nfl', ball:'football'},
  cfb:   {label:'College Football', path:'football/college-football', ball:'football'},
  nba:   {label:'NBA', path:'basketball/nba', ball:'basketball'},
  ncaam: {label:"College Basketball (Men's)", path:'basketball/mens-college-basketball', ball:'basketball'},
  ncaaw: {label:"College Basketball (Women's)", path:'basketball/womens-college-basketball', ball:'basketball'}
};
const BASE='https://site.api.espn.com/apis/site/v2/sports/';
async function getJson(sport,endpoint){
  if(!SPORTS[sport])throw new Error('Unsupported league');
  const res=await fetch(BASE+SPORTS[sport].path+endpoint,{signal:AbortSignal.timeout(12000),headers:{accept:'application/json','user-agent':'LiveStatPersonalPrototype/0.2'}});
  if(!res.ok)throw new Error(`${SPORTS[sport].label} feed returned HTTP ${res.status}`);
  return res.json();
}
function flattenRoster(groups){
  if(!Array.isArray(groups))return [];
  return groups.flatMap(g=>Array.isArray(g.items)?g.items:Array.isArray(g.athletes)?g.athletes:g.id?[g]:[]);
}
function normalizePlay(p,gameId){
  return {id:String(p.id||p.sequenceNumber||`${p.period?.number||'?'}:${p.clock?.displayValue||''}:${p.text||p.shortText||''}`),
    gameId:String(gameId),text:p.text||p.shortText||'',teamId:String(p.team?.id||''),
    period:p.period?.number||'?',clock:p.clock?.displayValue||'',participants:p.participants||p.athletes||[],
    rawType:p.type?.text||p.type?.abbreviation||'',scoringPlay:Boolean(p.scoringPlay),
    scoreValue:Number(p.scoreValue||0),timestamp:p.wallclock||null};
}
export function espnProviderFor(sport){
 if(!SPORTS[sport])throw new Error('Unknown sport');
 return {
  id:`espn-free-${sport}`, sport,
  async teams(){
    const params=sport==='cfb'||sport==='ncaam'||sport==='ncaaw'?'?limit=500':'?limit=50';
    const d=await getJson(sport,'/teams'+params);
    return (d.sports?.[0]?.leagues?.[0]?.teams||[]).map(x=>x.team||x)
      .filter(x=>x.id&&x.displayName).map(x=>({id:String(x.id),name:x.displayName,
        abbreviation:x.abbreviation||'',logo:x.logos?.[0]?.href||null})).sort((a,b)=>a.name.localeCompare(b.name));
  },
  async roster(teamId){
    if(!/^\d{1,8}$/.test(String(teamId)))throw new Error('Invalid team');
    const d=await getJson(sport,`/teams/${teamId}/roster`);
    return flattenRoster(d.athletes||[]).filter(p=>p.id&&p.displayName).map(p=>({id:String(p.id),
      name:p.displayName,shortName:p.shortName||p.displayName,
      position:p.position?.abbreviation||p.position?.displayName||'',headshot:p.headshot?.href||null,
      teamId:String(teamId)})).sort((a,b)=>a.name.localeCompare(b.name));
  },
  async games({date}={}){
    const params=sport==='cfb'?'?groups=90&limit=400':(sport==='ncaam'||sport==='ncaaw')?'?groups=50&limit=500':'';
    const dateParam=/^\d{8}$/.test(String(date||''))?`dates=${date}`:'';
    const d=await getJson(sport,'/scoreboard'+params+(dateParam?(params?'&':'?')+dateParam:''));
    return (d.events||[]).map(e=>{
      const c=e.competitions?.[0]||{};
      const teams=(c.competitors||[]).map(x=>({id:String(x.team?.id||x.id),abbr:x.team?.abbreviation||'',
        name:x.team?.displayName||'',score:x.score||'0',homeAway:x.homeAway}));
      const state=String(e.status?.type?.state||c.status?.type?.state||'pre').toLowerCase();
      return {id:String(e.id),sport,name:e.name,date:e.date,state,status:e.status?.type?.detail||'Scheduled',
        teams,live:state==='in'};
    });
  },
  async boxScore(gameId){
    if(!/^\\d{6,14}$/.test(String(gameId)))throw new Error('Invalid game');
    const summary=await getJson(sport,'/summary?event='+gameId);
    return normalizeBoxScore(sport,gameId,summary);
  },
  async plays(gameId){
    if(!/^\d{6,14}$/.test(String(gameId)))throw new Error('Invalid game');
    const d=await getJson(sport,`/summary?event=${gameId}`);
    const entries=SPORTS[sport].ball==='football'
      ? [...(d.drives?.previous||[]),...(d.drives?.current?[d.drives.current]:[])].flatMap(x=>x.plays||[])
      : Array.isArray(d.plays)?d.plays:[];
    const unique=new Map();for(const p of entries){const n=normalizePlay(p,gameId);unique.set(n.id,n)}
    return [...unique.values()];
  }
 };
}
export const espnProvider=espnProviderFor('nfl');
export const espnProviders=Object.fromEntries(Object.keys(SPORTS).map(s=>[s,espnProviderFor(s)]));
