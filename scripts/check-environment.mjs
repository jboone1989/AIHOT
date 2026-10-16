#!/usr/bin/env node
// Validate local environment without ever printing credential values.
import {readFileSync} from "node:fs";
import {parseEnv} from "node:util";
import {resolve,basename} from "node:path";
const args=process.argv.slice(2),target=args.find(x=>x.startsWith("--target="))?.split("=")[1];
const file=args.find(x=>x.startsWith("--file="))?.slice(7);
if(!["production","development"].includes(target)||!file){
 console.error("Usage: node scripts/check-environment.mjs --target=production|development --file=.env.production [--compare=.env.development]");process.exit(2);
}
const policy=JSON.parse(readFileSync(resolve("config/environments",target+".json"),"utf8"));
const cfg=parseEnv(readFileSync(resolve(file),"utf8"));
const failures=[];
for(const [name,expected] of Object.entries(policy.requiredFlags)){
 if(cfg[name]!==expected)failures.push(name+" expected="+expected+" actual="+(cfg[name]??"MISSING"));
}
if(cfg.AIHOT_ENVIRONMENT!==policy.environment)failures.push("AIHOT_ENVIRONMENT mismatch");
for(const name of policy.reportCredentials){
 if(!cfg[name])failures.push("report authorization missing: "+name);
}
const other=args.find(x=>x.startsWith("--compare="))?.slice(10);
if(other){
 const peer=parseEnv(readFileSync(resolve(other),"utf8"));
 for(const flag of Object.keys(policy.requiredFlags)){
  if(cfg[flag]!==peer[flag])failures.push("feature flag differs between environments: "+flag);
 }
 // Compare configured/absent status, not secret values.
 for(const key of policy.reportCredentials){
  if(Boolean(cfg[key])!==Boolean(peer[key]))failures.push("integration credential missing in one environment: "+key);
 }
}
console.log(JSON.stringify({environment:target,file:basename(file),checks:Object.keys(policy.requiredFlags).length+policy.reportCredentials.length,
 errors:failures},null,2));
if(failures.length)process.exit(1);
