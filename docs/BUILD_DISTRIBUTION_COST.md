# Build and Distribution Cost Strategy

Updated: 2026-06-21

## 1. Decision

Mute should use the following hybrid workflow.

| Change type | iOS | Android |
| --- | --- | --- |
| TypeScript, UI, copy, styling, bundled image fixes | EAS Update | EAS Update |
| Native dependency, permission, Expo SDK, app icon, binary change | Xcode Cloud | GitHub Actions Ubuntu runner |
| Emergency/fallback native build | EAS Build | EAS Build or local Windows build |
| Store distribution | App Store Connect / TestFlight | Google Play Console |

This is the preferred cost-minimizing target because:

- Apple Developer Program membership is already active and includes 25 Xcode Cloud compute hours per month.
- A GitHub account is already available.
- Android builds can run on Linux runners and do not require paid macOS capacity.
- Most current Mute changes are JavaScript, UI, styling, and bundled assets, so they should not consume native build quota.

## 2. Immediate workflow

EAS iOS free build quota is currently exhausted, so the immediate iOS path is Xcode Cloud. Use this order:

1. Push the repository to GitHub.
2. Run the `Generate iOS project` GitHub Actions workflow once to create and commit `ios/`.
3. Connect the GitHub repository to Xcode Cloud.
4. Build the generated iOS workspace in Xcode Cloud and distribute to TestFlight.
5. Add and configure `expo-updates` after the native pipeline is stable.
6. Create one new iOS TestFlight binary and one Android binary containing `expo-updates`.
7. Send compatible JavaScript and asset changes through the production update channel.
8. Configure Android GitHub Actions before the first Play Store release.

The current repository does not yet contain `expo-updates`, `runtimeVersion`, or an EAS Update channel configuration. OTA delivery is therefore not active yet.

## 3. What can use EAS Update

Eligible examples:

- React/TypeScript bug fixes
- screen layouts and styling
- wording and translations
- most business logic implemented in JavaScript
- bundled image and font asset changes compatible with the installed binary

A new native binary is required for:

- adding or upgrading native libraries
- changing camera, notification, tracking, or other native permissions
- changing app icons, splash configuration, entitlements, or capabilities
- changing Expo SDK or React Native versions
- changing native AdMob, `expo-iap`, push, or store configuration
- any change requiring a new runtime version

App Store and Play Store policies still apply to OTA-delivered behavior. EAS Update must not be used to bypass review requirements.

## 4. iOS strategy

### Current phase

EAS iOS builds are blocked by the free monthly quota. Use Xcode Cloud for the next iOS native binary.

See `docs/XCODE_CLOUD_SETUP.md`.

### Cost-optimized target

Use Xcode Cloud for native iOS builds because Apple Developer Program membership includes 25 compute hours per month.

Required preparation:

- generate and stabilize the `ios` native project
- connect the repository to Xcode Cloud
- configure signing, bundle ID `app.mute.chat`, environment variables, and archive workflow
- keep secrets in Xcode Cloud/App Store Connect, not in the repository
- verify Expo config-plugin changes after every native dependency change

Xcode Cloud is iOS-only. It does not replace the Android pipeline.

### Long-term high-volume option

If native iOS builds regularly exceed the included cloud time, a dedicated Mac mini with local Xcode builds removes per-build cloud charges. This is only economical after build volume becomes consistently high enough to justify the hardware and maintenance cost.

## 5. Android strategy

Use GitHub Actions with an Ubuntu runner for release builds. Android does not require macOS.

Target workflow:

1. checkout repository
2. install Node and dependencies with lockfile caching
3. install Java and Android SDK
4. run Expo prebuild or Gradle build using the selected native-project policy
5. sign the AAB using GitHub encrypted secrets
6. upload the AAB as a short-retention artifact
7. submit to an internal Play Console track only after explicit release approval

For local debugging on the current Windows machine, use Android Studio/Gradle or Expo local Android development builds. This avoids consuming cloud build quota.

Never commit the Android keystore, passwords, Apple certificates, API keys, or service-account JSON.

## 6. GitHub Actions cost controls

- Keep the repository private and monitor its included Actions allowance.
- Use Ubuntu runners for Android; do not use macOS runners for Android.
- Trigger release builds manually or from release tags, not on every commit.
- Use dependency and Gradle caches.
- Cancel superseded workflow runs.
- Set artifact retention to a short period.
- Add a GitHub Actions spending limit and usage alerts.
- Run type checking and lightweight tests on Windows locally before starting a cloud native build.

GitHub-hosted macOS runners are materially more expensive than Linux runners. They remain a fallback for iOS, not the preferred primary path while Xcode Cloud's included hours are available.

## 7. Build frequency policy

Batch native changes into scheduled builds.

- During active UI development: use local/web testing and EAS Update previews.
- For JavaScript-only TestFlight feedback: publish an OTA update to the matching runtime/channel.
- For native changes: group changes and produce one binary after local checks pass.
- Before store review: produce a clean native release binary containing all accumulated OTA fixes.

Do not start a production build merely to verify text, spacing, colors, or JavaScript behavior.

## 8. Fallback order

If the preferred service is unavailable:

1. EAS Update for compatible changes
2. remaining EAS Build allowance
3. Xcode Cloud for iOS / GitHub Actions Ubuntu for Android
4. GitHub Actions macOS for urgent iOS builds
5. local Mac build when a Mac build host becomes available

## 9. Official references

- Expo EAS Update: https://docs.expo.dev/eas-update/introduction/
- Expo local EAS builds: https://docs.expo.dev/build-reference/local-builds/
- Expo pricing: https://expo.dev/pricing
- Apple Xcode Cloud: https://developer.apple.com/xcode-cloud/
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
