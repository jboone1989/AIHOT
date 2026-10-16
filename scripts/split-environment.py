#!/usr/bin/env python3
"""Local, one-time .env -> .env.production/.env.development migration; secrets never printed."""
import os, re, subprocess, sys
from pathlib import Path
def run(*argv):
    return subprocess.check_output(argv,text=True,timeout=12).strip()
def main():
    if len(sys.argv)!=2 or sys.argv[1] not in ("production","development"):
        raise SystemExit("Usage: python3 scripts/split-environment.py production|development")
    target=sys.argv[1]
    source=Path(".env");destination=Path(".env."+target)
    if destination.exists():
        if not source.is_symlink():raise SystemExit("Conflicting files: reconcile first")
        print("Already split: "+str(destination));return
    if not source.is_file() or source.is_symlink():raise SystemExit("Missing private regular .env")
    if source.stat().st_mode&0o077:raise SystemExit("Unsafe .env file permissions")
    data=source.read_text()
    env={}
    for line in data.splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k,v=line.split("=",1);env[k.strip()]=v.strip().strip("'\"")
    flags={"AIHOT_ENVIRONMENT":target,"AIHOT_ENV_FILE":destination.name,"RECEIPT_AUTO_RELEASE_ENABLED":"false"}
    if target=="production":
        names={"API":"livingruntime-api-1","WORKER":"livingruntime-worker-1",
               "WEB":"livingruntime-web-1","KNOWLEDGE":"livingruntime-knowledge-1"}
        for service,container in names.items():
            image=run("docker","inspect","-f","{{.Config.Image}}",container)
            match=re.search(r":([0-9a-f]{12})$",image)
            if not match:raise SystemExit("Cannot verify running image for "+container)
            flags["LRSITE_RELEASE_"+service]=match.group(1)
        flags["LRSITE_RELEASE_SETUP"]=flags["LRSITE_RELEASE_API"]
        flags["LRSITE_DEPLOYED_SHA"]=run("git","rev-parse",flags["LRSITE_RELEASE_API"]+"^{commit}")
        if not re.fullmatch("[0-9a-f]{40}",flags["LRSITE_DEPLOYED_SHA"]):
            raise SystemExit("Cannot verify deployed revision")
    for k,v in flags.items():
        if k in env and env[k]!=v:raise SystemExit("Conflicting "+k+"; reconcile before migration")
    output=data.rstrip()+"\n"+"\n".join(k+"="+v for k,v in flags.items() if k not in env)+"\n"
    source.rename(destination)
    os.chmod(destination,0o600)
    destination.write_text(output)
    source.symlink_to(destination.name)
    print("Environment split: "+target+" (private file 0600; .env compatibility symlink)")
if __name__=="__main__":main()
