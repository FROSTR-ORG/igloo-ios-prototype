#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR"
mkdir -p "$REPO_DIR/.tmp"
export TMPDIR="$REPO_DIR/.tmp"
export CI=1
export COCOAPODS_DISABLE_STATS=1

run() {
  echo "==> $*"
  "$@"
}

echo "==> Tool versions"
node -v || true
npm -v || true
bun --version || true
ruby --version || true
pod --version || true

echo "==> Installing JS dependencies"
if command -v bun >/dev/null 2>&1; then
  if ! run bun install --frozen-lockfile; then
    echo "WARN: bun frozen install failed, retrying bun install"
    run bun install || true
  fi
fi

if [ ! -d "node_modules" ]; then
  echo "==> Falling back to npm install (legacy peer deps)"
  if command -v npm >/dev/null 2>&1; then
    if [ -f package-lock.json ]; then
      run npm ci --legacy-peer-deps --no-audit --no-fund
    else
      run npm install --legacy-peer-deps --no-audit --no-fund
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
  echo "ERROR: CocoaPods command 'pod' is not available in this Xcode Cloud environment."
  exit 1
fi

if ! run pod install; then
  echo "WARN: pod install failed, retrying with --repo-update"
  run pod install --repo-update
fi

if [ ! -f "Pods/Target Support Files/Pods-Igloo/Pods-Igloo.release.xcconfig" ]; then
  echo "ERROR: Expected Pods-Igloo.release.xcconfig was not generated."
  ls -la "Pods/Target Support Files" || true
  exit 1
fi
