import {useEffect,useState} from "react";
import type {AdminProviderProfile} from "@aihot/contracts/admin";
import {Button,Input,Select,Textarea} from "./ui";

export type ProviderEditValues={
 adapter:AdminProviderProfile["adapter"];endpoint:string|null;capabilities:string[];
 requestDefaults:Record<string,unknown>;probeSpec:AdminProviderProfile['probeSpec'];stream:boolean;
 complexity:AdminProviderProfile["complexity"];documentationUrl:string|null;notes:string|null;
 enabled:boolean;routeEnabled:boolean;
};
export function ProviderEditorDialog({provider,busy,readOnly,onClose,onSave}:{
 provider:AdminProviderProfile;busy:boolean;readOnly:boolean;onClose:()=>void;
 onSave:(changes:ProviderEditValues,reason:string)=>Promise<boolean>;
}){
 const [adapter,setAdapter]=useState<ProviderEditValues["adapter"]>(provider.adapter);
 const [endpoint,setEndpoint]=useState(provider.endpoint??"");
 const [capabilities,setCapabilities]=useState(provider.capabilities.join(", "));
 const [defaults,setDefaults]=useState(JSON.stringify(provider.requestDefaults,null,2));
 const [testRequest,setTestRequest]=useState(provider.probeSpec?JSON.stringify(provider.probeSpec,null,2):"");
 const [complexity,setComplexity]=useState<ProviderEditValues["complexity"]>(provider.complexity);
 const [documentationUrl,setDocumentationUrl]=useState(provider.documentationUrl??"");
 const [notes,setNotes]=useState(provider.notes??"");
 const [enabled,setEnabled]=useState(provider.enabled);
 const [routeEnabled,setRouteEnabled]=useState(provider.routeEnabled);
 const [stream,setStream]=useState(provider.stream);
 const [reason,setReason]=useState("");
 const [error,setError]=useState("");
 useEffect(()=>{
  const listener=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!busy)onClose()};
  document.addEventListener("keydown",listener);
  return ()=>document.removeEventListener("keydown",listener);
 },[busy,onClose]);
 async function save(){
  try{
   const requestDefaults=JSON.parse(defaults);
   if(requestDefaults===null||typeof requestDefaults!=="object"||Array.isArray(requestDefaults))throw Error("请求参数必须是 JSON 对象");
   const probeSpec=testRequest.trim()?JSON.parse(testRequest):null;
   if(probeSpec!==null&&(!probeSpec||typeof probeSpec!=="object"||Array.isArray(probeSpec)))throw Error("独立测试请求必须是 JSON 对象");
   if(!reason.trim())throw Error("请填写修改原因");
   const ok=await onSave({
    adapter,endpoint:endpoint.trim()||null,
    capabilities:capabilities.split(",").map(x=>x.trim()).filter(Boolean),
    requestDefaults,probeSpec,complexity,
    documentationUrl:documentationUrl.trim()||null,notes:notes.trim()||null,
    enabled,routeEnabled,stream,
   },reason.trim());
   if(ok)onClose();
  }catch(e){setError(e instanceof Error?e.message:String(e))}
 }
 const field=(name:string,child:React.ReactNode)=><label className="block space-y-1 text-xs font-medium text-ink-3"><span>{name}</span>{child}</label>;
 return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
  role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
  <div role="dialog" aria-modal="true" aria-label={readOnly?"查看 Provider":"编辑 Provider"}
   className="flex max-h-[min(92vh,860px)] w-full max-w-2xl flex-col overflow-hidden rounded-panel bg-surface ring-1 ring-line shadow-2xl">
   <header className="flex items-start justify-between gap-3 border-b border-line p-4">
    <div className="min-w-0"><h3 className="text-base font-semibold">{readOnly?"查看 Provider":"编辑 Provider"}</h3>
     <p className="break-all font-mono text-xs text-ink-3">{provider.modelId}</p></div>
    <Button size="sm" onClick={onClose} disabled={busy} aria-label="关闭">关闭</Button>
   </header>
   <div className="space-y-4 overflow-y-auto p-4">
    <div className="grid gap-3 sm:grid-cols-2">
     {field("供应商",<Input value={provider.vendor} disabled/>)}
     {field("凭据引用",<Input value={provider.credentialEnv} disabled/>)}
     {field("适配器",<Select disabled={readOnly} value={adapter} onChange={e=>setAdapter(e.target.value as ProviderEditValues["adapter"])}>
      {["chat","embedding","document","safety","special","unconfigured"].map(x=><option key={x} value={x}>{x}</option>)}
     </Select>)}
     {field("任务复杂度",<Select disabled={readOnly} value={complexity} onChange={e=>setComplexity(e.target.value as ProviderEditValues["complexity"])}>
      {["light","medium","heavy"].map(x=><option key={x} value={x}>{x}</option>)}
     </Select>)}
    </div>
    {field("API Endpoint",<Input disabled={readOnly} value={endpoint} onChange={e=>setEndpoint(e.target.value)}/>)}
    <div className="grid gap-3 sm:grid-cols-2">
     {field("能力（逗号分隔）",<Input disabled={readOnly} value={capabilities} onChange={e=>setCapabilities(e.target.value)}/>)}
     {field("测试配置状态",<Input disabled value={testRequest.trim()?"已配置独立请求":"待配置独立请求"}/>)}
    </div>
    {field("模型专用参数（JSON）",<Textarea disabled={readOnly} rows={4} className="font-mono text-xs" value={defaults} onChange={e=>setDefaults(e.target.value)}/>)}
    {field("本 Provider 专用测试请求（JSON，留空表示未配置）",<Textarea disabled={readOnly} rows={5} className="font-mono text-xs" value={testRequest} onChange={e=>setTestRequest(e.target.value)} placeholder='{"capability":"text","body":{"messages":[{"role":"user","content":"Hello"}]},"response":"chat"}'/>)}
    <p className="text-xs text-ink-3">测试不设手动超时；运行后表格显示实际返回耗时。</p>
    <div className="flex flex-wrap gap-5 text-sm">
     <label className="flex items-center gap-2"><input type="checkbox" disabled={readOnly} checked={enabled} onChange={e=>{setEnabled(e.target.checked);if(!e.target.checked)setRouteEnabled(false)}}/>启用</label>
     <label className="flex items-center gap-2"><input type="checkbox" disabled={readOnly} checked={stream} onChange={e=>setStream(e.target.checked)}/>流式输出</label>
     <label className="flex items-center gap-2"><input type="checkbox" disabled={readOnly||!enabled} checked={routeEnabled} onChange={e=>setRouteEnabled(e.target.checked)}/>允许自动路由</label>
    </div>
    {field("官方文档",<Input disabled={readOnly} value={documentationUrl} onChange={e=>setDocumentationUrl(e.target.value)}/>)}
    {field("备注",<Textarea rows={2} disabled={readOnly} value={notes} onChange={e=>setNotes(e.target.value)}/>)}
    {provider.checks.length>0&&<div className="text-xs text-ink-3">验证记录：{provider.checks.map(c=>c.capability+"："+c.status).join(" · ")}</div>}
    {!readOnly&&field("修改原因（必填）",<Input autoFocus value={reason} onChange={e=>setReason(e.target.value)} placeholder="为什么要调整这项配置"/>)}
    {error&&<p role="alert" className="text-sm text-hot">{error}</p>}
   </div>
   <footer className="flex justify-end gap-2 border-t border-line p-4">
    <Button disabled={busy} onClick={onClose}>{readOnly?"关闭":"取消"}</Button>
    {!readOnly&&<Button tone="primary" busy={busy} onClick={save}>保存配置</Button>}
   </footer>
  </div>
 </div>;
}
