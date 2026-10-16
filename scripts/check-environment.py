#!/usr/bin/env python3
"""Read-only deployment environment contract. Never print credential contents."""
import argparse, json
from pathlib import Path
def load(path):
    rows={}
    for line in Path(path).read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key,value=line.split("=",1)
            rows[key.strip()]=value.strip().strip("'\"")
    return rows
def main():
    a=argparse.ArgumentParser()
    a.add_argument("--target",choices=["production","development"],required=True)
    a.add_argument("--file",required=True)
    a.add_argument("--compare")
    args=a.parse_args()
    policy=json.loads(Path("config/environments",args.target+".json").read_text())
    env=load(args.file)
    errors=[]
    for key,expected in policy["requiredFlags"].items():
        if env.get(key)!=expected:errors.append(f"{key}: expected {expected}, found {env.get(key,'MISSING')}")
    if env.get("AIHOT_ENVIRONMENT")!=args.target:errors.append("AIHOT_ENVIRONMENT does not match target")
    for key in policy["reportCredentials"]:
        if not env.get(key):errors.append("Missing report credential: "+key)
    if args.compare:
        other=load(args.compare)
        for key in policy["requiredFlags"]:
            if env.get(key)!=other.get(key):errors.append("Feature parity mismatch: "+key)
        for key in policy["reportCredentials"]:
            if bool(env.get(key))!=bool(other.get(key)):errors.append("Missing integration in one environment: "+key)
    print(json.dumps({"environment":args.target,"file":Path(args.file).name,
        "checks":len(policy["requiredFlags"])+len(policy["reportCredentials"]), "errors":errors},ensure_ascii=False))
    if errors:raise SystemExit(1)
if __name__=="__main__":main()
