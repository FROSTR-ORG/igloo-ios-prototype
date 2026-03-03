#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR"

echo "==> Installing JS dependencies (bun)"
if ! command -v bun >/dev/null 2>&1; then
  echo "==> bun not found; installing..."
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  curl -fsSL https://bun.sh/install | bash
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

bun install --frozen-lockfile

echo "==> Installing CocoaPods"
cd ios
pod install

if [[ ! -f "Pods/Target Support Files/Pods-Igloo/Pods-Igloo.release.xcconfig" ]]; then
  echo "ERROR: Expected CocoaPods xcconfig not found after pod install."
  exit 1
fi
