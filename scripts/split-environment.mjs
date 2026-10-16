#!/usr/bin/env node
// One-time local migration: production and development own distinct private dotenv files.
// Never logs values or creates a second secret copy.
import {chmodSync,readFileSync,renameSync,symlinkSync,lstatSync,existsSync,writeFileSync} from "node:fs";
import {parseEnv} from "node:util";
import {execFileSync} from "node:child_process";
const target=process.argv[2];
if(!["production","development"].includes(target)){
 console.error("Usage: node scripts/split-environment.mjs production|development");process.exit(2);
}
const source=".env",dest=".env."+target;
if(existsSync(dest)){
 if(!lstatSync(source).isSymbolicLink())throw Error("Both environment files exist; reconcile manually");
 console.log("Environment already split: "+dest);process.exit(0);
}
if(!existsSync(source)||lstatSync(source).isSymbolicLink())throw Error("Expected existing private regular .env");
if(lstatSync(source).mode&0o077)throw Error("Refusing loose permissions on .env");
const text=readFileSync(source,"utf8"),vars=parseEnv(text);
const flags={AIHOT_ENVIRONMENT:target,AIHOT_ENV_FILE:dest,RECEIPT_AUTO_RELEASE_ENABLED:"false"};
if(target==="production"){
 const mapping={API:"livingruntime-api-1",WORKER:"livingruntime-worker-1",WEB:"livingruntime-web-1",KNOWLEDGE:"livingruntime-knowledge-1"};
 for(const [service,container] of Object.entries(mapping)){
  const image=execFileSync("docker",["inspect","-f","{{.Config.Image}}",container],{encoding:"utf8",timeout:10000}).trim();
  const tag=/:([0-9a-f]{12})$/i.exec(image)?.[1];
  if(!tag)throw Error("Cannot identify runtime image tag for "+container);
  flags["LRSITE_RELEASE_"+service]=tag;
 }
 flags.LRSITE_RELEASE_SETUP=flags.LRSITE_RELEASE_API;
 flags.LRSITE_DEPLOYED_SHA=execFileSync("git",["rev-parse",flags.LRSITE_RELEASE_API+"^{commit}"],{encoding:"utf8",timeout:10000}).trim();
}
const out=text.trimEnd()+"\n"+Object.entries(flags).filter(([k])=>!Object.hasOwn(vars,k))
  .map(([k,v])=>k+"="+v).join("\n")+"\n";
for(const [key,value] of Object.entries(flags)){
 if(vars[key]&&vars[key]!==value)throw Error("Explicit "+key+" differs; manual review required");
}
renameSync(source,dest);
chmodSync(dest,0o600);
writeFileSync(dest,out,{mode:0o600}); // Same inode/path, no additional secret copy.
symlinkSync(dest,source);
console.log("Environment split securely: "+target+" (.env is compatibility symlink)");
