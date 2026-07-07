# iOS / Android Release Separation

Last updated: 2026-07-07

## Goal

Android release work must not accidentally trigger iOS TestFlight or App Store builds.

The app shares most source code across iOS and Android, so the safest low-effort workflow is:

- Keep `main` as the iOS review / production line.
- Do Android release work on a separate branch.
- Merge shared fixes deliberately, not automatically.
- Do not push Android-only changes to `main` until the iOS impact is accepted.

## Current Risk

Xcode Cloud appears to be connected to the GitHub repository and can start iOS builds when `main` is pushed.

Because React Native / Expo shared files such as `App.tsx`, `app.json`, assets, services, and package files affect both platforms, pushing Android changes to `main` can still trigger an iOS build even when the intended target is Android.

## Branch Policy

Recommended branches:

- `main`: iOS review / production baseline.
- `android/release`: Android release preparation and Play Console testing.
- `feature/<name>`: shared fixes that should be reviewed before merging into either release line.

Current local branch anchors:

- `ios/review-4ce86e4`: fixed at `4ce86e4`, matching the manually rebuilt iOS Build 88 baseline.
- `android/release`: created from `origin/main` at `7228272`, where Android safe-area and icon work currently exists.
- `main`: currently should not be pushed casually because Xcode Cloud may still treat it as an iOS build trigger.

Rules:

- Android-only work goes to `android/release`.
- iOS review emergency fixes go to `main`.
- Shared fixes should be cherry-picked or merged intentionally into both lines.
- Do not force push `main`.
- Do not push to `main` just to test Android.

## Build Router

Use `scripts\build-route.ps1` whenever a build is requested. It blocks the build if the current branch does not match the requested platform.

When the request is "iOS branch build":

```bat
cd C:\Users\trudy\mute-chat
git switch ios/review-4ce86e4
powershell -ExecutionPolicy Bypass -File scripts\build-route.ps1 ios
```

The iOS route only verifies the branch and runs typecheck. The actual iOS archive should be started manually from Xcode Cloud on the `ios/review-4ce86e4` branch.

When the request is "Android branch APK build":

```bat
cd C:\Users\trudy\mute-chat
git switch android/release
powershell -ExecutionPolicy Bypass -File scripts\build-route.ps1 android-apk
```

When the request is "Android branch production build":

```bat
cd C:\Users\trudy\mute-chat
git switch android/release
powershell -ExecutionPolicy Bypass -File scripts\build-route.ps1 android-production
```

Routing rule:

- iOS build request -> `ios/review-4ce86e4`
- Android build request -> `android/release`
- Any other current branch -> stop before build

## Xcode Cloud Setting To Check Manually

In App Store Connect:

1. Open the app.
2. Go to `Xcode Cloud`.
3. Open the active workflow.
4. Check `Start Conditions`.
5. Use one of these safe settings:
   - Manual builds only, or
   - Automatic builds only for selected branches intended for iOS, or
   - Keep automatic builds on `main` only and do Android work away from `main`.

If automatic builds are enabled for all pushes, Android work can keep triggering iOS builds.

## Android Build Commands

Use these from `C:\Users\trudy\mute-chat`.

First-time Android branch:

```bat
git switch -c android/release
```

Existing Android branch:

```bat
git switch android/release
```

Check current branch and changes:

```bat
git branch --show-current
git status --short
```

APK test build:

```bat
npx.cmd eas-cli@latest build --platform android --profile androidPreview
```

Play Store AAB build:

```bat
npx.cmd eas-cli@latest build --platform android --profile production
```

If we add a dedicated Android production profile later, prefer:

```bat
npx.cmd eas-cli@latest build --platform android --profile androidProduction
```

## iOS Build Policy

iOS builds should stay on Xcode Cloud.

Do not use EAS iOS builds unless explicitly needed, because the Expo build quota has already been a constraint.

## Play Console Checklist

Before production release, confirm:

- Package name: `app.mute.chat`
- Keystore is backed up.
- Internal testing track is created.
- App access / login instructions are filled.
- App content forms are complete.
- Privacy policy URL is live.
- Data Safety answers match actual collection.
- AdMob app ID and unit IDs are correct.
- In-app purchase products are configured if Android billing is enabled.
- FCM V1 service account is connected if push notifications are required for Android.

## Current Android Credentials

Project: `mute-chat`

Application identifier: `app.mute.chat`

Keystore:

- Type: `JKS`
- Alias: `23cc65a234eeaad686fae977cc4ffe31`
- SHA1: `33:BE:F4:62:B2:A6:90:D4:5C:FD:F4:51:04:C1:15:9E:FF:E5:EB:E8`
- SHA256: `35:2C:50:E7:41:6E:8C:DC:FA:37:6F:9E:5B:0A:53:5B:33:32:09:E7:A2:A3:E0:6C:E2:C5:FB:60:5F:C0:B1:60`

## Safe Commit Flow

For Android-only changes:

```bat
git branch --show-current
git status --short
npm.cmd run typecheck
git add <changed files>
git commit -m "Prepare Android release"
git push origin android/release
```

For shared fixes:

1. Commit on a feature branch.
2. Test Android.
3. Decide whether iOS also needs the fix.
4. Merge or cherry-pick intentionally.

## Important Reminder

Do not leave screenshot demo mode enabled for real builds:

```text
EXPO_PUBLIC_SCREENSHOT_DEMO=1
```

For review or production builds, remove it or set:

```text
EXPO_PUBLIC_SCREENSHOT_DEMO=0
```
