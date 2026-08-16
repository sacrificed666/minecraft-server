#!/usr/bin/env python3
"""Correct whitelist/ops ids for a server running with ONLINE_MODE=FALSE.

An offline client presents UUID.nameUUIDFromBytes("OfflinePlayer:<name>"), built
from the name exactly as typed. The server disagrees with itself about it: the
seeding that OPS goes through folds the name to lower case first, so anyone with
a capital letter is written under an id they will never present.

The admin panel writes whitelist.json itself and gets this right. This is for
what the panel did not put there: ops.json, and anything added from the console.
Canonical spellings arrive on stdin, one per line — without a match, the stored
spelling is all there is to go on.

Usage: offline-ids.py server/data/whitelist.json server/data/ops.json < names
"""

import hashlib
import io
import json
import os
import sys
import uuid


def offline_uuid(name: str) -> str:
    digest = bytearray(hashlib.md5(f"OfflinePlayer:{name}".encode()).digest())
    digest[6] = (digest[6] & 0x0F) | 0x30  # version 3
    digest[8] = (digest[8] & 0x3F) | 0x80  # IETF variant
    return str(uuid.UUID(bytes=bytes(digest)))


def main(paths: list[str]) -> int:
    canonical = {}
    if not sys.stdin.isatty():
        for line in sys.stdin:
            name = line.strip()
            if name:
                canonical[name.lower()] = name

    report = []
    for path in paths:
        if not os.path.exists(path):
            continue
        try:
            entries = json.load(io.open(path, encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        # Re-adding a name leaves two entries for one player. Keep the last of
        # each, so the file converges however many times this runs.
        deduped = list({e["name"].lower(): e for e in entries}.values())

        changed = 0
        for entry in deduped:
            name = canonical.get(entry["name"].lower(), entry["name"])
            want = offline_uuid(name)
            if entry.get("uuid") != want or entry["name"] != name:
                entry["name"], entry["uuid"] = name, want
                changed += 1

        dropped = len(entries) - len(deduped)
        if changed or dropped:
            io.open(path, "w", encoding="utf-8", newline="\n").write(
                json.dumps(deduped, indent=2) + "\n"
            )
            report.append(
                f"  {os.path.basename(path)}: {changed} corrected"
                + (f", {dropped} duplicate dropped" if dropped else "")
            )

    if report:
        print("\n".join(report))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
