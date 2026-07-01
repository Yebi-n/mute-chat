#!/bin/sh
set -eux

REPOSITORY_PATH="${CI_PRIMARY_REPOSITORY_PATH:-$(pwd)}"
NODE_VERSION="${NODE_VERSION:-22.17.0}"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "Using repository path: $REPOSITORY_PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found; installing Node.js ${NODE_VERSION}."
  if command -v brew >/dev/null 2>&1; then
    if brew list "node@22" >/dev/null 2>&1 || brew install "node@22"; then
      export PATH="/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:$PATH"
    elif brew install node; then
      export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
    else
      echo "Homebrew Node.js install failed; falling back to official Node.js archive."
    fi
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  NODE_ARCH="$(uname -m)"
  case "$NODE_ARCH" in
    arm64) NODE_DIST_ARCH="arm64" ;;
    x86_64) NODE_DIST_ARCH="x64" ;;
    *) echo "error: Unsupported macOS architecture: $NODE_ARCH" >&2; exit 1 ;;
  esac
  NODE_DIR="$HOME/.cache/mute-node"
  NODE_TARBALL="node-v${NODE_VERSION}-darwin-${NODE_DIST_ARCH}.tar.gz"
  mkdir -p "$NODE_DIR"
  rm -rf "$NODE_DIR/node-v${NODE_VERSION}-darwin-${NODE_DIST_ARCH}"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}" -o "$NODE_DIR/${NODE_TARBALL}"
  tar -xzf "$NODE_DIR/${NODE_TARBALL}" -C "$NODE_DIR"
  export PATH="$NODE_DIR/node-v${NODE_VERSION}-darwin-${NODE_DIST_ARCH}/bin:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js could not be installed in Xcode Cloud image." >&2
  exit 1
fi

echo "Using Node.js: $(node --version)"
echo "Using npm: $(npm --version)"

if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods was not found; installing with RubyGems."
  gem install cocoapods --no-document --user-install
  export PATH="$(ruby -rrubygems -e 'print Gem.user_dir')/bin:$PATH"
fi

echo "Using CocoaPods: $(pod --version)"

cd "$REPOSITORY_PATH"
echo "Installing JavaScript dependencies."
npm ci

cd "$REPOSITORY_PATH/ios"
echo "Installing CocoaPods dependencies."
# Xcode Cloud can restore stale local podspecs after npm dependencies change.
# Rebuild the sandbox and synchronize all path-based Expo pods in one pass.
rm -rf Pods
pod update --no-repo-update --verbose

# React Native downloads both Debug and Release Hermes archives while resolving
# the podspec. Its upstream helper does not fail the pod install when one curl
# request is interrupted, which leaves Xcode archive builds without the Release
# xcframework. Validate and repair that artifact after CocoaPods finishes.
HERMES_VERSION="$(sed -n 's/^  - hermes-engine (\([^)]*\)).*/\1/p' Podfile.lock | head -n 1)"
if [ -z "$HERMES_VERSION" ]; then
  echo "error: Unable to resolve Hermes version from Podfile.lock." >&2
  exit 1
fi

HERMES_VERSION_LOWER="$(printf '%s' "$HERMES_VERSION" | tr '[:upper:]' '[:lower:]')"
HERMES_ARTIFACT_DIR="$REPOSITORY_PATH/ios/Pods/hermes-engine-artifacts"
HERMES_RELEASE_ARCHIVE="$HERMES_ARTIFACT_DIR/hermes-ios-${HERMES_VERSION_LOWER}-release.tar.gz"
HERMES_RELEASE_URL="https://repo1.maven.org/maven2/com/facebook/hermes/hermes-ios/${HERMES_VERSION}/hermes-ios-${HERMES_VERSION}-hermes-ios-release.tar.gz"

if [ ! -s "$HERMES_RELEASE_ARCHIVE" ] || ! tar -tzf "$HERMES_RELEASE_ARCHIVE" >/dev/null 2>&1; then
  echo "Repairing missing Hermes Release archive: $HERMES_VERSION"
  mkdir -p "$HERMES_ARTIFACT_DIR"
  HERMES_TEMP_ARCHIVE="${HERMES_RELEASE_ARCHIVE}.download"
  rm -f "$HERMES_TEMP_ARCHIVE"
  curl --fail --location \
    --retry 5 --retry-all-errors --retry-delay 2 \
    --connect-timeout 20 \
    "$HERMES_RELEASE_URL" \
    --output "$HERMES_TEMP_ARCHIVE"
  tar -tzf "$HERMES_TEMP_ARCHIVE" >/dev/null
  mv "$HERMES_TEMP_ARCHIVE" "$HERMES_RELEASE_ARCHIVE"
fi

echo "Hermes Release archive ready: $HERMES_RELEASE_ARCHIVE"
