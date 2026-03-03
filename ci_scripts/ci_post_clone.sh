#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR"

# Ensure package managers have a writable temp directory in CI environments.
mkdir -p "$REPO_DIR/.tmp"
export TMPDIR="$REPO_DIR/.tmp"
export CI=1

on_error() {
  local line="$1"
  echo "ERROR: ci_post_clone failed at line ${line}"
}
trap 'on_error $LINENO' ERR

run_or_warn() {
  local description="$1"
  shift
  if ! "$@"; then
    echo "WARN: ${description} failed; continuing with fallback path"
    return 1
  fi
}

echo "==> Installing JS dependencies (bun)"
if ! command -v bun >/dev/null 2>&1; then
  echo "==> bun not found; installing..."
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  if run_or_warn "bun bootstrap" bash -lc "curl -fsSL https://bun.sh/install | bash"; then
    export PATH="$BUN_INSTALL/bin:$PATH"
  fi
fi

if command -v bun >/dev/null 2>&1; then
  if ! run_or_warn "bun install --frozen-lockfile" bun install --frozen-lockfile; then
    echo "==> bun install --frozen-lockfile failed; retrying with bun install"
    if ! run_or_warn "bun install" bun install; then
      echo "==> bun install failed; falling back to npm"
      if command -v npm >/dev/null 2>&1; then
        if [[ -f package-lock.json ]]; then
          npm ci --no-audit --no-fund
        else
          npm install --no-audit --no-fund
        fi
      else
        echo "ERROR: Neither bun nor npm is available for JS dependency install."
        exit 1
      fi
    fi
  fi
else
  echo "==> bun is unavailable after install attempt; falling back to npm"
  if ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: npm is not available for JS dependency install."
    exit 1
  fi
  if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
fi

echo "==> Installing CocoaPods"
cd ios
if ! command -v pod >/dev/null 2>&1; then
  echo "ERROR: CocoaPods command 'pod' is not available in CI environment."
  exit 1
fi

if ! run_or_warn "pod install" pod install; then
  echo "==> Retrying pod install with --repo-update"
  pod install --repo-update
fi

if [[ ! -f "Pods/Target Support Files/Pods-Igloo/Pods-Igloo.release.xcconfig" ]]; then
  echo "ERROR: Expected CocoaPods xcconfig not found after pod install."
  exit 1
fi
