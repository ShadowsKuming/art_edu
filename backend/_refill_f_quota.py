"""
Refill BLOOM-2026-F's Part-3 video-generation quota to 3 for a given lesson.

Quota model (confirmed): there is NO server-side quota. The budget lives in
the frontend Part-3 store as `remainingAttempts` (default 3, *per artwork
pair*) and is persisted inside `projects.snapshot` (JSONB) — in both the
"flat" Part-3 fields and every per-artwork "slot". The DB is the source of
truth, so resetting `remainingAttempts` to 3 there and reloading restores the
budget.

This script:
  • finds F's projects for the target lesson,
  • backs up each matching snapshot to a local JSON file,
  • deep-walks the snapshot and sets every `remainingAttempts` to 3,
  • writes it back (only with --apply; default is a safe dry-run).

It touches ONLY `remainingAttempts`. It does NOT modify animationVersions,
chosenVideoUrl, or any other field (per the "quota only" decision).

Usage:
    # Dry run (no writes) — shows exactly what would change:
    DATABASE_URL=postgresql://... python _refill_f_quota.py

    # Apply the change:
    DATABASE_URL=postgresql://... python _refill_f_quota.py --apply

Optional overrides:
    INVITE_CODE=BLOOM-2026-F   LESSON=g2v2-u4-l5
"""
import json
import os
import sys
from datetime import datetime

import psycopg2
from psycopg2.extras import Json

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: set DATABASE_URL env var")
    sys.exit(1)

INVITE_CODE = os.environ.get("INVITE_CODE", "BLOOM-2026-F")
LESSON = os.environ.get("LESSON", "g2v2-u4-l5").lower()
APPLY = "--apply" in sys.argv
NEW_QUOTA = 3


def set_remaining(node, new_value):
    """Recursively set every `remainingAttempts` to `new_value`.
    Returns list of (path, old_value)."""
    changed = []

    def walk(n, path="$"):
        if isinstance(n, dict):
            for k in list(n.keys()):
                child = f"{path}.{k}"
                if k == "remainingAttempts":
                    if n[k] != new_value:
                        changed.append((child, n[k]))
                    n[k] = new_value
                else:
                    walk(n[k], child)
        elif isinstance(n, list):
            for i, v in enumerate(n):
                walk(v, f"{path}[{i}]")

    walk(node)
    return changed


def project_matches_lesson(meta, snapshot):
    """True if this project belongs to the target lesson (substring match
    on the lesson id anywhere in meta/snapshot, case-insensitive)."""
    blob = json.dumps([meta, snapshot]).lower()
    return LESSON in blob


def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    cur.execute("SELECT id, display_name FROM users WHERE invite_code = %s", (INVITE_CODE,))
    row = cur.fetchone()
    if not row:
        print(f"No user found with invite_code={INVITE_CODE}")
        return
    user_id, display_name = row
    print(f"User: {INVITE_CODE}  id={user_id}  name={display_name!r}")
    print(f"Target lesson substring: {LESSON!r}")
    print(f"Mode: {'APPLY (will write)' if APPLY else 'DRY-RUN (no writes)'}\n")

    cur.execute(
        "SELECT id, name, status, meta, snapshot, updated_at "
        "FROM projects WHERE user_id = %s ORDER BY updated_at DESC",
        (user_id,),
    )
    projects = cur.fetchall()
    print(f"{len(projects)} project(s) total for this user.\n")

    matched = 0
    patched = 0
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")

    for pid, name, status, meta, snapshot, updated_at in projects:
        is_match = project_matches_lesson(meta, snapshot)
        flag = "MATCH" if is_match else "skip "
        print(f"[{flag}] {pid}  name={name!r}  status={status}  updated={updated_at}")
        if not is_match:
            continue
        matched += 1

        # Backup before touching anything
        backup_path = f"backup_{INVITE_CODE}_{pid}_{ts}.json"
        with open(backup_path, "w") as f:
            json.dump(snapshot, f)
        print(f"        backup -> {backup_path}")

        changed = set_remaining(snapshot, NEW_QUOTA)
        if not changed:
            print("        remainingAttempts already 3 everywhere — nothing to change.")
            continue

        for p, old in changed:
            disp = p if len(p) < 110 else "…" + p[-107:]
            print(f"        {disp}: {old} -> {NEW_QUOTA}")

        if APPLY:
            cur.execute(
                "UPDATE projects SET snapshot = %s, updated_at = now() WHERE id = %s",
                (Json(snapshot), pid),
            )
            patched += 1
            print("        WROTE update.")
        else:
            print("        (dry-run — not written)")
        print()

    if APPLY:
        conn.commit()
        print(f"\nDONE. Matched {matched} project(s); wrote {patched}.")
    else:
        conn.rollback()
        print(f"\nDRY-RUN complete. Matched {matched} project(s). "
              f"Re-run with --apply to write.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
