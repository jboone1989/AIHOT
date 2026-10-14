// Small reproducible Chinese-news smoke test against hosted NVIDIA NIM.
// Prints only synthetic test output; never writes or prints credentials.
import { PRESETS } from "@aihot/site/models";
const key = process.env.NVIDIA_API_KEY;
if(!key) { console.error("NVIDIA_API_KEY missing"); process.exit(2); }
const base=(process.env.NVIDIA_BASE_URL||"https://integrate.api.nvidia.com/v1").replace(/\/$/,"");
for(const name of ["nvidia-gpt-oss-20b","nvidia-nemotron-lightning"]){
  const preset=PRESETS[name];
  const started=Date.now();
  try {
    const response=await fetch(base+"/chat/completions",{
      method:"POST",signal:AbortSignal.timeout(30000),
      headers:{"content-type":"application/json","authorization":"Bearer "+key},
      body:JSON.stringify({
        model:preset.model,
        messages:[{role:"user",content:'你是中文科技新闻编辑。把以下模拟英文消息整理成 JSON 对象，仅包含 titleZh（中文标题）和 summaryZh（中文概要，少于70字），不要添加未经提供的事实。消息：A research laboratory releases an open-source AI model that improves energy efficiency in language translation tests.'}],
        temperature:0,max_tokens:1200,stream:false,...(preset.extra||{})
      })
    });
    const body=await response.json().catch(()=>({}));
    const content=body.choices?.[0]?.message?.content||"";
    let result=null;
    try {
      const raw=content.match(/\{[\s\S]*\}/)?.[0];if(raw)result=JSON.parse(raw);
    } catch {}
    console.log(JSON.stringify({preset:name,http:response.status,elapsed_ms:Date.now()-started,valid:!!result?.titleZh&&!!result?.summaryZh,language:/[\u4e00-\u9fff]/.test((result?.titleZh||"")+(result?.summaryZh||"")),title:(result?.titleZh||"").slice(0,80),summary:(result?.summaryZh||"").slice(0,120),finish:body.choices?.[0]?.finish_reason||null,usage:body.usage?{prompt_tokens:body.usage.prompt_tokens,completion_tokens:body.usage.completion_tokens}:null,error_code:body.error?.code||null}));
  }catch(e){console.log(JSON.stringify({preset:name,error:e instanceof Error?e.name:"unknown",elapsed_ms:Date.now()-started}));}
}