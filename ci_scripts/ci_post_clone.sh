#!/bin/sh
set -eu

REPOSITORY_PATH="${CI_PRIMARY_REPOSITORY_PATH:-$(pwd)}"

echo "Using repository path: $REPOSITORY_PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found; installing with Homebrew."
  brew install node
else
  echo "Using Node.js: $(node --version)"
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods was not found; installing with Homebrew."
  brew install cocoapods
else
  echo "Using CocoaPods: $(pod --version)"
fi

cd "$REPOSITORY_PATH"
echo "Installing JavaScript dependencies."
npm ci

cd ios
echo "Installing CocoaPods dependencies."
pod install
