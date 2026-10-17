import {useEffect,useMemo,useState} from "react";
import type {AdminProviderProfile} from "@aihot/contracts/admin";
import {useAdminAction} from "./action";
import {Card} from "./ui";

/** One compact mobile-friendly editor; no per-model cards or repeated controls. */
export function ModelProvidersAdmin({providers}:{providers:AdminProviderProfile[]}){
 const {run,busy}=useAdminAction();
 const [search,setSearch]=useState("");
 const [selected,setSelected]=useState(providers[0]?.modelId??"");
 const [adapter,setAdapter]=useState("unconfigured");
 const [endpoint,setEndpoint]=useState("");
 const [capabilities,setCapabilities]=useState("");
 const [defaults,setDefaults]=useState("{}");
 const [timeout,setTimeout]=useState(60);
 const [complexity,setComplexity]=useState("medium");
 const [enabled,setEnabled]=useState(false);
 const [routeEnabled,setRouteEnabled]=useState(false);
 const [stream,setStream]=useState(false);
 const [reason,setReason]=useState("");
 const [newId,setNewId]=useState("");
 const [probeCap,setProbeCap]=useState("text");
 const [editorError,setEditorError]=useState("");
 const current=providers.find(p=>p.modelId===selected)??providers[0];
 const filtered=useMemo(()=>providers.filter(p=>p.modelId.toLowerCase().includes(search.toLowerCase())||
 p.capabilities.some(c=>c.includes(search.toLowerCase()))),[providers,search]);
 useEffect(()=>{
  if(!current)return;
  setAdapter(current.adapter);setEndpoint(current.endpoint??"");
  setCapabilities(current.capabilities.join(", "));setDefaults(JSON.stringify(current.requestDefaults,null,2));
  setTimeout(current.timeoutMs/1000);setComplexity(current.complexity);setEnabled(current.enabled);
  setRouteEnabled(current.routeEnabled);setStream(current.stream);setReason("");setEditorError("");
  setProbeCap(current.capabilities.includes("text")?"text":current.capabilities[0]??"text");
 },[current?.vendor,current?.modelId,current?.version]);
 async function save(){
  if(!current)return;
  let parsed:Record<string,unknown>;
  try{
   parsed=JSON.parse(defaults);
   if(!parsed||Array.isArray(parsed)||typeof parsed!=="object")throw Error("defaults must be an object");
   if(!reason.trim())throw Error("请填写修改原因");
  }catch(e){setEditorError(e instanceof Error?e.message:String(e));return;}
  setEditorError("");
  await run("PATCH","/api/admin/model-providers",{
    vendor:current.vendor,modelId:current.modelId,version:current.version,reason,
    changes:{adapter,endpoint:endpoint.trim()||null,capabilities:capabilities.split(",").map(x=>x.trim()).filter(Boolean),
      requestDefaults:parsed,timeoutMs:Math.round(timeout*1000),complexity,stream,enabled,routeEnabled},
  },{label:"provider:"+current.modelId,success:"Provider 配置已保存"});
 }
 const label=(name:string,child:React.ReactNode)=><label className="block space-y-1 text-xs text-ink-3"><span>{name}</span>{child}</label>;
 const inputClass="w-full min-w-0 rounded-md border border-line bg-layer-1 px-2 py-2 text-sm text-ink-1";
 const check=(name:string,checked:boolean,set:(x:boolean)=>void)=><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e=>set(e.target.checked)}/>{name}</label>;
 return <Card title="独立 Provider 配置（数据库）">
  <p className="text-sm text-ink-3">每个模型独立保存端点、适配器、参数、超时与能力。密钥仅引用服务器环境变量，不在数据库或浏览器显示。默认禁用生产路由。</p>
  <div className="grid gap-3 md:grid-cols-2">
   {label("按名称或能力筛选",<input className={inputClass} value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索 81 个 Provider"/>)}
   {label("选择 Provider",<select className={inputClass} value={selected} onChange={e=>setSelected(e.target.value)}>
    {current&&!filtered.some(x=>x.modelId===current.modelId)&&<option value={current.modelId}>{current.modelId}</option>}
    {filtered.map(p=><option key={p.vendor+":"+p.modelId} value={p.modelId}>{p.modelId}</option>)}
   </select>)}
  </div>
  {current&&<div className="space-y-3 pt-3">
   <div className="flex flex-wrap gap-2 text-xs text-ink-3">
    <span>版本 {current.version}</span><span>身份引用 {current.credentialEnv}</span>
    <span>能力记录 {current.checks.length}</span>
    {current.documentationUrl&&<a className="text-accent underline" href={current.documentationUrl} target="_blank" rel="noopener noreferrer">官方文档</a>}
   </div>
   <div className="grid gap-3 md:grid-cols-2">
    {label("请求适配器",<select className={inputClass} value={adapter} onChange={e=>setAdapter(e.target.value)}>
     {["chat","embedding","document","safety","special","unconfigured"].map(v=><option key={v} value={v}>{v}</option>)}
    </select>)}
    {label("任务复杂度",<select className={inputClass} value={complexity} onChange={e=>setComplexity(e.target.value)}>
     {["light","medium","heavy"].map(v=><option key={v} value={v}>{v}</option>)}
    </select>)}
   </div>
   {label("API Endpoint (HTTPS NVIDIA)",<input className={inputClass} value={endpoint} onChange={e=>setEndpoint(e.target.value)} placeholder="https://integrate.api.nvidia.com/v1/chat/completions"/>)}
   <div className="grid gap-3 md:grid-cols-2">
    {label("能力（逗号分隔）",<input className={inputClass} value={capabilities} onChange={e=>setCapabilities(e.target.value)}/>)}
    {label("完整请求超时（秒）",<input className={inputClass} type="number" min={1} max={600} value={timeout} onChange={e=>setTimeout(Number(e.target.value))}/>)}
   </div>
   {label("模型独有请求参数（JSON）",<textarea rows={3} className={inputClass+" font-mono"} value={defaults} onChange={e=>setDefaults(e.target.value)}/>)}
   <div className="flex flex-wrap gap-5">
    {check("已配置并启用",enabled,setEnabled)}
    {check("流式响应",stream,setStream)}
    {check("允许自动路由（需要已验证能力）",routeEnabled,setRouteEnabled)}
   </div>
   {!!current.checks.length&&<p className="text-xs text-ink-3">验证：{current.checks.map(c=>c.capability+"="+c.status).join(" · ")}</p>}
   {label("修改原因（审计必填）",<input className={inputClass} value={reason} onChange={e=>setReason(e.target.value)}/>)}
   <div className="flex flex-wrap items-end gap-2">
    {label("独立能力探测",<select className={inputClass} value={probeCap} onChange={e=>setProbeCap(e.target.value)}>
     {current.capabilities.map(cap=><option key={cap} value={cap}>{cap}</option>)}
    </select>)}
    <button className="rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={busy||!current.enabled||!current.capabilities.includes(probeCap)}
      onClick={()=>run("POST","/api/admin/model-providers/probe",{vendor:current.vendor,modelId:current.modelId,capability:probeCap},{label:"probe:"+current.modelId+":"+probeCap,success:"能力探测已完成"})}>验证此能力</button>
    <span className="text-xs text-ink-3">每次真实调用消耗 API 配额；专用能力需模型级适配器</span>
   </div>
   {editorError&&<p role="alert" className="text-sm text-hot">{editorError}</p>
   <button className="rounded-md bg-ink-1 px-4 py-2 text-sm text-layer-1 disabled:opacity-50" disabled={busy} onClick={save}>保存 Provider</button>
  </div>}
  <details className="pt-2">
   <summary className="cursor-pointer text-sm text-accent">添加新 Provider（默认禁用）</summary>
   <div className="mt-2 flex flex-wrap gap-2">
    <input className={inputClass+" flex-1"} value={newId} placeholder="vendor/model-name" onChange={e=>setNewId(e.target.value)}/>
    <button className="rounded border px-3 py-2 text-sm" disabled={busy||!newId.trim()} onClick={async()=>{
     if(await run("POST","/api/admin/model-providers",{vendor:"nvidia",modelId:newId.trim()},{label:"add-provider",success:"Provider 已添加"}))setNewId("");
    }}>添加</button>
   </div>
  </details>
 </Card>;
}
