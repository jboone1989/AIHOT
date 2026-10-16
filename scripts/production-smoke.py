#!/usr/bin/env python3
"""EventGraph production acceptance: real content + knowledge graph, not just HTTP 200."""
import json
import os
import sys
import urllib.error
import urllib.request

base=os.environ.get("LRSITE_SMOKE_URL","http://127.0.0.1:3000").rstrip("/")
pages=["/","/all","/hot","/knowledge","/topics","/daily","/daily/archive","/feedback","/about","/privacy","/terms","/robots.txt","/sitemap.xml"]
failure=[]
def get(path):
    try:
        with urllib.request.urlopen(urllib.request.Request(base+path,headers={"User-Agent":"EventGraph-Production-Smoke/1.0"}),timeout=18) as response:
            return response.status,response.read(250000),response.headers.get("content-type","")
    except urllib.error.HTTPError as err:
        return err.code,err.read(250000),err.headers.get("content-type","")
    except Exception as err:
        failure.append(path+" "+str(err))
        return 0,b"",""
for path in pages:
    status,html,_=get(path)
    if status!=200 or not html:failure.append(path+" status="+str(status))
    print(path,status,len(html))
status,home,_=get("/")
if b"EventGraph" not in home or b"adsbygoogle.js" in home or b"google-adsense-account" in home:
    failure.append("Home title or AdSense verification is incorrect")
for path,key in [("/api/site/hot","entries"),("/api/site/timeline","cards")]:
    status,raw,_=get(path)
    try:count=len(json.loads(raw).get(key,[]))
    except Exception:count=0
    print(path,status,key,count)
    if status!=200 or count<1:failure.append(path+" has no current news data")
status,raw,_=get("/api/site/knowledge/stats")
try:graph=json.loads(raw)
except Exception:graph={}
print("knowledge",status,graph)
if status!=200 or graph.get("entities",0)<1 or graph.get("relations",0)<1 or graph.get("episodes",0)<1:
    failure.append("Knowledge graph is unavailable or empty")
status,_,_=get("/ads.txt")
if status!=404:failure.append("AdSense must remain unapproved and off")
print("ads.txt",status)
print("PASS" if not failure else "FAIL",json.dumps(failure))
if failure:sys.exit(1)
