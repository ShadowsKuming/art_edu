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

## Adding or changing codes

**Local / development** — edit `backend/.env`:
```
INVITE_CODES=BLOOM-2026-A,BLOOM-2026-B,BLOOM-2026-C
```

**Production (Render)** — go to the `artbloom-api` service → Environment → set:
```
INVITE_CODES=BLOOM-2026-A,BLOOM-2026-B,BLOOM-2026-C
```

Restart the service after changing. New codes are auto-created in the database on next startup.
