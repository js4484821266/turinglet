#!/usr/bin/env bash
set -Eeuo pipefail

APP_SERVICE="saammaago-app"
LLM_SERVICE="saammaago-llm"
MODEL_REPO="bartowski/Qwen2.5-1.5B-Instruct-GGUF"
MODEL_FILE="Qwen2.5-1.5B-Instruct-Q4_K_M.gguf"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo: sudo bash deploy/debian-gcp.sh" >&2
  exit 1
fi

if [[ ! -f /etc/debian_version ]]; then
  echo "This deployment script supports Debian and Ubuntu only." >&2
  exit 1
fi

DEPLOY_USER="${SUDO_USER:-root}"
DEPLOY_GROUP="$(id -gn "${DEPLOY_USER}")"
DEPLOY_HOME="$(getent passwd "${DEPLOY_USER}" | cut -d: -f6)"
ENV_FILE="${REPO_ROOT}/.env"

run_as_deploy_user() {
  sudo -u "${DEPLOY_USER}" env HOME="${DEPLOY_HOME}" "$@"
}

set_env_value() {
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

echo "[1/8] Installing Debian packages..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  build-essential ca-certificates cmake curl git libopenblas-dev ninja-build \
  pkg-config python3 python3-dev python3-pip python3-venv sudo

NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
fi
if (( NODE_MAJOR < 20 )); then
  echo "[2/8] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
else
  echo "[2/8] Node.js $(node --version) is already available."
fi

echo "[3/8] Preparing environment configuration..."
if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${REPO_ROOT}/.env.example" "${ENV_FILE}"
fi
set_env_value PORT 80
set_env_value DB_PROVIDER sqlite
set_env_value SQLITE_PATH ./database/local-dev.db
set_env_value MOCK_PROVIDER false
set_env_value LLM_PROVIDER hf-local
set_env_value HF_LOCAL_URL http://127.0.0.1:8010
set_env_value HF_LOCAL_HOST 127.0.0.1
set_env_value HF_LOCAL_PORT 8010
set_env_value HF_LOCAL_TIMEOUT_MS 120000
set_env_value HF_MODEL_PATH ""
set_env_value HF_ALLOW_MODEL_DOWNLOAD true
set_env_value HF_MODEL_CACHE_DIR ./local-llm/models
set_env_value HF_MODEL_REPO "${MODEL_REPO}"
set_env_value HF_MODEL_FILE "${MODEL_FILE}"
chown "${DEPLOY_USER}:${DEPLOY_GROUP}" "${ENV_FILE}"

echo "[4/8] Installing Node.js and Python dependencies..."
run_as_deploy_user bash -lc "cd '${REPO_ROOT}' && npm ci"
run_as_deploy_user python3 -m venv "${REPO_ROOT}/.venv-llm"
run_as_deploy_user "${REPO_ROOT}/.venv-llm/bin/python" -m pip install --upgrade pip wheel
run_as_deploy_user env \
  CMAKE_ARGS="-DGGML_BLAS=ON -DGGML_BLAS_VENDOR=OpenBLAS" \
  "${REPO_ROOT}/.venv-llm/bin/pip" install -r "${REPO_ROOT}/local-llm/requirements.txt"

echo "[5/8] Downloading the default GGUF model..."
run_as_deploy_user env \
  MODEL_REPO="${MODEL_REPO}" \
  MODEL_FILE="${MODEL_FILE}" \
  MODEL_CACHE_DIR="${REPO_ROOT}/local-llm/models" \
  "${REPO_ROOT}/.venv-llm/bin/python" -c \
  'import os; from huggingface_hub import hf_hub_download; print(hf_hub_download(repo_id=os.environ["MODEL_REPO"], filename=os.environ["MODEL_FILE"], cache_dir=os.environ["MODEL_CACHE_DIR"]))'

echo "[6/8] Building the application and migrating SQLite..."
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

echo "[7/8] Enabling systemd services..."
systemctl daemon-reload
systemctl enable --now "${LLM_SERVICE}.service" "${APP_SERVICE}.service"

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q '^Status: active'; then
  ufw allow 80/tcp
fi

echo "[8/8] Waiting for services..."
if ! wait_for_url "GGUF LLM" "http://127.0.0.1:8010/health" 180; then
  journalctl -u "${LLM_SERVICE}" -n 80 --no-pager
  exit 1
fi
if ! wait_for_url "Saammaago app" "http://127.0.0.1/api/health" 60; then
  journalctl -u "${APP_SERVICE}" -n 80 --no-pager
  exit 1
fi

EXTERNAL_IP="$(curl -fsS -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip' || true)"

echo
echo "Deployment complete."
if [[ -n "${EXTERNAL_IP}" ]]; then
  echo "Open: http://${EXTERNAL_IP}"
else
  echo "Open the VM external IP in a browser: http://EXTERNAL_IP"
fi
echo "If it is unreachable, allow GCP VPC ingress TCP 80 for this VM."
echo "Admin key: ${REPO_ROOT}/runtime/achrai-admin-key.bmp"
