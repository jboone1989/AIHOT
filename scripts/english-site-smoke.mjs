/** Smoke the bilingual site's complete public navigation & original source data. */
const host=process.env.PREVIEW_URL??"http://127.0.0.1:3000";
const paths=["/","/all","/hot","/knowledge","/topics","/topics/openai","/daily","/weekly","/monthly","/daily/archive","/about","/changelog","/feedback","/starred","/agent","/privacy","/terms","/more","/admin/login","/search-busy"];
let failures=0;
for(const path of paths){
 try {
  const r=await fetch(host+path,{signal:AbortSignal.timeout(22000)});
  const body=await r.text();
  const ok=r.status===200&&body.includes("LivingRuntime");
  console.log(JSON.stringify({path,status:r.status,html:body.length,ok}));
  if(!ok)failures++;
 }catch(e){console.log(JSON.stringify({path,error:String(e)}));failures++;}
}
for(const kind of ["daily","weekly","monthly"]){
 const r=await fetch(host+"/api/site/reports/"+kind+"/latest-page",{signal:AbortSignal.timeout(22000)});
 const d=await r.json();
 const citations=d.report?[...d.report.highlights,...d.report.sections.flatMap(x=>x.items),...d.report.flashes]:[];
 const original=citations.filter(c=>c.originalTitle&&!/[\u3400-\u9fff]/u.test(c.originalTitle)).length;
 console.log(JSON.stringify({report:kind,status:r.status,issue:d.report?.key??null,sourceCount:citations.length,originalEnglishTitles:original}));
 if(!r.ok||citations.length&&original===0)failures++;
 if(d.report)paths.push("/"+kind+"/"+d.report.key);
}
const item=await(await fetch(host+"/api/site/timeline",{signal:AbortSignal.timeout(22000)})).json();
const id=item.cards?.[0]?.item?.id;
if(id){
 const r=await fetch(host+"/items/"+id+"/original",{signal:AbortSignal.timeout(22000)});
 console.log(JSON.stringify({path:"/items/"+id+"/original",status:r.status,ok:r.ok}));
 if(!r.ok)failures++;
}
if(failures)process.exitCode=1;
