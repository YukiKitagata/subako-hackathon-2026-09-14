#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
export PATH="$HOME/.local/bin:$PATH"

if ! command -v subako >/dev/null 2>&1; then
  cli_installer="$(mktemp)"
  trap 'rm -f "$cli_installer"' EXIT
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    https://github.com/subako-ai/subako-cli/releases/latest/download/subako-cli-installer.sh \
    --output "$cli_installer"
  # ターミナルのPATHはdevcontainer.jsonで設定します。
  SUBAKO_CLI_INSTALL_DIR="$HOME/.local/bin" SUBAKO_CLI_NO_MODIFY_PATH=1 sh "$cli_installer"
fi

subako --version
npm ci
npm run setup
