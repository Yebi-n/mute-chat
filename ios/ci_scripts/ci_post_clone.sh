#!/bin/sh
set -eux

REPOSITORY_PATH="${CI_PRIMARY_REPOSITORY_PATH:-$(pwd)}"

echo "Using repository path: $REPOSITORY_PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js was not found in Xcode Cloud image." >&2
  exit 1
else
  echo "Using Node.js: $(node --version)"
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "error: CocoaPods was not found in Xcode Cloud image." >&2
  exit 1
else
  echo "Using CocoaPods: $(pod --version)"
fi

cd "$REPOSITORY_PATH"
echo "Installing JavaScript dependencies."
npm ci

cd "$REPOSITORY_PATH/ios"
echo "Installing CocoaPods dependencies."
pod install --verbose
