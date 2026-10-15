#!/usr/bin/env python3
"""Restore a private PostgreSQL archive ONLY to the livingruntime Compose database.

Use --replace --confirm-destination livingruntime for a final refresh after
staging migrations. Replaces the isolated database public schema, not the legacy
host database; refuses to run while API/web/worker is running.
"""
import argparse
import json
import pathlib
import subprocess
import sys


def command(prefix, rest, **kwargs):
    return subprocess.run(prefix + rest, check=True, **kwargs)


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--archive", type=pathlib.Path, required=True)
    p.add_argument("--compose", action="append", required=True)
    p.add_argument("--replace", action="store_true", help="Reset staged public schema first")
    p.add_argument("--confirm-destination", default="", help="Must be livingruntime for --replace")
    args=p.parse_args()
    if not args.archive.is_file() or args.archive.stat().st_size < 1024:
        raise RuntimeError("Missing/empty backup archive")
    prefix=["docker","compose"]
    for name in args.compose:
        prefix += ["-f",name]
    config=json.loads(command(prefix,["config","--format","json"],capture_output=True,text=True).stdout)
    if config.get("name")!="livingruntime":
        raise RuntimeError("Refusing restore: unexpected Compose project")
    if args.replace and args.confirm_destination!="livingruntime":
        raise RuntimeError("Reset must be explicitly confirmed for livingruntime")
    running=command(prefix,["ps","--status","running","--services"],capture_output=True,text=True).stdout.splitlines()
    active=set(map(str.strip,running))
    if active-{"db"}:
        raise RuntimeError("Refusing restore while application services run: "+", ".join(sorted(active-{"db"})))
    if "db" not in active:
        raise RuntimeError("Compose database must already be running")
    pg=prefix+["exec","-T","db"]
    if args.replace:
        # A full refresh must also remove the pgboss schema and any other
        # app-owned schemas or extensions from the isolated Compose database.
        print("Replacing ONLY isolated Compose database livingruntime/aihot",flush=True)
        admin=["psql","-X","-v","ON_ERROR_STOP=1","-U","aihot","-d","postgres"]
        command(pg,admin+["-c","DROP DATABASE IF EXISTS aihot WITH (FORCE)"],timeout=90,stdout=subprocess.DEVNULL)
        command(pg,admin+["-c","CREATE DATABASE aihot OWNER aihot"],timeout=90,stdout=subprocess.DEVNULL)
    restore=pg+["pg_restore","-U","aihot","-d","aihot","--no-owner","--no-acl","--exit-on-error"]
    if not args.replace:
        restore.extend(["--clean","--if-exists"])
    with args.archive.open("rb") as source:
        rc=subprocess.run(restore,stdin=source,timeout=1800,check=False).returncode
    if rc:
        raise SystemExit("Restore failed: "+str(rc))
    print("Restore successful; apply migrations and check rows before restarting services.")


if __name__=="__main__":
    main()
