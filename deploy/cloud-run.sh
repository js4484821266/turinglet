#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"
DEFAULT_MODEL_PATH="${REPO_ROOT}/local-llm/models/qwen2.5-0.5b-instruct-q4_k_m.gguf"

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${ENV_FILE}"
  fi
}

if [[ ! -f /etc/debian_version ]]; then
  echo "This script supports Debian/Ubuntu cloud hosts." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${REPO_ROOT}/.env.example" "${ENV_FILE}"
fi

mkdir -p "${REPO_ROOT}/local-llm/models"

MODEL_PATH="${HF_MODEL_PATH:-}"
if [[ -z "${MODEL_PATH}" ]]; then
  current_model_path="$(grep '^HF_MODEL_PATH=' "${ENV_FILE}" | tail -n 1 | cut -d= -f2- || true)"
  MODEL_PATH="${current_model_path:-${DEFAULT_MODEL_PATH}}"
fi

if [[ "${MODEL_PATH}" != /* ]]; then
  MODEL_PATH="${REPO_ROOT}/${MODEL_PATH}"
fi

if [[ ! -f "${MODEL_PATH}" ]]; then
  cat >&2 <<EOF
Model file is missing:
  ${MODEL_PATH}

Put a GGUF model file there, or run with:
  HF_MODEL_PATH=/absolute/path/to/model.gguf bash deploy/cloud-run.sh

This script does not download GGUF or safetensors files.
EOF
  exit 1
fi

upsert_env LLM_PROVIDER hf-local
upsert_env MOCK_PROVIDER false
upsert_env HF_LOCAL_URL http://127.0.0.1:8010
upsert_env HF_MODEL_PATH "${MODEL_PATH}"
upsert_env HF_ALLOW_MODEL_DOWNLOAD false

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required. Install Node.js 20+ before running this script." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required. Install Python 3 and venv support before running this script." >&2
  exit 1
fi

cd "${REPO_ROOT}"

npm ci
python3 -m venv .venv-llm
"${REPO_ROOT}/.venv-llm/bin/python" -m pip install --upgrade pip
"${REPO_ROOT}/.venv-llm/bin/pip" install -r "${REPO_ROOT}/local-llm/requirements.txt"

exec npm run dev:llm:debian
