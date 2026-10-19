// Career and form analytics on actually available ESPN games.
// Every numeric conclusion includes its observation window.
const number=x=>x==null||x===''?null:(Number.isFinite(Number(x))?Number(x):null);
const average=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:null;
const round=x=>x==null?null:Number(x.toFixed(2));
export function careerTimeline(seasons,metric){
  const key=String(metric||'').toUpperCase();
  const records=[];
  for(const season of Array.isArray(seasons)?seasons:[]){
    const games=(season?.history?.games||[]).filter(x=>number(x?.stats?.[key])!==null);
    if(!games.length)continue;
    const numbers=games.map(x=>number(x.stats[key]));
    records.push({season:Number(season.season),metric:key,games:numbers.length,
      average:round(average(numbers)),best:Math.max(...numbers),total:round(numbers.reduce((a,b)=>a+b,0)),
      source:'recorded ESPN game logs',partial:true});
  }
  return records.filter(x=>Number.isInteger(x.season)).sort((a,b)=>a.season-b.season);
}
export function formAnalysis(games,metric){
  const key=String(metric||'').toUpperCase();
  const rows=(Array.isArray(games)?games:[]).filter(g=>number(g?.stats?.[key])!==null)
    .map(g=>({value:number(g.stats[key]),id:g.id,date:g.date,opponent:g.opponent}));
  if(rows.length<2)return {available:false,metric:key,count:rows.length,observations:[],evidence:[]};
  const total=average(rows.map(x=>x.value)),count=rows.length;
  const latest=rows[0].value,peak=Math.max(...rows.map(x=>x.value)),low=Math.min(...rows.map(x=>x.value));
  const recent=rows.slice(0,Math.min(5,count)),prior=rows.slice(recent.length,recent.length*2);
  const current=average(recent.map(x=>x.value)),past=average(prior.map(x=>x.value));
  const variance=average(rows.map(x=>(x.value-total)**2)),std=Math.sqrt(variance);
  const observations=[],evidence=[];
  observations.push('Across '+count+' available games: '+round(total)+' '+key+' on average, with a recorded range of '+low+'–'+peak+'.');
  evidence.push({label:'Available game-log sample',value:count,source:'ESPN'});
  if(prior.length>=2){
    const delta=round(current-past);
    observations.push('Recent '+recent.length+' games: '+round(current)+' '+key+' per game, versus '+round(past)+' in the preceding '+prior.length+' games ('+(delta>=0?'+':'')+delta+').');
    evidence.push({label:'Recent-vs-prior sample',value:delta,source:'ESPN game log'});
  }else observations.push('Recent '+recent.length+' games average: '+round(current)+' '+key+' (insufficient preceding games for a trend comparison).');
  if(count>=5)observations.push('Game-to-game standard deviation: '+round(std)+' '+key+' across this available sample.');
  const currentStreak=rows.reduce((acc,p)=>{if(acc===null||p.value>=total)return (acc??0)+1;return Number.MAX_SAFE_INTEGER},null);
  const above=rows.filter(x=>x.value>total).length;
  observations.push(above+' of '+count+' available performances exceeded this sample average.');
  return {available:true,count,metric:key,average:round(total),latest,high:peak,low,stdev:round(std),
    recentMean:round(current),priorMean:round(past),observations,evidence,source:'ESPN available game-log sample'};
}
export function careerAnalysis(seasons,metric){
  const rows=careerTimeline(seasons,metric);
  if(!rows.length)return {available:false,summary:'No comparable recorded seasons were available.',seasons:[]};
  const best=rows.reduce((a,b)=>b.average>a.average?b:a);
  const newest=rows.at(-1),oldest=rows[0];
  const pieces=['Loaded '+rows.length+' season'+(rows.length===1?'':'s')+' with recorded '+String(metric).toUpperCase()+' data.'];
  pieces.push('Highest observed game-log average: '+best.average+' in '+best.season+' ('+best.games+' recorded games).');
  if(rows.length>=2)pieces.push('Latest loaded season '+newest.season+': '+newest.average+' versus '+oldest.average+' in '+oldest.season+'.');
  pieces.push('These comparisons are based on the games returned by ESPN and may not represent full seasons.');
  return {available:true,summary:pieces.join(' '),bestSeason:best.season,seasons:rows};
}
