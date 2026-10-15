const host = "http://127.0.0.1:3000";
const paths = [
 ["/", ["看见事件", "连接事实", "KNOWLEDGE MEMORY"]],
 ["/knowledge", ["让信息形成", "关系探索工作台", "KNOWLEDGE MAP"]],
 ["/knowledge/entity/64dd3fdd-1cd1-4787-ac79-16934fe2b7cf", ["Gemini", "实体档案"]],
 ["/story/75e9d3cc-a866-4369-a72a-109f42468a13", ["从事件走进知识网络", "RELATION INDEX"]],
 ["/hot", ["EVENT LAYER", "热点会变"]],
];
let failures = 0;
for (const [path, expected] of paths) {
 try {
  const response=await fetch(host+path,{signal:AbortSignal.timeout(14000)});
  const html=await response.text();
  const missing=expected.filter(label=>!html.includes(label));
  const valid=response.status===200&&missing.length===0;
  if(!valid)failures++;
  console.log(JSON.stringify({path,code:response.status,valid,missing,bytes:html.length}));
 } catch (error) {failures++;console.log(JSON.stringify({path,error:String(error)}));}
}
const entityDetail=await (await fetch(host+"/api/site/knowledge/entities/64dd3fdd-1cd1-4787-ac79-16934fe2b7cf")).json();console.log(JSON.stringify({api:"entity",entity:entityDetail.entity,edges:entityDetail.edges?.length,status:entityDetail.status}));
const stats=await (await fetch(host+"/api/site/knowledge/stats")).json();
const overviewResponse=await fetch(host+"/api/site/knowledge/overview");
const overview=await overviewResponse.json();
console.log(JSON.stringify({api:"knowledge overview",status:overviewResponse.status,stats,entities:overview.entities,relation_count:overview.edges?.length,sample:overview.edges?.[0]?.fact}));
if(overviewResponse.status!==200||!Array.isArray(overview.edges)) failures++;
if(failures)process.exitCode=1;
