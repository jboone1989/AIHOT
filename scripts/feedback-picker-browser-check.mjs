import { chromium } from "@playwright/test";
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1114,height:760},locale:"zh-CN"});
await context.addInitScript(()=>localStorage.setItem("livingruntime-language","en"));
const page=await context.newPage();
const response=await page.goto("http://127.0.0.1:3000/feedback",{waitUntil:"domcontentloaded",timeout:20000});
await page.waitForFunction(()=>document.documentElement.dataset.language==="en",{timeout:10000});
const button=page.getByRole("button",{name:"Choose screenshot"});
const initial={status:response?.status(),englishButton:await button.count(),noFileLabel:await page.getByText("No file selected",{exact:true}).count(),visibleChineseNative:await page.getByText("选择文件",{exact:false}).count()};
let selected=false,removed=false;
if(initial.englishButton){
 const chooser=page.waitForEvent("filechooser");
 await button.click();
 const f=await chooser;
 await f.setFiles({name:"test-image.png",mimeType:"image/png",buffer:Buffer.from("not-a-valid-image")});
 selected=await page.getByText("test-image.png",{exact:true}).count()>0;
 await page.getByRole("button",{name:"Remove selected screenshot"}).click();
 removed=await page.getByText("No file selected",{exact:true}).count()>0;
}
console.log(JSON.stringify({...initial,selected,removed}));
await browser.close();
if(initial.status!==200||!initial.englishButton||!initial.noFileLabel||initial.visibleChineseNative||!selected||!removed)process.exitCode=1;
