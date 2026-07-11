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

if ! command -v cmake >/dev/null 2>&1; then
  echo "cmake was not found; installing cmake."
  if command -v brew >/dev/null 2>&1; then
    brew list cmake >/dev/null 2>&1 || brew install cmake
    HOMEBREW_PREFIX="$(brew --prefix 2>/dev/null || true)"
    CMAKE_PREFIX="$(brew --prefix cmake 2>/dev/null || true)"
    [ -n "$HOMEBREW_PREFIX" ] && export PATH="$HOMEBREW_PREFIX/bin:$PATH"
    [ -n "$CMAKE_PREFIX" ] && export PATH="$CMAKE_PREFIX/bin:$PATH"
    export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  else
    echo "error: Homebrew is required to install cmake in Xcode Cloud." >&2
    exit 1
  fi
fi

if ! command -v cmake >/dev/null 2>&1; then
  echo "error: cmake is still unavailable after install." >&2
  exit 1
fi

echo "Using cmake: $(cmake --version | head -n 1)"

cd "$REPOSITORY_PATH"
echo "Installing JavaScript dependencies."
npm ci

cd "$REPOSITORY_PATH/ios"
echo "Installing CocoaPods dependencies."
# Xcode Cloud can restore stale local podspecs after npm dependencies change.
# Rebuild the sandbox and synchronize all path-based Expo pods in one pass.
rm -rf Pods

# React Native's Hermes podspec downloads Debug and Release archives while
# CocoaPods is resolving the pod. Xcode Cloud occasionally drops those Maven
# connections, and CocoaPods then exits before our post-install repair can run.
# Pre-warm the exact cache files the podspec checks so pod update does not need
# to perform the fragile download itself.
HERMES_VERSION="$(sed -n 's/^  - hermes-engine (\([^)]*\)).*/\1/p' Podfile.lock | head -n 1)"
if [ -z "$HERMES_VERSION" ]; then
  HERMES_VERSION="$(sed -n 's/^HERMES_V1_VERSION_NAME=//p' "$REPOSITORY_PATH/node_modules/react-native/sdks/hermes-engine/version.properties" | head -n 1)"
fi
if [ -z "$HERMES_VERSION" ]; then
  echo "error: Unable to resolve Hermes version before CocoaPods install." >&2
  exit 1
fi

HERMES_ARTIFACT_DIR="$REPOSITORY_PATH/ios/Pods/hermes-engine-artifacts"
mkdir -p "$HERMES_ARTIFACT_DIR"

download_hermes_archive() {
  BUILD_TYPE="$1"
  TARGET_ARCHIVE="$HERMES_ARTIFACT_DIR/hermes-ios-${HERMES_VERSION}-${BUILD_TYPE}.tar.gz"
  if [ -s "$TARGET_ARCHIVE" ] && tar -tzf "$TARGET_ARCHIVE" >/dev/null 2>&1; then
    echo "Hermes ${BUILD_TYPE} archive already cached: $TARGET_ARCHIVE"
    return 0
  fi

  TEMP_ARCHIVE="${TARGET_ARCHIVE}.download"
  rm -f "$TEMP_ARCHIVE"
  for MAVEN_BASE in "https://repo1.maven.org/maven2" "https://repo.maven.apache.org/maven2"; do
    HERMES_URL="${MAVEN_BASE}/com/facebook/hermes/hermes-ios/${HERMES_VERSION}/hermes-ios-${HERMES_VERSION}-hermes-ios-${BUILD_TYPE}.tar.gz"
    echo "Downloading Hermes ${BUILD_TYPE} archive from ${HERMES_URL}"
    if curl --fail --location \
      --retry 8 --retry-all-errors --retry-delay 3 \
      --connect-timeout 20 \
      "$HERMES_URL" \
      --output "$TEMP_ARCHIVE"; then
      tar -tzf "$TEMP_ARCHIVE" >/dev/null
      mv "$TEMP_ARCHIVE" "$TARGET_ARCHIVE"
      echo "Hermes ${BUILD_TYPE} archive cached: $TARGET_ARCHIVE"
      return 0
    fi
    rm -f "$TEMP_ARCHIVE"
  done

  echo "error: Failed to download Hermes ${BUILD_TYPE} archive." >&2
  exit 1
}

download_hermes_archive debug
download_hermes_archive release

pod update --no-repo-update --verbose

# React Native downloads both Debug and Release Hermes archives while resolving
# the podspec. Its upstream helper does not fail the pod install when one curl
# request is interrupted, which leaves Xcode archive builds without the Release
# xcframework. Validate and repair that artifact after CocoaPods finishes.
download_hermes_archive debug
download_hermes_archive release

echo "Hermes archives ready in: $HERMES_ARTIFACT_DIR"
