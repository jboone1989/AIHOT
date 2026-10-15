#!/usr/bin/env python3
"""Prepare the *private* Compose production environment without exposing secrets.

Use on an already-created 0600 release .env that contains production API/auth
settings. This does not modify the old site's configuration or start services.
"""
from pathlib import Path
import argparse
import os
import re
import secrets
import subprocess


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", required=True, type=Path)
    parser.add_argument("--port", type=int, default=13000)
    args = parser.parse_args()
    if not args.env_file.is_file():
        raise RuntimeError("Create the release's private .env before running")
    if args.port < 1024 or args.port > 65535:
        raise RuntimeError("Staging port must be an unprivileged valid port")
    data = args.env_file.read_text()
    env = {}
    for line in data.splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, val = line.split("=",1)
            env[key.strip()] = val.strip().strip('"').strip("'")
    if env.get("ADSENSE_VERIFICATION_ENABLED") == "true":
        raise RuntimeError("AdSense verification must remain off before approval")
    password = env.get("POSTGRES_PASSWORD", "")
    if not password:
        password = secrets.token_hex(24)
        data += "\nPOSTGRES_PASSWORD=" + password + "\n"
    if password.lower() in {"aihot", "postgres", "password", "changeme", "test"} or len(password) < 24:
        raise RuntimeError("Weak POSTGRES_PASSWORD")
    commit = subprocess.check_output(["git", "rev-parse", "--short=7", "HEAD"], text=True).strip()
    for key, value in [("ADSENSE_VERIFICATION_ENABLED","false"),("LRSITE_RELEASE",commit),("LRSITE_PORT",str(args.port))]:
        if key in env:
            if env[key] != value:
                raise RuntimeError(key + " differs from intended staging configuration; update it manually")
        else:
            data += key + "=" + value + "\n"
    args.env_file.write_text(data)
    os.chmod(args.env_file, 0o600)
    print("Production staging .env ready (no secrets printed), release:",commit,"port:",args.port)


if __name__ == "__main__":
    main()
