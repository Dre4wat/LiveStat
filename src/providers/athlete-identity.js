// Normalizes ESPN athlete identity independently of statistical overview data.
const text=x=>typeof x==='string'?x.trim():'';
const object=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const color=x=>/^#?[a-f0-9]{6}$/i.test(String(x||''))?String(x).replace('#',''):'';
const SPORT_HEADSHOT={nfl:'nfl',cfb:'college-football',nba:'nba',ncaam:'mens-college-basketball',ncaaw:'womens-college-basketball'};
const espnHeadshot=(sport,id)=>SPORT_HEADSHOT[sport]&&/^[0-9]{1,14}$/.test(String(id))
  ?'https://a.espncdn.com/i/headshots/'+SPORT_HEADSHOT[sport]+'/players/full/'+id+'.png':'';
export function normalizeAthleteIdentity({root=null,overview=null,stats=null,sport,id,fallback=null}={}){
  const rp=object(root),op=object(overview),sp=object(stats),fb=object(fallback);
  const athlete=object(rp.athlete||rp.player||op.athlete||op.player);
  const fallbackAthlete=object(fb.athlete);
  const team=object(athlete.team||rp.team||sp.teams?.[0]||op.team||fb.team);
  const playerName=text(athlete.displayName)||text(athlete.fullName)||
     [text(athlete.firstName),text(athlete.lastName)].filter(Boolean).join(' ')||
     text(fallbackAthlete.displayName)||text(fb.name)||'';
  const headshotRaw=athlete.headshot||rp.headshot||op.headshot||fb.headshot;
  const headshotValue=text(headshotRaw)||text(headshotRaw?.href)||text(headshotRaw?.url);
  const verifiedHeadshot=/^https:\/\/(?:a|a1|a2)\.espncdn\.com\/i\/headshots\//i.test(headshotValue)?headshotValue:'';
  // ESPN standard CDN path is a *candidate*, not a claim that an image exists.
  // A 404 is handled by the client and explicitly shown as photo unavailable.
  const headshot=verifiedHeadshot||espnHeadshot(sport,id);
  const position=object(athlete.position);
  return {
    id:String(id||athlete.id||''),
    name:playerName,
    team:text(team.displayName)||text(team.name)||text(fb.teamName),
    teamId:String(team.id||fb.teamId||''),
    teamAbbr:text(team.abbreviation)||text(team.shortDisplayName)||text(fb.teamAbbr),
    position:text(position.abbreviation)||text(position.displayName)||text(athlete.position)||text(fb.position),
    jersey:text(athlete.jersey)||text(fb.jersey),
    headshot,
    headshotSource:verifiedHeadshot?'espn-profile':headshot?'espn-cdn-candidate':'unavailable',
    teamColor:color(team.color||athlete.teamColor||fb.teamColor),
    alternateColor:color(team.alternateColor||fb.alternateColor)
  };
}
