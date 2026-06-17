#!/usr/bin/env bash
set -Eeuo pipefail

APP_SERVICE="saammaago-app"
LLM_SERVICE="saammaago-llm"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"
DEFAULT_MODEL_PATH="${REPO_ROOT}/local-llm/models/qwen2.5-0.5b-instruct-q4_k_m.gguf"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo: sudo bash deploy/cloud-run.sh" >&2
  exit 1
fi

if [[ ! -f /etc/debian_version ]]; then
  echo "This script supports Debian/Ubuntu cloud hosts." >&2
  exit 1
fi

DEPLOY_USER="${SUDO_USER:-root}"
DEPLOY_GROUP="$(id -gn "${DEPLOY_USER}")"
DEPLOY_HOME="$(getent passwd "${DEPLOY_USER}" | cut -d: -f6)"

run_as_deploy_user() {
  sudo -u "${DEPLOY_USER}" env HOME="${DEPLOY_HOME}" "$@"
}

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${ENV_FILE}"
  fi
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempts="$3"
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl -fsS --max-time 5 "${url}" >/dev/null; then
      echo "${name} is ready."
      return 0
    fi
    sleep 5
  done
  echo "${name} did not become ready: ${url}" >&2
  return 1
}

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${REPO_ROOT}/.env.example" "${ENV_FILE}"
fi

mkdir -p "${REPO_ROOT}/local-llm/models"

MODEL_PATH="${HF_MODEL_PATH:-}"
if [[ -z "${MODEL_PATH}" ]]; then
  current_model_path="$(grep '^HF_MODEL_PATH=' "${ENV_FILE}" | tail -n 1 | cut -d= -f2- || true)"
  MODEL_PATH="${current_model_path:-${DEFAULT_MODEL_PATH}}"
fi

ALLOW_MODEL_DOWNLOAD="${HF_ALLOW_MODEL_DOWNLOAD:-}"
if [[ -z "${ALLOW_MODEL_DOWNLOAD}" ]]; then
  ALLOW_MODEL_DOWNLOAD="$(grep '^HF_ALLOW_MODEL_DOWNLOAD=' "${ENV_FILE}" | tail -n 1 | cut -d= -f2- || true)"
fi
case "${ALLOW_MODEL_DOWNLOAD,,}" in
  1|true|yes|y|on) ALLOW_MODEL_DOWNLOAD="true" ;;
  *) ALLOW_MODEL_DOWNLOAD="false" ;;
esac

if [[ "${MODEL_PATH}" != /* ]]; then
  MODEL_PATH="${REPO_ROOT}/${MODEL_PATH}"
fi

if [[ ! -f "${MODEL_PATH}" && "${ALLOW_MODEL_DOWNLOAD}" != "true" ]]; then
  cat >&2 <<EOF
Model file is missing:
  ${MODEL_PATH}

Put a GGUF model file there, or run with:
  sudo env HF_MODEL_PATH=/absolute/path/to/model.gguf bash deploy/cloud-run.sh

Set HF_ALLOW_MODEL_DOWNLOAD=true only if you want the LLM service to try
downloading HF_MODEL_REPO / HF_MODEL_FILE during startup.
EOF
  exit 1
fi

upsert_env HF_LOCAL_URL http://127.0.0.1:8010
if [[ -f "${MODEL_PATH}" ]]; then
  upsert_env HF_MODEL_PATH "${MODEL_PATH}"
else
  upsert_env HF_MODEL_PATH ""
fi
upsert_env HF_ALLOW_MODEL_DOWNLOAD "${ALLOW_MODEL_DOWNLOAD}"
upsert_env PORT 80
chown "${DEPLOY_USER}:${DEPLOY_GROUP}" "${ENV_FILE}"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required. Install Node.js 20+ before running this script." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required. Install Python 3 and venv support before running this script." >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemd is required for cloud service mode." >&2
  exit 1
fi

echo "[1/5] Installing Node.js dependencies..."
run_as_deploy_user bash -lc "cd '${REPO_ROOT}' && npm ci"

echo "[2/5] Installing Python LLM dependencies..."
run_as_deploy_user python3 -m venv "${REPO_ROOT}/.venv-llm"
run_as_deploy_user "${REPO_ROOT}/.venv-llm/bin/python" -m pip install --upgrade pip
run_as_deploy_user "${REPO_ROOT}/.venv-llm/bin/pip" install -r "${REPO_ROOT}/local-llm/requirements.txt"

echo "[3/5] Building production assets and migrating SQLite..."
run_as_deploy_user bash -lc "cd '${REPO_ROOT}' && npm run build && npm run migrate"

NODE_BIN="$(command -v node)"
cat > "/etc/systemd/system/${LLM_SERVICE}.service" <<EOF
[Unit]
Description=Saammaago local GGUF LLM
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${DEPLOY_USER}
Group=${DEPLOY_GROUP}
WorkingDirectory=${REPO_ROOT}
EnvironmentFile=${ENV_FILE}
ExecStart=${REPO_ROOT}/.venv-llm/bin/python ${REPO_ROOT}/local-llm/server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > "/etc/systemd/system/${APP_SERVICE}.service" <<EOF
[Unit]
Description=Saammaago web application
After=network-online.target ${LLM_SERVICE}.service
Wants=network-online.target ${LLM_SERVICE}.service

[Service]
Type=simple
User=${DEPLOY_USER}
Group=${DEPLOY_GROUP}
WorkingDirectory=${REPO_ROOT}
Environment=NODE_ENV=production
EnvironmentFile=${ENV_FILE}
ExecStart=${NODE_BIN} ${REPO_ROOT}/backend/dist/src/server.js
Restart=always
RestartSec=5
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

echo "[4/5] Enabling and starting systemd services..."
systemctl daemon-reload
systemctl enable "${LLM_SERVICE}.service" "${APP_SERVICE}.service"
systemctl restart "${LLM_SERVICE}.service" "${APP_SERVICE}.service"

echo "[5/5] Waiting for services..."
if ! wait_for_url "LLM" "http://127.0.0.1:8010/health" 60; then
  journalctl -u "${LLM_SERVICE}" -n 80 --no-pager
  exit 1
fi
if ! wait_for_url "App" "http://127.0.0.1/api/health" 60; then
  journalctl -u "${APP_SERVICE}" -n 80 --no-pager
  exit 1
fi

echo
echo "Cloud services are running."
echo "Open: http://SERVER_IP"
echo "Status: sudo systemctl status ${APP_SERVICE} ${LLM_SERVICE}"
echo "Stop:   sudo systemctl stop ${APP_SERVICE} ${LLM_SERVICE}"
