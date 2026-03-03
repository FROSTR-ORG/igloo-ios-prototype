#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR"

# Ensure package managers have a writable temp directory in CI environments.
mkdir -p "$REPO_DIR/.tmp"
export TMPDIR="$REPO_DIR/.tmp"

echo "==> Installing JS dependencies (bun)"
if ! command -v bun >/dev/null 2>&1; then
  echo "==> bun not found; installing..."
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  curl -fsSL https://bun.sh/install | bash
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

if command -v bun >/dev/null 2>&1; then
  if ! bun install --frozen-lockfile; then
    echo "==> bun install --frozen-lockfile failed; retrying with bun install"
    if ! bun install; then
      echo "==> bun install failed; falling back to npm"
      if [[ -f package-lock.json ]]; then
        npm ci --no-audit --no-fund
      else
        npm install --no-audit --no-fund
      fi
    fi
  fi
else
  echo "==> bun is unavailable after install attempt; falling back to npm"
  if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
fi

echo "==> Installing CocoaPods"
cd ios
pod install

if [[ ! -f "Pods/Target Support Files/Pods-Igloo/Pods-Igloo.release.xcconfig" ]]; then
  echo "ERROR: Expected CocoaPods xcconfig not found after pod install."
  exit 1
fi
