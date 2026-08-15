#!/usr/bin/env python3
"""Rewrite whitelist/ops UUIDs for a server running with ONLINE_MODE=FALSE.

An offline client presents UUID.nameUUIDFromBytes("OfflinePlayer:<name>"), but
`whitelist add` resolves the name through Mojang whenever the server has
internet — so the file records an id the player will never present, and the
whitelist check, which keys on UUID, rejects them.

Usage: offline-ids.py server/data/whitelist.json server/data/ops.json
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
    touched = 0
    for path in paths:
        if not os.path.exists(path):
            continue
        entries = json.load(io.open(path, encoding="utf-8"))

        # Re-adding a name after the switch leaves two entries for one player:
        # the Mojang id and the offline one. Keep the last of each name, then
        # correct its id, so the file converges however many times this runs.
        by_name: dict[str, dict] = {}
        for entry in entries:
            by_name[entry["name"].lower()] = entry
        deduped = list(by_name.values())

        changed = 0
        for entry in deduped:
            want = offline_uuid(entry["name"])
            if entry.get("uuid") != want:
                entry["uuid"] = want
                changed += 1

        io.open(path, "w", encoding="utf-8", newline="\n").write(
            json.dumps(deduped, indent=2) + "\n"
        )
        dropped = len(entries) - len(deduped)
        print(
            f"  {path}: {len(deduped)} entries"
            f"{f', {dropped} duplicate dropped' if dropped else ''}"
            f"{f', {changed} id rewritten' if changed else ''}"
        )
        touched += 1
    if not touched:
        print("  nothing to do — no whitelist or ops file yet")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
