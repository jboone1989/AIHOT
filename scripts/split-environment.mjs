#!/usr/bin/env node
// One-time local migration: production and development own distinct private dotenv files.
// Never logs values or creates a second secret copy.
import {chmodSync,readFileSync,renameSync,symlinkSync,lstatSync,existsSync,writeFileSync} from "node:fs";
import {parseEnv} from "node:util";
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
