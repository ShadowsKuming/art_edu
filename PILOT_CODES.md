# ArtBloom Pilot — Invitation Codes

These codes are used to access the ArtBloom platform.
Each code represents one unique user account shared across all devices.

| Code | User | Notes |
|------|------|-------|
| `BLOOM-2026-A` | Teacher 1 | |
| `BLOOM-2026-B` | Teacher 2 | |
| `BLOOM-2026-C` | Teacher 3 | |

## How codes work

- One code = one user account in the database.
- The same code can be entered on multiple devices — all devices share the same projects and data.
- An unknown or unlisted code will be rejected with "Invalid invitation code".
- Codes are case-insensitive (`bloom-2026-a` and `BLOOM-2026-A` are the same).

## Adding a new code

Each code is its own numbered environment variable — adding one never requires editing the existing ones.

**Local / development** — add a line to `backend/.env`:
```
INVITE_CODE_1=BLOOM-2026-A
INVITE_CODE_2=BLOOM-2026-B
INVITE_CODE_3=BLOOM-2026-C
INVITE_CODE_4=NEW-CODE-HERE   ← just add the next number
```

**Production (Render)** — go to `artbloom-api` service → Environment → add:
```
Key: INVITE_CODE_4
Value: NEW-CODE-HERE
```
No need to touch `INVITE_CODE_1`, `_2`, or `_3`. Redeploy after adding — the new user is created in the database automatically on next startup.
