// Player-season archive. PostgreSQL (DATABASE_URL) is durable; disk fallback
// is durable only when LIVESTAT_DATA_DIR points to a persistent volume.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const diskRoot=()=>path.resolve(process.env.LIVESTAT_DATA_DIR||'data','analytics');
const validSport=x=>['nba','nfl','cfb','ncaam','ncaaw'].includes(x);
export function archiveKey(sport,id,season){
  if(!validSport(sport)||!/^\d{1,14}$/.test(String(id))||!Number.isInteger(Number(season))||
     Number(season)<1980||Number(season)>new Date().getUTCFullYear()+2)throw Error('Invalid archive identifier');
  return sport+':'+id+':'+season;
}
let dbPromise;
async function database(){
  if(!process.env.DATABASE_URL)return null;
  if(!dbPromise)dbPromise=(async()=>{
    const {Pool}=await import('pg');
    const pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5500,
      max:3,idleTimeoutMillis:15000,
      ssl:process.env.PGSSL_DISABLE==='true'?false:{rejectUnauthorized:process.env.PGSSL_REJECT_UNAUTHORIZED!=='false'}});
    await pool.query('CREATE TABLE IF NOT EXISTS livestat_player_seasons (cache_key text PRIMARY KEY, sport text NOT NULL, athlete_id text NOT NULL, season integer NOT NULL, payload jsonb NOT NULL, saved_at timestamptz NOT NULL DEFAULT now())');
    return pool;
  })().catch(e=>{dbPromise=null;throw e});
  return dbPromise;
}
function diskFile(key){return path.join(diskRoot(),crypto.createHash('sha256').update(key).digest('hex')+'.json')}
export function archiveMode(){
  return process.env.DATABASE_URL?'postgresql':process.env.LIVESTAT_DATA_DIR?'configured-disk':'ephemeral-disk';
}
async function saveLocal(key,record){
  const file=diskFile(key);await fs.mkdir(path.dirname(file),{recursive:true});
  const tmp=file+'.'+crypto.randomUUID()+'.tmp';
  await fs.writeFile(tmp,JSON.stringify(record),'utf8');await fs.rename(tmp,file);
}
async function loadLocal(key){
  try{return JSON.parse(await fs.readFile(diskFile(key),'utf8'))}catch(e){if(e?.code==='ENOENT')return null;throw e}
}
export async function savePlayerSeason(sport,athleteId,season,payload){
  const cacheKey=archiveKey(sport,athleteId,season),record={data:payload,savedAt:new Date().toISOString(),source:'espn'};
  if(process.env.DATABASE_URL){
    const db=await database();
    await db.query('INSERT INTO livestat_player_seasons(cache_key,sport,athlete_id,season,payload,saved_at) VALUES ($1,$2,$3,$4,$5::jsonb,now()) ON CONFLICT (cache_key) DO UPDATE SET payload=excluded.payload,saved_at=now()',
      [cacheKey,sport,String(athleteId),Number(season),JSON.stringify(record)]);
  }else await saveLocal(cacheKey,record);
  return record;
}
export async function loadPlayerSeason(sport,athleteId,season){
  const cacheKey=archiveKey(sport,athleteId,season);
  if(process.env.DATABASE_URL){
    const db=await database();
    const rows=await db.query('SELECT payload FROM livestat_player_seasons WHERE cache_key=$1',[cacheKey]);
    return rows.rows[0]?.payload||null;
  }
  return loadLocal(cacheKey);
}
export async function listArchivedSeasons(sport,athleteId){
  archiveKey(sport,athleteId,2020);
  if(process.env.DATABASE_URL){
    const db=await database();
    const rows=await db.query('SELECT season,saved_at FROM livestat_player_seasons WHERE sport=$1 AND athlete_id=$2 ORDER BY season DESC LIMIT 80',[sport,String(athleteId)]);
    return rows.rows.map(x=>({season:x.season,savedAt:x.saved_at}));
  }
  try{
    const file=path.join(diskRoot(),crypto.createHash('sha256').update(sport+':'+athleteId).digest('hex')+'.index.json');
    return JSON.parse(await fs.readFile(file,'utf8'));
  }catch(e){if(e?.code==='ENOENT')return [];throw e}
}
export async function recordArchiveIndex(sport,athleteId,season){
  archiveKey(sport,athleteId,season);
  if(process.env.DATABASE_URL)return;
  const file=path.join(diskRoot(),crypto.createHash('sha256').update(sport+':'+athleteId).digest('hex')+'.index.json');
  await fs.mkdir(path.dirname(file),{recursive:true});
  let entries=[];try{entries=JSON.parse(await fs.readFile(file,'utf8'))}catch{}
  entries=[...entries.filter(x=>x.season!==Number(season)),{season:Number(season),savedAt:new Date().toISOString()}]
    .sort((a,b)=>b.season-a.season).slice(0,80);
  const tmp=file+'.'+crypto.randomUUID()+'.tmp';
  await fs.writeFile(tmp,JSON.stringify(entries));await fs.rename(tmp,file);
}
export async function fetchOrArchivePlayer(sport,athleteId,season,fetchLive,{refresh=false}={}){
  archiveKey(sport,athleteId,season);
  const stored=await loadPlayerSeason(sport,athleteId,season).catch(()=>null);
  const saved=stored?.data;
  const sufficient=Boolean(saved?.history?.games?.length||saved?.seasonStats?.categories?.length);
  if(!refresh&&sufficient&&Boolean(String(saved?.player?.name||'').trim())&&(Number(season)<new Date().getUTCFullYear()-1)){
    return {...saved,archive:{mode:archiveMode(),source:'saved',savedAt:stored.savedAt}};
  }
  try{
    const live=await fetchLive();
    const hasData=Boolean(live?.history?.games?.length||live?.seasonStats?.categories?.length);
    if(!hasData&&sufficient)return {...saved,archive:{mode:archiveMode(),source:'saved-fallback',savedAt:stored.savedAt}};
    if(hasData){
      try{await savePlayerSeason(sport,athleteId,season,live);await recordArchiveIndex(sport,athleteId,season);}
      catch(e){return {...live,archive:{mode:'unavailable',source:'live',warning:'Archive save failed: '+e.message}}}
    }
    return {...live,archive:{mode:archiveMode(),source:'live',savedAt:hasData?new Date().toISOString():null}};
  }catch(e){
    if(sufficient)return {...saved,archive:{mode:archiveMode(),source:'saved-fallback',savedAt:stored.savedAt,warning:'ESPN unavailable; showing cached archive'}};
    throw e;
  }
}
