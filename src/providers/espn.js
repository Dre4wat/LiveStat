// Best-effort, UNOFFICIAL public ESPN endpoints. Never promise realtime accuracy.
// Multi-league normalization stays behind this interface; licensed feeds can replace it.
import {normalizeBoxScore} from './boxscore.js';
import {normalizeIntelligence} from './intelligence.js';
import {enrichRoster} from './roster-ranking.js';
import {normalizeGameLog,normalizeSeasonStats,normalizeESPNPlayerSearch} from './analytics.js';
import {normalizeAthleteIdentity} from './athlete-identity.js';
import {rosterSeasonSummary,rosterSeasonFromStats,mergeRosterStats} from './roster-browser.js';
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
export function flattenRoster(groups){
  const result=[],seen=new Set();
  function visit(value,depth=0){
    if(!value||depth>5)return;
    if(Array.isArray(value)){for(const v of value)visit(v,depth+1);return}
    if(typeof value!=='object')return;
    if(value.athlete&&typeof value.athlete==='object'){
      visit(value.athlete,depth+1);return;
    }
    const collections=['items','athletes','players','roster','positionGroups','groups','entries'];
    const hasChildren=collections.some(k=>Array.isArray(value[k])&&value[k].length);
    if(hasChildren){
      for(const key of collections)if(value[key])visit(value[key],depth+1);
      return;
    }
    const id=value.id||value.athleteId||value.uid?.split('~a:')?.[1];
    const name=value.displayName||value.fullName||value.name;
    if(/^\d{1,14}$/.test(String(id||''))&&name){
      if(!seen.has(String(id))){seen.add(String(id));result.push({...value,id:String(id),displayName:String(name)})}
    }
  }
  visit(groups);
  return result;
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
        abbreviation:x.abbreviation||'',logo:x.logos?.[0]?.href||null,
        color:x.color||'',alternateColor:x.alternateColor||''})).sort((a,b)=>a.name.localeCompare(b.name));
  },
  async roster(teamId,{gameId,season}={}){
    if(!/^[0-9]{1,8}$/.test(String(teamId)))throw new Error('Invalid team');
    if(gameId&&!/^[0-9]{6,14}$/.test(String(gameId)))throw new Error('Invalid game');
    if(season!=null&&(!Number.isInteger(Number(season))||Number(season)<1980||Number(season)>new Date().getUTCFullYear()+2))throw Error('Invalid roster season');
    // The ESPN roster endpoint usually represents the current roster.
    // ?season=YEAR can return an empty athlete array for NBA and college basketball.
    // Only season statistics are requested by year; do not imply a historical roster.
    const suffix='';
    // Roster is essential; all ranking sources are optional. Missing depth chart
    // or leaders must never prevent someone from selecting a player.
    const [rosterData,depthResult,leaderResult,gameResult]=await Promise.all([
      getJson(sport,`/teams/${teamId}/roster${suffix}`),
      getJson(sport,`/teams/${teamId}/depthcharts${suffix}`).catch(()=>null),
      getJson(sport,`/teams/${teamId}/leaders${suffix}`).catch(()=>null),
      gameId?getJson(sport,`/summary?event=${gameId}`).then(raw=>normalizeBoxScore(sport,gameId,raw)).catch(()=>null):Promise.resolve(null)
    ]);
    const players=flattenRoster(rosterData.athletes||rosterData.roster||rosterData.players||[]).filter(p=>p.id&&p.displayName).map(p=>({
      id:String(p.id),name:p.displayName,shortName:p.shortName||p.displayName,
      position:p.position?.abbreviation||p.position?.displayName||'',
      jersey:p.jersey||'',headshot:p.headshot?.href||null,teamId:String(teamId),
      age:Number.isFinite(Number(p.age))&&p.age!=null?Number(p.age):null,
      height:p.displayHeight||p.height||'',weight:p.displayWeight||p.weight||'',
      experience:p.experience?.displayValue??p.experience?.years??null,
      college:p.college?.name||p.college?.displayName|| (typeof p.college==='string'?p.college:'')||'',
      birthPlace:p.birthPlace?.city||'',status:p.status?.name||p.status?.type||''
    }));
    return enrichRoster(players,sport,{depthCharts:depthResult,leaders:leaderResult,boxScore:gameResult})
  },
  async rosterProfile(athleteId){
    if(!/^[0-9]{1,14}$/.test(String(athleteId)))throw Error('Invalid athlete');
    const prefix='https://site.web.api.espn.com/apis/common/v3/sports/'+SPORTS[sport].path+
      '/athletes/'+athleteId;
    const [root,bio]=await Promise.allSettled([
      getPublic(prefix),getPublic(prefix+'/bio')
    ]);
    if(root.status==='rejected'&&bio.status==='rejected')throw Error('ESPN athlete profile unavailable');
    const raw=root.status==='fulfilled'?root.value:{};
    const athlete=raw.athlete||raw.player||raw;
    const bioRaw=bio.status==='fulfilled'?bio.value:{};
    const b=bioRaw.athlete||bioRaw.player||bioRaw;
    const identity=normalizeAthleteIdentity({root:raw,sport,id:athleteId});
    const rawHeight=athlete.displayHeight||b.displayHeight||athlete.height||b.height;
    const rawWeight=athlete.displayWeight||b.displayWeight||athlete.weight||b.weight;
    const inches=Number(rawHeight);
    const height=typeof rawHeight==='number'||(/^\d{2,3}$/.test(String(rawHeight||''))&&inches>=48&&inches<96)
      ?Math.floor(inches/12)+"'"+inches%12+'"':String(rawHeight||'');
    const weight=typeof rawWeight==='number'?rawWeight+' lb':String(rawWeight||'');
    const birthDate=athlete.dateOfBirth||b.dateOfBirth||'';
    const dob=birthDate?new Date(birthDate):null;
    const now=new Date();
    const derivedAge=dob&&!Number.isNaN(dob.getTime())?now.getUTCFullYear()-dob.getUTCFullYear()-
      (now.getUTCMonth()<dob.getUTCMonth()||(now.getUTCMonth()===dob.getUTCMonth()&&now.getUTCDate()<dob.getUTCDate())?1:0):null;
    const age=athlete.age??b.age??derivedAge;
    const college=athlete.college||b.college||{};
    const place=athlete.birthPlace||b.birthPlace||{};
    const draft=athlete.draft||b.draft||{};
    return {...identity,
      age:age!=null&&Number.isFinite(Number(age))?Number(age):null,
      height,weight,
      college:typeof college==='string'?college:String(college.name||college.displayName||''),
      experience:athlete.experience?.displayValue??athlete.experience?.years??b.experience?.years??null,
      birthPlace:typeof place==='string'?place:[place.city,place.state].filter(Boolean).join(', '),
      birthDate:String(birthDate||''),
      draft:draft.displayText||draft.displayName||[draft.year,draft.round?('Rd '+draft.round):'',draft.selection?('Pick '+draft.selection):''].filter(Boolean).join(' · '),
      status:athlete.status?.name||athlete.status?.type||'',
      source:'ESPN athlete profile'
    };
  },
  async rosterStats(athleteId,season){
    if(!/^[0-9]{1,14}$/.test(String(athleteId)))throw Error('Invalid athlete');
    if(!Number.isInteger(Number(season))||Number(season)<1980||Number(season)>new Date().getUTCFullYear()+2)throw Error('Invalid season');
    const prefix='https://site.web.api.espn.com/apis/common/v3/sports/'+SPORTS[sport].path+
      '/athletes/'+athleteId+'/';
    // Season stats are cheaper and more complete than reconstructing seasons
    // from game logs, particularly for defense and special teams.
    // ESPN sometimes returns CAREER totals for /stats?season=YYYY, with no
    // "season" filter in the JSON (confirmed by a live ESPN diagnostic).
    // Accept season aggregate ONLY when the payload itself verifies the year.
    const stats=await getPublic(prefix+'stats?season='+season).catch(()=>null);
    const seasonFilter=stats?.filters?.find(x=>String(x?.name||'').toLowerCase()==='season');
    const seasonMatches=seasonFilter&&String(seasonFilter.value)===String(season);
    const aggregates=rosterSeasonFromStats(sport,seasonMatches?stats:null);
    const log=await getPublic(prefix+'gamelog?season='+season).catch(()=>null);
    const logSeason=log?.filters?.find(x=>String(x?.name||'').toLowerCase()==='season');
    const validLog=log&&(!logSeason||String(logSeason.value)===String(season));
    const history=validLog?normalizeGameLog(log,season,{regularSeasonOnly:true}):{games:[]};
    const data=rosterSeasonSummary(sport,history.games);
    const merged=mergeRosterStats(sport,aggregates,data);
    return {...merged,season,source:merged.source,failed:!aggregates.availableFields&&!history.games.length,
      note:seasonMatches?merged.note:('Season aggregates were not verified; '+data.games+' ESPN regular-season game logs available')};
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
  async analyticsPlayer(athleteId,season){
    if(!/^[0-9]{1,14}$/.test(String(athleteId)))throw Error('Invalid athlete ID');
    if(!Number.isInteger(Number(season))||Number(season)<1980||Number(season)>new Date().getUTCFullYear()+2)throw Error('Invalid season');
    const prefix='https://site.web.api.espn.com/apis/common/v3/sports/'+SPORTS[sport].path+'/athletes/'+athleteId+'/';
    const [log,stats,overview,identity]=await Promise.allSettled([
      getPublic(prefix+'gamelog?season='+season),
      getPublic(prefix+'stats?season='+season),
      getPublic(prefix+'overview'),
      // Athlete ROOT is the identity endpoint. /overview usually contains
      // statistics, not guaranteed player name, team or headshot.
      getPublic(prefix.slice(0,-1))
    ]);
    const history=normalizeGameLog(log.status==='fulfilled'?log.value:null,season);
    const statsData=stats.status==='fulfilled'?stats.value:{};
    const overviewData=overview.status==='fulfilled'?overview.value:{};
    const identityData=identity.status==='fulfilled'?identity.value:{};
    const seasonStats=normalizeSeasonStats(statsData,season);
    const player=normalizeAthleteIdentity({
      root:identityData,overview:overviewData,stats:statsData,sport,id:athleteId
    });
    return {
      sport,athleteId:String(athleteId),season:Number(season),player,
      history,seasonStats,
      unavailable:log.status==='rejected'&&stats.status==='rejected',
      feedWarnings:[...(log.status==='rejected'?['Game log unavailable']:[]),
        ...(stats.status==='rejected'?['Season aggregates unavailable']:[]),
        ...(identity.status==='rejected'?['Player identity feed unavailable; using available roster or ESPN photo fallback']:[])]
    };
  },
  async searchAthletes(query){
    if(typeof query!=='string'||query.trim().length<2||query.trim().length>70)throw Error('Search needs 2–70 characters');
    const data=await getPublic('https://site.web.api.espn.com/apis/search/v2?query='+encodeURIComponent(query)+'&sport='+encodeURIComponent(sport)+'&limit=50');
    return normalizeESPNPlayerSearch(data,query,sport);
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
