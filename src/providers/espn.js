// Best-effort, UNOFFICIAL public ESPN endpoints. Never promise realtime accuracy.
// Multi-league normalization stays behind this interface; licensed feeds can replace it.
import {normalizeBoxScore} from './boxscore.js';
import {normalizeIntelligence} from './intelligence.js';
import {enrichRoster} from './roster-ranking.js';
export const SPORTS = {
  nfl:   {label:'NFL', path:'football/nfl', ball:'football'},
  cfb:   {label:'College Football', path:'football/college-football', ball:'football'},
  nba:   {label:'NBA', path:'basketball/nba', ball:'basketball'},
  ncaam: {label:"College Basketball (Men's)", path:'basketball/mens-college-basketball', ball:'basketball'},
  ncaaw: {label:"College Basketball (Women's)", path:'basketball/womens-college-basketball', ball:'basketball'}
};
const BASE='https://site.api.espn.com/apis/site/v2/sports/';
async function getPublic(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(11000),headers:{accept:'application/json'}});
 if(!r.ok)throw new Error('Data provider returned '+r.status);
 return r.json();
}

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
    scoreValue:Number(p.scoreValue||0),driveId:String(p._driveId||''),homeScore:p.homeScore==null?null:Number(p.homeScore),awayScore:p.awayScore==null?null:Number(p.awayScore),timestamp:p.wallclock||null};
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
  async roster(teamId,{gameId}={}){
    if(!/^[0-9]{1,8}$/.test(String(teamId)))throw new Error('Invalid team');
    if(gameId&&!/^[0-9]{6,14}$/.test(String(gameId)))throw new Error('Invalid game');
    // Roster is essential; all ranking sources are optional. Missing depth chart
    // or leaders must never prevent someone from selecting a player.
    const [rosterData,depthResult,leaderResult,gameResult]=await Promise.all([
      getJson(sport,`/teams/${teamId}/roster`),
      getJson(sport,`/teams/${teamId}/depthcharts`).catch(()=>null),
      getJson(sport,`/teams/${teamId}/leaders`).catch(()=>null),
      gameId?getJson(sport,`/summary?event=${gameId}`).then(raw=>normalizeBoxScore(sport,gameId,raw)).catch(()=>null):Promise.resolve(null)
    ]);
    const players=flattenRoster(rosterData.athletes||[]).filter(p=>p.id&&p.displayName).map(p=>({
      id:String(p.id),name:p.displayName,shortName:p.shortName||p.displayName,
      position:p.position?.abbreviation||p.position?.displayName||'',
      jersey:p.jersey||'',headshot:p.headshot?.href||null,teamId:String(teamId)
    }));
    return enrichRoster(players,sport,{depthCharts:depthResult,leaders:leaderResult,boxScore:gameResult})
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
  async intelligence(gameId){
    if(!/^[0-9]{6,14}$/.test(String(gameId)))throw new Error('Invalid game');
    const d=await getJson(sport,'/summary?event='+gameId);
    return normalizeIntelligence(sport,gameId,d);
  },
  async playerProfile(athleteId){
    if(!/^[0-9]{1,14}$/.test(String(athleteId)))throw new Error('Invalid athlete');
    const prefix='https://site.web.api.espn.com/apis/common/v3/sports/'+SPORTS[sport].path+'/athletes/'+athleteId+'/';
    const requests=await Promise.allSettled(['overview','stats','gamelog'].map(x=>getPublic(prefix+x)));
    const obj=Object.fromEntries(['overview','stats','gamelog'].map((k,i)=>[k,requests[i].status==='fulfilled'?requests[i].value:null]));
    return {sport,athleteId,...obj,unavailable:requests.every(x=>x.status==='rejected')};
  },
  async standings(){
    const d=await getPublic('https://site.api.espn.com/apis/v2/sports/'+SPORTS[sport].path+'/standings');
    return {sport,data:d};
  },
  async injuries(){
    const d=await getJson(sport,'/injuries');
    return {sport,data:d};
  },
  async boxScore(gameId){
    if(!/^[0-9]{6,14}$/.test(String(gameId)))throw new Error('Invalid game');
    const summary=await getJson(sport,'/summary?event='+gameId);
    return normalizeBoxScore(sport,gameId,summary);
  },
  async plays(gameId){
    if(!/^\d{6,14}$/.test(String(gameId)))throw new Error('Invalid game');
    const d=await getJson(sport,`/summary?event=${gameId}`);
    const entries=SPORTS[sport].ball==='football'
      ? [...(d.drives?.previous||[]),...(d.drives?.current?[d.drives.current]:[])].flatMap((drive,i)=>(drive.plays||[]).map(p=>({...p,_driveId:String(drive.id||'drive-'+i)})))
      : Array.isArray(d.plays)?d.plays:[];
    const unique=new Map();for(const p of entries){const n=normalizePlay(p,gameId);unique.set(n.id,n)}
    return [...unique.values()];
  }
 };
}
export const espnProvider=espnProviderFor('nfl');
export const espnProviders=Object.fromEntries(Object.keys(SPORTS).map(s=>[s,espnProviderFor(s)]));
