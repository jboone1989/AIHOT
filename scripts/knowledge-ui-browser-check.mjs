import { chromium } from "@playwright/test";

const ROOT = "http://127.0.0.1:3000";
const scenarios = [
  {path:"/", heading:"看见事件", marker:"连接事实"},
  {path:"/knowledge", heading:"知识网络", marker:"关系探索工作台"},
  {path:"/knowledge/entity/64dd3fdd-1cd1-4787-ac79-16934fe2b7cf", heading:"Gemini 4 Argon", marker:"RELATION INDEX"},
  {path:"/story/75e9d3cc-a866-4369-a72a-109f42468a13", heading:"实体", marker:"GRAPH LAYER"}
];
let failed = false;
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
for (const width of [1440,390]) {
  const context = await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1});
  const page = await context.newPage();
  for (const item of scenarios) {
    try {
      const errors = [];
      page.on("pageerror",error=>errors.push(error.message));
      const response = await page.goto(ROOT+item.path,{waitUntil:"networkidle",timeout:30000});
      const result = await page.evaluate(() => ({
        htmlWidth:document.documentElement.scrollWidth,
        screenWidth:document.documentElement.clientWidth,
        content:document.body.innerText.slice(0,10000),
        title:document.title,
        links:[...document.querySelectorAll('a[href^="/knowledge"]')].length,
        graph:document.querySelectorAll(".lr-graph-canvas svg").length,
      }));
      const pass = response?.status()===200 && result.content.includes(item.marker) && result.htmlWidth<=result.screenWidth+8 && errors.length===0;
      if (!pass) failed=true;
      console.log(JSON.stringify({width,path:item.path,pass,status:response?.status(),title:result.title,hasMarker:result.content.includes(item.marker),scrollWidth:result.htmlWidth,screenWidth:result.screenWidth,graphCount:result.graph,knowledgeLinks:result.links,errors:errors.slice(0,3)}));
      if(item.path==="/"||item.path==="/knowledge") await page.screenshot({path:`/tmp/lr-${item.path==="/"?"home":"knowledge"}-${width}.png`,fullPage:true});
    } catch(e){failed=true;console.log(JSON.stringify({width,path:item.path,error:String(e)}));}
  }
  await context.close();
}
await browser.close();
if(failed) process.exitCode=1;
