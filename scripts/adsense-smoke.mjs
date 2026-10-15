/** AdSense ownership-only deployment check.
 * Defaults to verifying that no public publisher ID or ad scripts are exposed.
 * To validate an explicitly enabled site, set ADSENSE_EXPECTED_ID=ca-pub-<16 digits>.
 */
const host=(process.env.PREVIEW_URL??"http://127.0.0.1:3000").replace(/\/$/,"");
const expected=process.env.ADSENSE_EXPECTED_ID?.trim()??"";
if(expected&&!/^ca-pub-[0-9]{16}$/.test(expected))throw new Error("ADSENSE_EXPECTED_ID must be a valid ca-pub-16digit ID");
const [home,ads]=await Promise.all([
 fetch(host+"/",{signal:AbortSignal.timeout(17000)}),
 fetch(host+"/ads.txt",{signal:AbortSignal.timeout(17000)})
]);
const html=await home.text(),txt=await ads.text();
const matches=[...html.matchAll(/<meta\s+name="google-adsense-account"\s+content="([^"]+)"\s*\/?\s*>/g)].map(x=>x[1]);
const scripts=html.includes("pagead2.googlesyndication.com")||html.includes("adsbygoogle.js");
const correctAdsTxt=expected ? txt.trim()===`google.com, ${expected.slice(3)}, DIRECT, f08c47fec0942fa0` : ads.status===404;
const correctMeta=expected ? matches.length===1&&matches[0]===expected : matches.length===0;
const pass=home.status===200&&correctAdsTxt&&correctMeta&&!scripts&&(!expected||ads.status===200&&ads.headers.get("content-type")?.startsWith("text/plain"));
console.log(JSON.stringify({mode:expected?"verification-enabled":"default-off",pageStatus:home.status,adsStatus:ads.status,adsContentType:ads.headers.get("content-type"),metaCount:matches.length,metaCorrect:correctMeta,adsTxtCorrect:correctAdsTxt,noAdScripts:!scripts,pass}));
if(!pass)process.exitCode=1;
