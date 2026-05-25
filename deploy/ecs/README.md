# ArtBloom — ECS deployment

Production deployment for the FastAPI backend on **Alibaba Cloud ECS (Hong Kong region)** behind **Caddy** with auto-renewed Let's Encrypt certificates.

Canonical runbook lives in [`KNOWLEDGE_BANK.md §19`](../../KNOWLEDGE_BANK.md); this README is the in-repo crib sheet.

## Files

| File                     | Role                                                                                              |
|--------------------------|---------------------------------------------------------------------------------------------------|
| `bootstrap.sh`           | One-shot, idempotent installer. Run once on a fresh VM (re-runnable for repair).                  |
| `deploy.sh`              | Cron-polled updater. Installed by bootstrap to run every 5 min from root's crontab.               |
| `Caddyfile`              | Caddy reverse-proxy template. `__DOMAIN__` is substituted at bootstrap time.                      |
| `artbloom-api.service`   | systemd unit template. `__INSTALL_DIR__` + `__USER__` substituted at bootstrap time.              |

## First-time bootstrap

On a fresh Ubuntu 22.04 ECS in Hong Kong with ports 22 + 80 + 443 open, SSH in as root and run:

```bash
curl -fsSL https://raw.githubusercontent.com/ShadowsKuming/art_edu/main/deploy/ecs/bootstrap.sh \
  | ARK_API_KEY="ark-xxxxxxxxxxxx" \
    DOMAIN="api.artbloomedu.com" \
    TEXTBOOK_ASSETS_URL="https://pub-xxxxxxxx.r2.dev" \
    bash
```

DNS prerequisite: an `A` record for `api.artbloomedu.com` pointing at the ECS public IP must already resolve from the public internet (give it 30-60 s to propagate). Caddy needs this for the Let's Encrypt HTTP-01 challenge.

After bootstrap finishes, give Caddy ~30 s to fetch the cert, then:

```bash
curl -s https://api.artbloomedu.com/health | jq .
# → { "ok": true, "api_key_set": true, "tts_voices": 6, ... }
```

## Subsequent deploys

`git push origin main` — that's it. The cron job picks up the new commit within 5 minutes and restarts the API. Verify with:

```bash
ssh root@<ecs-ip> 'tail -20 /var/log/artbloom-deploy.log'
```

Force an immediate deploy (e.g. you don't want to wait):

```bash
ssh root@<ecs-ip> '/opt/artbloom/deploy/ecs/deploy.sh'
```

## Operational commands

```bash
# Service control
systemctl status artbloom-api caddy
systemctl restart artbloom-api
journalctl -u artbloom-api -f
journalctl -u caddy -f

# Manual config reload after editing Caddyfile or systemd unit
sed "s|__DOMAIN__|api.artbloomedu.com|g" /opt/artbloom/deploy/ecs/Caddyfile > /etc/caddy/Caddyfile
caddy reload --config /etc/caddy/Caddyfile

# Rotate the ARK_API_KEY: edit /opt/artbloom/backend/.env, then:
systemctl restart artbloom-api
```

## Troubleshooting

| Symptom                                          | Cause                                                  | Fix                                                                                          |
|--------------------------------------------------|--------------------------------------------------------|----------------------------------------------------------------------------------------------|
| `curl https://api.artbloomedu.com/health` hangs  | DNS A record not propagated, or port 443 blocked       | `dig api.artbloomedu.com` from your laptop; check the ECS security group inbound rules       |
| `caddy` logs "challenge failed" / cert never issued | DNS not pointing here yet, or port 80 closed         | Verify DNS, open 80 in security group, then `systemctl restart caddy`                        |
| `artbloom-api` won't start, journal says `ARK_API_KEY is not set` | `.env` missing or wrong perms                | `cat /opt/artbloom/backend/.env`, ensure owner is `artbloom`, mode 600                       |
| `502 Bad Gateway` from Caddy                     | uvicorn crashed                                         | `journalctl -u artbloom-api -n 50` to read the Python traceback                              |
| `deploy.sh` runs every 5 min but doesn't pick up new commits | repo permissions wrong, or branch mismatch  | `tail /var/log/artbloom-deploy.log` for the git error; verify `BRANCH=main` matches origin   |

## Security notes

- `backend/.env` is mode 600, owned by the `artbloom` service user. Root can read it; nobody else can.
- The systemd unit runs uvicorn under `artbloom`, never root, with `NoNewPrivileges` + `ProtectSystem=strict`.
- Caddy listens on 80 + 443 only; uvicorn binds `127.0.0.1:8001` so it's not reachable from outside the VM.
- `CORS_ALLOW_ORIGINS=*` is fine for a 2-user dev pilot — lock down to `https://artbloomedu.com,https://www.artbloomedu.com` once Pages is wired (edit `.env` + `systemctl restart artbloom-api`).
