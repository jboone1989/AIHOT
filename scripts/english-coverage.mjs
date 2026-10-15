const base="http://127.0.0.1:3000";
const endpoints=["/api/site/hot","/api/site/timeline","/api/site/pool"];
for (const endpoint of endpoints) {
  const r=await fetch(base+endpoint,{signal:AbortSignal.timeout(25000)});
  const j=await r.json();
  const items=endpoint.includes("hot")?j.entries:endpoint.includes("timeline")?j.cards?.map(x=>x.item):j.items;
  const rows=Array.isArray(items)?items:[];
  const original=rows.filter(x=>Boolean(x.englishTitle||x.originalTitle)).length;
  const withHan=rows.filter(x=>/[\u3400-\u9fff]/u.test(String(x.englishTitle??x.originalTitle??""))).length;
  console.log(JSON.stringify({endpoint,status:r.status,total:rows.length,originalTitles:original,nonEnglishOriginals:withHan,sample:rows.slice(0,2).map(x=>({englishTitle:x.englishTitle,originalTitle:x.originalTitle}))}));
  if(!r.ok)process.exitCode=1;
}
