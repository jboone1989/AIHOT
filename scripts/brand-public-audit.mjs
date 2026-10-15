/** Server-side public-brand audit. No browser installation required. */
const base = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000";
const pages = ["/", "/all", "/knowledge", "/hot", "/topics", "/daily", "/more", "/starred", "/about", "/changelog", "/feedback", "/agent", "/privacy", "/terms", "/admin/login"];
const assets = ["/logo.svg", "/icon.png", "/icon-192.png", "/apple-icon.png", "/favicon.ico", "/manifest.webmanifest"];
let failures = 0;
for (const path of pages) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(15000) });
  const html = await response.text();
  const safeBody = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"");
  const bad = /(?:\bAIHOT\b|aihot\.news|<meta[^>]+name=["']aihot-release)/i.test(safeBody);
  if (bad) { const i=safeBody.toLowerCase().indexOf("aihot"); console.log(JSON.stringify({path,matchContext:safeBody.slice(Math.max(0,i-100),i+125)})); }
  const hasLR = /LivingRuntime/.test(safeBody);
  const ok = response.ok && !bad && hasLR;
  if (!ok) failures++;
  console.log(JSON.stringify({path,code:response.status,hasLivingRuntime:hasLR,foreignBrand:bad,ok}));
}
for (const path of assets) {
  const response=await fetch(base+path,{signal:AbortSignal.timeout(15000)});
  const bytes=Buffer.from(await response.arrayBuffer());
  const png=bytes.subarray(0,8).toString("hex")==="89504e470d0a1a0a";
  const ico=bytes.length>6&&bytes.readUInt16LE(2)===1;
  const expected=path.endsWith(".png")?png:path.endsWith(".ico")?ico:true;
  const text=/svg|json/i.test(path)?bytes.toString("utf8"):"";
  const branded=/AIHOT/i.test(text);
  const ok=response.ok&&expected&&!branded;
  if(!ok)failures++;
  console.log(JSON.stringify({asset:path,code:response.status,bytes:bytes.length,ok}));
}
if(failures)process.exitCode=1;
