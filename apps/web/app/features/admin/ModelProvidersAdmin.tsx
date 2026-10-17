import {useEffect,useMemo,useState} from "react";
import type {AdminProviderProfile} from "@aihot/contracts/admin";
import {useAdminAction} from "./action";
import {Badge,Button,Card,DataTable,Input,ReasonDialog,Select} from "./ui";
import {ProviderEditorDialog,type ProviderEditValues} from "./ProviderEditorDialog";

const PAGE_SIZE=15;
type Filter="all"|"active"|"routed"|"inactive";
const key=(p:AdminProviderProfile)=>p.vendor+":"+p.modelId;
function verifyLabel(p:AdminProviderProfile){
 const valid=p.checks.filter(c=>c.status==="verified");
 if(valid.length)return valid.map(c=>c.capability).join(", ");
 return p.checks.some(c=>c.status==="failed")?"验证失败":"未验证";
}
function rowStatus(p:AdminProviderProfile){
 return p.routeEnabled?"已路由":p.enabled?"已启用":"未启用";
}
export function ModelProvidersAdmin({providers}:{providers:AdminProviderProfile[]}){
 const {run,busy}=useAdminAction();
 const [search,setSearch]=useState("");
 const [status,setStatus]=useState<Filter>("all");
 const [adapter,setAdapter]=useState("all");
 const [page,setPage]=useState(1);
 const [editing,setEditing]=useState<AdminProviderProfile|null>(null);
 const [viewing,setViewing]=useState<AdminProviderProfile|null>(null);
 const [deleting,setDeleting]=useState<AdminProviderProfile|null>(null);
 const [creating,setCreating]=useState(false);
 const [newId,setNewId]=useState("");
 const [createError,setCreateError]=useState("");
 const [probe,setProbe]=useState<AdminProviderProfile|null>(null);
 const [probeCapability,setProbeCapability]=useState("");
 useEffect(()=>setPage(1),[search,status,adapter]);
 const rows=useMemo(()=>providers.filter(p=>{
  const q=search.trim().toLowerCase();
  if(q&&!([p.vendor,p.modelId,p.adapter,...p.capabilities].some(x=>x.toLowerCase().includes(q))))return false;
  if(adapter!=="all"&&p.adapter!==adapter)return false;
  if(status==="active"&&!p.enabled)return false;
  if(status==="routed"&&!p.routeEnabled)return false;
  if(status==="inactive"&&p.enabled)return false;
  return true;
 }),[providers,search,status,adapter]);
 const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
 const currentPage=Math.min(page,pages);
 const visible=rows.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
 const adapters=[...new Set(providers.map(p=>p.adapter))].sort();
 async function save(p:AdminProviderProfile,changes:ProviderEditValues,reason:string){
  const result=await run("PATCH","/api/admin/model-providers",
   {vendor:p.vendor,modelId:p.modelId,version:p.version,changes,reason},
   {label:"edit:"+key(p),success:"Provider 配置已更新"});
  return result!==null;
 }
 async function create(){
  if(!/^[-\w.]+\/[-\w.]+$/i.test(newId.trim())){setCreateError("请输入 vendor/model-name 格式的模型 ID");return}
  setCreateError("");
  const result=await run<AdminProviderProfile>("POST","/api/admin/model-providers",
   {vendor:"nvidia",modelId:newId.trim()},{label:"create:"+newId.trim(),success:"Provider 已添加"});
  if(result){setCreating(false);setNewId("");setEditing(result)}
 }
 async function remove(reason:string){
  if(!deleting)return false;
  const result=await run("DELETE","/api/admin/model-providers",
   {vendor:deleting.vendor,modelId:deleting.modelId,version:deleting.version,reason},
   {label:"delete:"+key(deleting),success:"Provider 已删除"});
  if(result){setDeleting(null);return true}
  return false;
 }
 async function runProbe(){
  if(!probe||!probeCapability)return;
  const result=await run("POST","/api/admin/model-providers/probe",
   {vendor:probe.vendor,modelId:probe.modelId,capability:probeCapability},
   {label:"probe:"+key(probe)+":"+probeCapability,success:"能力探测已结束"});
  if(result)setProbe(null);
 }
 const openProbe=(p:AdminProviderProfile)=>{
  setProbe(p);
  setProbeCapability(p.capabilities.includes("text")?"text":p.capabilities[0]??"");
 };
 return <Card title={"Provider 管理（"+providers.length+"）"}
  right={<Button tone="primary" size="sm" onClick={()=>{setCreating(true);setCreateError("")}}>+ 添加 Provider</Button>} pad={false}>
  <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
   <div className="min-w-[180px] flex-1"><Input aria-label="搜索模型" placeholder="搜索模型名称、能力、供应商" value={search} onChange={e=>setSearch(e.target.value)}/></div>
   <Select aria-label="适配器筛选" className="!w-auto min-w-[125px]" value={adapter} onChange={e=>setAdapter(e.target.value)}>
    <option value="all">全部适配器</option>{adapters.map(x=><option key={x} value={x}>{x}</option>)}
   </Select>
   <Select aria-label="状态筛选" className="!w-auto min-w-[120px]" value={status} onChange={e=>setStatus(e.target.value as Filter)}>
    <option value="all">全部状态</option><option value="active">已启用</option><option value="routed">已路由</option><option value="inactive">未启用</option>
   </Select>
   <span className="text-xs text-ink-3">{rows.length} 条结果</span>
  </div>
  <DataTable dense rows={visible} rowKey={key} empty="暂无符合条件的 Provider" columns={[
   {key:"id",label:"Provider / 模型",render:p=><div className="max-w-[270px] break-all font-mono text-xs"><span className="text-ink-3">{p.vendor}/</span>{p.modelId}</div>},
   {key:"adapter",label:"适配器",render:p=><span className="text-xs">{p.adapter}</span>},
   {key:"caps",label:"能力",render:p=><span className="text-xs">{p.capabilities.join(", ")||"—"}</span>},
   {key:"tier",label:"复杂度",render:p=>p.complexity},
   {key:"timeout",label:"超时",render:p=><span className="num whitespace-nowrap">{p.timeoutMs/1000}s</span>},
   {key:"enabled",label:"状态",render:p=><Badge tone={p.routeEnabled?"ok":p.enabled?"warn":"muted"}>{rowStatus(p)}</Badge>},
   {key:"health",label:"验证",render:p=><span className="max-w-[160px] text-xs text-ink-3" title={verifyLabel(p)}>{verifyLabel(p)}</span>},
   {key:"actions",label:"操作",render:p=><div className="flex flex-wrap items-center gap-1 whitespace-nowrap">
    <Button size="sm" tone="ghost" onClick={()=>setViewing(p)}>查看</Button>
    <Button size="sm" tone="secondary" onClick={()=>setEditing(p)}>编辑</Button>
    <Button size="sm" tone="ghost" disabled={!p.enabled||p.capabilities.length===0} onClick={()=>openProbe(p)}>测试</Button>
    <Button size="sm" tone="ghost" disabled={p.enabled||p.routeEnabled} title={p.enabled?"请先停用后删除":"删除 Provider"} onClick={()=>setDeleting(p)}>删除</Button>
   </div>},
  ]}/>
  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line p-3 text-xs text-ink-3">
   <span>第 {currentPage} / {pages} 页 · 每页 {PAGE_SIZE} 条</span>
   <div className="flex gap-2">
    <Button size="sm" disabled={currentPage<=1} onClick={()=>setPage(x=>Math.max(1,x-1))}>上一页</Button>
    <Button size="sm" disabled={currentPage>=pages} onClick={()=>setPage(x=>Math.min(pages,x+1))}>下一页</Button>
   </div>
  </div>
  {viewing&&<ProviderEditorDialog key={"view:"+key(viewing)} provider={viewing} readOnly busy={busy}
   onClose={()=>setViewing(null)} onSave={async()=>false}/>}
  {editing&&<ProviderEditorDialog key={"edit:"+key(editing)+":"+editing.version} provider={editing} readOnly={false} busy={busy}
   onClose={()=>setEditing(null)} onSave={(changes,reason)=>save(editing,changes,reason)}/>}
  {creating&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
   <div role="dialog" aria-modal="true" aria-label="添加 Provider" className="w-full max-w-md space-y-4 rounded-panel bg-surface p-5 shadow-xl">
    <h3 className="text-base font-semibold">添加 Provider</h3>
    <p className="text-xs text-ink-3">新建后默认停用，可在编辑中独立配置参数。</p>
    <label className="block space-y-1 text-xs">模型 ID
     <Input autoFocus value={newId} onChange={e=>setNewId(e.target.value)} placeholder="vendor/model-name"/>
    </label>
    {createError&&<p role="alert" className="text-sm text-hot">{createError}</p>}
    <div className="flex justify-end gap-2"><Button disabled={busy} onClick={()=>setCreating(false)}>取消</Button>
     <Button busy={busy} tone="primary" onClick={create}>创建</Button>
    </div>
   </div>
  </div>}
  <ReasonDialog open={deleting!==null} title="删除 Provider" danger confirmLabel="确认删除"
   description={deleting?"彻底删除 "+key(deleting)+" 的配置和能力探测记录。不能恢复，请填写原因。":""}
   busy={busy} onClose={()=>setDeleting(null)} onSubmit={remove}/>
  {probe&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
   <div role="dialog" aria-modal="true" aria-label="能力测试" className="w-full max-w-md space-y-4 rounded-panel bg-surface p-5 shadow-xl">
    <h3 className="text-base font-semibold">测试 Provider</h3>
    <p className="break-all font-mono text-xs text-ink-3">{probe.modelId}</p>
    <Select value={probeCapability} onChange={e=>setProbeCapability(e.target.value)}>
     {probe.capabilities.map(c=><option key={c} value={c}>{c}</option>)}
    </Select>
    <p className="text-xs text-ink-3">测试会真实调用模型并消耗 API 配额。</p>
    <div className="flex justify-end gap-2"><Button disabled={busy} onClick={()=>setProbe(null)}>取消</Button>
     <Button tone="primary" busy={busy} disabled={!probeCapability} onClick={runProbe}>运行测试</Button>
    </div>
   </div>
  </div>}
 </Card>;
}
