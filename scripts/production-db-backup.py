#!/usr/bin/env python3
"""Back up an existing PostgreSQL database as a non-public, 0600 custom-format archive.

Migrate data from a preexisting PostgreSQL service into the Compose DB without
embedding credentials in process arguments, logs, or Git. Does not stop services.
"""
import argparse
import os
import pathlib
import subprocess
import sys
import urllib.parse
from datetime import datetime, timezone


def read_source_url(file: pathlib.Path) -> str:
    for line in file.read_text().splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() == "DATABASE_URL":
            return value.strip().strip('"').strip("'")
    raise RuntimeError("Missing DATABASE_URL in source environment file")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-env", type=pathlib.Path, required=True)
    parser.add_argument("--output-dir", type=pathlib.Path, required=True)
    args = parser.parse_args()
    url = urllib.parse.urlparse(read_source_url(args.source_env))
    if url.scheme not in ("postgres", "postgresql") or not url.hostname or not url.path:
        raise RuntimeError("DATABASE_URL must be a valid PostgreSQL URL")
    args.output_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(args.output_dir, 0o700)
    archive = args.output_dir / ("livingruntime-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".dump")
    # Create before invoking pg_dump, so the file is never world-readable.
    with archive.open("xb") as output:
        os.chmod(archive, 0o600)
        env = dict(os.environ, PGPASSWORD=urllib.parse.unquote(url.password or ""))
        argv = ["pg_dump", "-Fc", "--no-owner", "--no-acl",
                "-h", url.hostname, "-p", str(url.port or 5432),
                "-U", urllib.parse.unquote(url.username or ""),
                "-d", urllib.parse.unquote(url.path.lstrip("/"))]
        # pg_dump writes the custom archive to stdout.
        result = subprocess.run(argv, env=env, stdout=output, timeout=1200, check=False)
    if result.returncode:
        archive.unlink(missing_ok=True)
        raise SystemExit("PostgreSQL backup failed with exit " + str(result.returncode))
    if archive.stat().st_size < 1024:
        archive.unlink(missing_ok=True)
        raise RuntimeError("Backup is unexpectedly small")
    print("Backup complete:", archive, "bytes:", archive.stat().st_size)


if __name__ == "__main__":
    main()
