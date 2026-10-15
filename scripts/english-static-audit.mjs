import fs from "node:fs";
import path from "node:path";

const base="apps/web/app";
const excluded=["/admin/","/admin-login.tsx","/routes/item.tsx","/routes/story.tsx","/routes/feedback.tsx","/routes/changelog.tsx","/routes/about.tsx","/routes/starred.tsx","/routes/topics.tsx","/routes/topic.tsx","/routes/report-","/routes/daily-archive.tsx","/features/report/","/features/item/","/features/story/","/features/changelog/","/features/agent/"];
const files=[];
const walk=(dir)=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith(".tsx")&&!excluded.some(x=>p.includes(x)))files.push(p);}};
walk(base);
const results=[];
for(const file of files){
 const code=fs.readFileSync(file,"utf8");const findings=[];
 for(const [i,line] of code.split("\n").entries()){
   if(!/[\u3400-\u9fff]/u.test(line))continue;
   const content=line.trim();
   if(content.startsWith("//")||content.startsWith("*")||content.startsWith("/*"))continue;
   const prop=/\b(?:aria-label|title|placeholder|alt|label|description)=["']([^"']*[\u3400-\u9fff][^"']*)["']/gu;
   for(const m of content.matchAll(prop))findings.push({line:i+1,kind:"attribute",text:m[0].slice(0,145)});
   const jsx=/>[^<>]*[\u3400-\u9fff][^<>]*</gu;
   for(const m of content.matchAll(jsx))findings.push({line:i+1,kind:"jsx-text",text:m[0].slice(0,145)});
 }
 if(findings.length)results.push({file,count:findings.length,findings:findings.slice(0,70)});
}
for(const r of results)console.log(JSON.stringify(r));
console.log(JSON.stringify({summary:{files:files.length,filesWithHan:results.length,total:results.reduce((n,r)=>n+r.count,0)}}));
