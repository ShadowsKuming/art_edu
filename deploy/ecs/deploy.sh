#!/usr/bin/env bash
#
# ArtBloom — cron-polled auto-deploy.
# Installed by bootstrap.sh as `*/5 * * * *` in root's crontab.
# Cheap no-op when origin/main hasn't moved.

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/artbloom}"
SERVICE_USER="${SERVICE_USER:-artbloom}"
BRANCH="${BRANCH:-main}"

cd "$INSTALL_DIR"

CURRENT=$(sudo -u "$SERVICE_USER" git -C "$INSTALL_DIR" rev-parse HEAD)
sudo -u "$SERVICE_USER" git -C "$INSTALL_DIR" fetch --quiet origin "$BRANCH"
LATEST=$(sudo -u "$SERVICE_USER" git -C "$INSTALL_DIR" rev-parse "origin/$BRANCH")

if [[ "$CURRENT" == "$LATEST" ]]; then
    exit 0
fi

echo "[$(date -Is)] deploy: $CURRENT → $LATEST"

sudo -u "$SERVICE_USER" git -C "$INSTALL_DIR" reset --quiet --hard "$LATEST"

# Refresh dependencies in case requirements.txt changed (no-op when unchanged
# thanks to pip's hash cache).
sudo -u "$SERVICE_USER" "$INSTALL_DIR/.venv/bin/pip" install --quiet \
    -r "$INSTALL_DIR/backend/requirements.txt"

# Re-render systemd unit + Caddyfile in case the templates changed.
# (.env stays untouched — it's outside git.)
if [[ -f /etc/systemd/system/artbloom-api.service ]]; then
    # Pull the existing User / WorkingDirectory paths so we don't lose them.
    EXISTING_USER=$(awk -F= '/^User=/{print $2; exit}' /etc/systemd/system/artbloom-api.service)
    EXISTING_DIR=$(awk -F= '/^WorkingDirectory=/{sub(/\/backend$/, "", $2); print $2; exit}' /etc/systemd/system/artbloom-api.service)
    sed -e "s|__INSTALL_DIR__|${EXISTING_DIR:-$INSTALL_DIR}|g" \
        -e "s|__USER__|${EXISTING_USER:-$SERVICE_USER}|g" \
        "$INSTALL_DIR/deploy/ecs/artbloom-api.service" \
        > /etc/systemd/system/artbloom-api.service
fi

# Restart the API; Caddy stays running (its config rarely changes).
systemctl daemon-reload
systemctl restart artbloom-api.service

# Health check after restart — fail loudly if it didn't come up.
sleep 3
if ! curl -fsS http://127.0.0.1:8001/health >/dev/null; then
    echo "[$(date -Is)] WARN: /health did not respond after restart"
    systemctl status artbloom-api.service --no-pager | tail -20
fi

echo "[$(date -Is)] deploy: done"
