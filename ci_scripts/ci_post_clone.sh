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
JS_OK=0

if command -v bun >/dev/null 2>&1; then
  if run bun install --frozen-lockfile; then
    JS_OK=1
  else
    echo "WARN: bun frozen install failed, retrying bun install"
    if run bun install; then
      JS_OK=1
    fi
  fi
fi

if [ "$JS_OK" -ne 1 ]; then
  echo "==> Falling back to npm install (legacy peer deps)"
  if command -v npm >/dev/null 2>&1; then
    rm -rf node_modules
    if [ -f package-lock.json ]; then
      run npm ci --legacy-peer-deps --no-audit --no-fund && JS_OK=1
    else
      run npm install --legacy-peer-deps --no-audit --no-fund && JS_OK=1
    fi
  else
    echo "ERROR: Neither bun nor npm produced node_modules."
    exit 1
  fi
fi

if [ "$JS_OK" -ne 1 ]; then
  echo "ERROR: JavaScript dependency install did not complete successfully."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "ERROR: node_modules is missing after successful dependency install."
  exit 1
fi

echo "==> Installing CocoaPods dependencies"
cd ios
if ! command -v pod >/dev/null 2>&1; then
  echo "WARN: CocoaPods command not found in PATH; trying gem user install"
  if command -v gem >/dev/null 2>&1; then
    GEM_BIN_DIR="$HOME/.gem/ruby/$(ruby -e 'print RbConfig::CONFIG[\"ruby_version\"]')/bin"
    run gem install cocoapods -N --user-install
    export PATH="$GEM_BIN_DIR:$PATH"
  fi
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "ERROR: CocoaPods command 'pod' is still not available after fallback."
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
