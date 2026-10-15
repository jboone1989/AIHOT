import {chromium} from "@playwright/test";
const host=process.env.PREVIEW_URL??"http://127.0.0.1:3000";
const paths=["/","/all","/hot","/knowledge","/topics","/topics/openai","/daily","/daily/archive","/weekly","/monthly","/about","/changelog","/feedback","/starred","/agent","/privacy","/terms","/more","/search-busy","/admin/login","/all?q=bitcoin"];
const sample=await fetch(host+"/api/site/timeline").then(r=>r.json()).catch(()=>null);
if(sample?.cards?.[0]?.item?.id)paths.push("/items/"+sample.cards[0].item.id,"/items/"+sample.cards[0].item.id+"/original");
const hot=await fetch(host+"/api/site/hot").then(r=>r.json()).catch(()=>null);
if(hot?.entries?.[0]?.story?.publicId)paths.push("/story/"+hot.entries[0].story.publicId);
const daily=await fetch(host+"/api/site/reports/daily/latest-page").then(r=>r.json()).catch(()=>null);
if(daily?.report?.key)paths.push("/daily/"+daily.report.key);
const graph=await fetch(host+"/api/site/knowledge/overview").then(r=>r.json()).catch(()=>null);
if(graph?.edges?.[0]?.subject?.key)paths.push("/knowledge/entity/"+encodeURIComponent(graph.edges[0].subject.key));
const browser=await chromium.launch({headless:true});
let count=0, broken=0;
for(const viewport of [{width:1365,height:860},{width:390,height:844}]){
 const context=await browser.newContext({viewport});
 await context.addInitScript(()=>{localStorage.setItem("livingruntime-language","en");});
 const page=await context.newPage();
 let errors=[];
 page.on("pageerror",error=>errors.push(String(error)));
 for(const path of paths){
  try{
   errors=[];
   const response=await page.goto(host+path,{waitUntil:"domcontentloaded",timeout:25000});
   await page.waitForFunction(()=>document.documentElement.dataset.language==="en",{timeout:10000});
   await page.waitForTimeout(450);
   if(path==="/hot"){const method=page.locator("#hot-method");if(await method.count())await method.evaluate(el=>el.open=true);}
   const found=await page.evaluate(()=>{
    const hasHan=text=>/[\u3400-\u9fff]/u.test(text);
    const visible=el=>{
      for(let p=el;p&&p.nodeType===Node.ELEMENT_NODE;p=p.parentElement){
        const cs=getComputedStyle(p);
        if(cs.display==="none"||cs.visibility==="hidden"||cs.opacity==="0"||p.getAttribute("aria-hidden")==="true"||p.hasAttribute("inert"))return false;
      }
      return !!el.getClientRects().length;
    };
    const issues=[];
    if(hasHan(document.title))issues.push({type:"document.title",text:document.title});
    const description=document.querySelector('meta[name="description"]')?.getAttribute("content")??"";
    if(hasHan(description))issues.push({type:"meta.description",text:description.slice(0,140)});
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let node;
    while(node=walker.nextNode()){
      const value=node.textContent?.trim()??"";
      if(!hasHan(value)||!visible(node.parentElement))continue;
      if(node.parentElement?.closest("[role=group][aria-label='Language / 语言']"))continue;
      issues.push({type:"text",tag:node.parentElement?.tagName,selector:node.parentElement?.getAttribute("class")?.slice(0,70)??"",text:value.slice(0,130)});
    }
    for(const el of document.querySelectorAll("[aria-label],[title],[placeholder],[alt]")){
      if(!visible(el))continue;
      for(const attr of ["aria-label","title","placeholder","alt"]){
       const value=el.getAttribute(attr);
       if(!value||!hasHan(value))continue;
       if(el.closest("[role=group][aria-label='Language / 语言']"))continue;
       issues.push({type:attr,tag:el.tagName,text:value.slice(0,130)});
      }
    }
    return issues;
   });
   const dedup=[...new Map(found.map(x=>[x.type+"|"+x.text,x])).values()];
   if(dedup.length||!response?.ok()||errors.length){
    broken++;console.log(JSON.stringify({path,viewport:viewport.width,status:response?.status(),issues:dedup.slice(0,75),total:dedup.length,jsErrors:errors.slice(0,3)}));
   }else console.log(JSON.stringify({path,viewport:viewport.width,status:response?.status(),issues:0}));
   count+=dedup.length;
  }catch(e){broken++;console.log(JSON.stringify({path,viewport:viewport.width,error:String(e)}));}
 }
 await context.close();
}
await browser.close();
console.log(JSON.stringify({summary:{checked:paths.length*2,offendingStrings:count,affectedScreens:broken}}));
if(broken)process.exitCode=1;
