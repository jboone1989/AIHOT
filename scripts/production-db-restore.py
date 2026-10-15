#!/usr/bin/env python3
"""Restore a PostgreSQL custom archive to an UNINITIALIZED Docker Compose database.

No passwords are printed; Docker Compose carries POSTGRES_PASSWORD via .env.
Only execute while the destination app services are stopped. Named-volume state
and source PostgreSQL remain intact. This is NOT a rollback command.
"""
import argparse
import pathlib
import subprocess
import sys


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--archive", type=pathlib.Path, required=True)
    p.add_argument("--compose", action="append", required=True, help="Compose YAML path, in order")
    args = p.parse_args()
    if not args.archive.is_file() or args.archive.stat().st_size < 1024:
        raise RuntimeError("Missing/empty backup archive")
    prefix = ["docker", "compose"]
    for file in args.compose:
        prefix += ["-f", file]
    # Only database service should be running.  Never restore against live API/worker.
    state = subprocess.run(prefix+["ps","--status","running","--services"],text=True,capture_output=True,check=True).stdout.splitlines()
    active = {s.strip() for s in state}
    if active - {"db"}:
        raise RuntimeError("Refusing restore with live app containers: " + ", ".join(sorted(active-{"db"})))
    if "db" not in active:
        raise RuntimeError("Database container is not running")
    args_pg = ["docker", "compose"]
    for file in args.compose:
        args_pg += ["-f", file]
    args_pg += ["exec","-T","db","pg_restore","-U","aihot","-d","aihot",
                "--no-owner","--no-acl","--clean","--if-exists","--exit-on-error"]
    with args.archive.open("rb") as archive:
        rc = subprocess.run(args_pg,stdin=archive,check=False,timeout=1800).returncode
    if rc:
        raise SystemExit("Restore failed with exit code "+str(rc))
    print("Restore finished. Run migrations and verify records before starting worker.")


if __name__ == "__main__":
    main()
