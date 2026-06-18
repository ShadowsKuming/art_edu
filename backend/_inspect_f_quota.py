"""
Read-only inspection of BLOOM-2026-F's projects and Part-3 video quota.

Walks each project's `snapshot` JSONB and reports every `remainingAttempts`
value it finds (with a short path), so we can see the exact quota state for
the g2v2-u4-l5 lesson before patching anything.

Usage:
    DATABASE_URL=postgresql://... python backend/_inspect_f_quota.py
"""
import json
import os
import sys

import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: set DATABASE_URL env var")
    sys.exit(1)

INVITE_CODE = "BLOOM-2026-F"


def walk_remaining(node, path="$"):
    """Yield (path, value) for every `remainingAttempts` key in the tree."""
    if isinstance(node, dict):
        for k, v in node.items():
            child = f"{path}.{k}"
            if k == "remainingAttempts":
                yield (child, v)
            else:
                yield from walk_remaining(v, child)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk_remaining(v, f"{path}[{i}]")


def find_lesson_id(meta, snapshot):
    """Best-effort extraction of a lesson id for display."""
    for src in (meta, snapshot):
        if isinstance(src, dict):
            for key in ("lessonId", "lesson_id", "lessonKey", "lesson"):
                if key in src and isinstance(src[key], str):
                    return src[key]
    return None


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute("SELECT id, display_name FROM users WHERE invite_code = %s", (INVITE_CODE,))
    row = cur.fetchone()
    if not row:
        print(f"No user found with invite_code={INVITE_CODE}")
        return
    user_id, display_name = row
    print(f"User: {INVITE_CODE}  id={user_id}  name={display_name!r}\n")

    cur.execute(
        "SELECT id, name, status, meta, snapshot, updated_at "
        "FROM projects WHERE user_id = %s ORDER BY updated_at DESC",
        (user_id,),
    )
    projects = cur.fetchall()
    print(f"{len(projects)} project(s):\n")

    for pid, name, status, meta, snapshot, updated_at in projects:
        lesson = find_lesson_id(meta, snapshot)
        print(f"── {pid}")
        print(f"   name={name!r}  status={status}  lesson={lesson}  updated={updated_at}")
        hits = list(walk_remaining(snapshot))
        if not hits:
            print("   remainingAttempts: (none found in snapshot)")
        else:
            for p, v in hits:
                # Trim very long paths for readability
                disp = p if len(p) < 110 else "…" + p[-107:]
                print(f"   remainingAttempts={v}   at {disp}")
        # Also surface any video URLs so we can sanity-check the missing video
        s = json.dumps(snapshot)
        if "generated/anim" in s:
            print("   (snapshot DOES reference generated/anim — video link present)")
        else:
            print("   (snapshot has NO generated/anim reference)")
        print()

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
