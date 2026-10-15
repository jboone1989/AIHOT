import {chromium} from "@playwright/test";
const host="http://127.0.0.1:3000",han=/[\u3400-\u9fff]/u;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.addInitScript(()=>localStorage.setItem("livingruntime-language","en"));
const page=await context.newPage();
let failed=0;
async function scan(step){
 await page.waitForTimeout(280);
 const issues=await page.evaluate(()=>{
   const han=/[\u3400-\u9fff]/u;
   const visible=e=>{for(let p=e;p;p=p.parentElement){const style=getComputedStyle(p);if(style.display==="none"||style.visibility==="hidden"||p.getAttribute("aria-hidden")==="true")return false;}return e.getClientRects().length>0;};
   const seen=[];let node;const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
   while(node=walker.nextNode()){const text=node.textContent?.trim();if(!text||!han.test(text)||!visible(node.parentElement)||node.parentElement?.closest('[aria-label="Language / 语言"]'))continue;seen.push({type:"text",text:text.slice(0,140)});}
   for(const e of document.querySelectorAll("[aria-label],[title],[placeholder]")){if(!visible(e)||e.closest('[aria-label="Language / 语言"]'))continue;for(const a of ["aria-label","title","placeholder"]){const t=e.getAttribute(a);if(t&&han.test(t))seen.push({type:a,text:t.slice(0,140)});}}
   return [...new Map(seen.map(x=>[x.text,x])).values()];
 });
 console.log(JSON.stringify({step,count:issues.length,issues:issues.slice(0,28)}));if(issues.length)failed++;
}
async function open(path){await page.goto(host+path,{waitUntil:"domcontentloaded"});await page.waitForFunction(()=>document.documentElement.dataset.language==="en",{timeout:10000});}
await open("/");
await scan("mobile home");
const search=page.getByRole("button",{name:/^Search$/});
if(await search.count()){await search.first().click();await scan("search overlay");await page.keyboard.press("Escape");}
const filter=page.getByRole("button",{name:/^Filter$/});
if(await filter.count()){await filter.first().click();await scan("filter sheet");await page.keyboard.press("Escape");}
await open("/hot");
const faces=page.getByRole("button",{name:/participants · view sources/i});
if(await faces.count()){await faces.first().click();await scan("hot participants popup");await page.keyboard.press("Escape");}
const method=page.locator("#hot-method summary");
if(await method.count()){await method.click();await scan("hot methodology expanded");}
await context.close();await browser.close();
console.log(JSON.stringify({interactiveErrors:failed}));
if(failed)process.exitCode=1;
