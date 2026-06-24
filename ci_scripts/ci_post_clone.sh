#!/bin/sh
set -e

# Xcode Cloud's build image has no Node.js preinstalled; install it.
brew install node

# CocoaPods is usually preinstalled on Xcode Cloud, but install it if missing.
if ! command -v pod >/dev/null 2>&1; then
  brew install cocoapods
fi

# Install JS dependencies at the repository root.
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm ci

# Install CocoaPods dependencies.
cd ios
pod install
