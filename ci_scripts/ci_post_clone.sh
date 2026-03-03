#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR"
mkdir -p "$REPO_DIR/.tmp"
export TMPDIR="$REPO_DIR/.tmp"
export CI=1

echo "==> Tool versions"
node -v || true
npm -v || true
bun --version || true
ruby --version || true
pod --version || true

echo "==> Installing JS dependencies"
if command -v bun >/dev/null 2>&1; then
  if ! bun install --frozen-lockfile; then
    echo "WARN: bun frozen install failed, retrying bun install"
    bun install || true
  fi
fi

if [ ! -d "node_modules" ]; then
  echo "==> Falling back to npm install"
  if command -v npm >/dev/null 2>&1; then
    if [ -f package-lock.json ]; then
      npm ci --no-audit --no-fund
    else
      npm install --no-audit --no-fund
    fi
  else
    echo "ERROR: Neither bun nor npm produced node_modules."
    exit 1
  fi
fi

if [ ! -d "node_modules" ]; then
  echo "ERROR: node_modules is missing after dependency install."
  exit 1
fi

echo "==> Installing CocoaPods dependencies"
cd ios
if ! command -v pod >/dev/null 2>&1; then
  echo "==> CocoaPods missing; attempting gem install"
  gem install cocoapods -N
fi

pod install --repo-update

if [ ! -f "Pods/Target Support Files/Pods-Igloo/Pods-Igloo.release.xcconfig" ]; then
  echo "ERROR: Expected Pods-Igloo.release.xcconfig was not generated."
  exit 1
fi
