/** Safe language-switch API smoke: original and Chinese share the same item id. */
const host="http://127.0.0.1:3000";
const paths=["/","/knowledge","/hot","/more"];
let fail=0;
for(const p of paths){
 const r=await fetch(host+p,{signal:AbortSignal.timeout(12000)});
 const html=await r.text();
 const hasLanguage=r.ok&&html.includes("Language / 语言")&&html.includes("aria-pressed");
 console.log(JSON.stringify({path:p,status:r.status,hasLanguage}));
 if(!hasLanguage)fail++;
}
const feed=await(await fetch(host+"/api/site/timeline")).json();
const items=(feed.cards||[]).map(c=>c.item);
let candidate=items.find(i=>i.originalTitle&&i.links?.original)||items[0];
if(candidate){
 const id=encodeURIComponent(candidate.id);
 const pair=await Promise.all(["/api/site/items/"+id,"/api/site/items/"+id+"/original"].map(u=>fetch(host+u)));
 const data=await Promise.all(pair.map(r=>r.json()));
 const good=pair.every(r=>r.ok)&&data.every(x=>x.id===candidate.id);
 console.log(JSON.stringify({article:candidate.id,chineseStatus:pair[0].status,originalStatus:pair[1].status,hasOriginalTitle:!!data[1]?.originalTitle,bodyLanguage:data[1]?.bodyLanguage,ok:good}));
 if(!good)fail++;
}
if(fail)process.exitCode=1;
