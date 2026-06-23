# Xcode Cloud Setup

## Current Status

EAS iOS free build quota is exhausted until 2026-07-01. Mute should move iOS native builds to Xcode Cloud to use Apple Developer Program included compute time.

Status as of 2026-06-23:

- GitHub repository: `https://github.com/Yebi-n/mute-chat`
- Branch: `main`
- GitHub Actions workflow `Generate iOS project` ran successfully.
- `ios/` was generated and committed by GitHub Actions commit `cc9b826`.
- Generated native project: `ios/app.xcodeproj`
- Generated scheme: `app`
- Bundle ID: `app.mute.chat`

## Important Limitation

App Store Connect currently shows this Xcode Cloud instruction:

```text
시작하려면 Xcode에서 워크플로를 생성하십시오.
```

That means the first Xcode Cloud workflow cannot be completed from the App Store Connect web page on Windows. The repository and `ios/` project can be prepared from Windows, but the first Xcode Cloud workflow must be created once from Xcode on macOS.

After the first workflow exists, future runs and edits can be managed from App Store Connect.

## Why This Order

The current Windows machine cannot generate the iOS native project with `expo prebuild --platform ios`; Expo requires macOS or Linux for that step. Therefore:

1. Push this repository to GitHub.
2. Run the GitHub Actions workflow `Generate iOS project` once.
3. The workflow generates and commits the `ios/` folder from Linux.
4. Open the generated project once from macOS Xcode.
5. Create the first Xcode Cloud workflow from Xcode.
6. Use Xcode Cloud for future iOS native builds and TestFlight distribution.

This avoids consuming EAS build quota for normal native iOS builds.

## Required Local Checks

Before pushing native or build-pipeline changes:

```powershell
cd C:\Users\trudy\mute-chat
npm.cmd run typecheck
npx.cmd expo config --type public
```

## GitHub Repository

Remote:

```text
origin  https://github.com/Yebi-n/mute-chat.git
```

Useful commands:

```powershell
cd C:\Users\trudy\mute-chat
git status --short
git log --oneline --decorate -5
git push origin main
```

## Generate iOS Project

This is already done once. To regenerate after native config changes:

1. Open `https://github.com/Yebi-n/mute-chat`.
2. Go to `Actions`.
3. Select `Generate iOS project`.
4. Run workflow on branch `main`.
5. Confirm the workflow commits the updated `ios/` directory.
6. Pull the result locally:

```powershell
cd C:\Users\trudy\mute-chat
git pull --ff-only origin main
```

The workflow is intentionally manual, not automatic, to avoid unnecessary GitHub Actions usage.

## First Xcode Cloud Setup

Requires macOS Xcode:

1. On a Mac, clone `https://github.com/Yebi-n/mute-chat`.
2. Run `npm ci`.
3. Open `ios/app.xcodeproj` in Xcode. If CocoaPods creates a workspace locally, open the workspace instead.
4. Sign in to Xcode with the Apple Developer account that owns `app.mute.chat`.
5. Use Product > Xcode Cloud > Create Workflow.
6. Select repository `Yebi-n/mute-chat`, branch `main`, scheme `app`.
7. Set workflow action to Archive.
8. Set signing to Apple managed signing for bundle ID `app.mute.chat`.
9. Set distribution to TestFlight.
10. Save and run the workflow.

The repo includes `.ci_scripts/ci_post_clone.sh`; Xcode Cloud runs it after checkout. It installs npm dependencies and runs `pod install`.

## If No Mac Is Available

Use one of these fallbacks:

1. Wait for EAS free quota reset on 2026-07-01.
2. Temporarily upgrade EAS for urgent TestFlight binaries.
3. Use a short-lived rented or borrowed Mac only for the first Xcode Cloud workflow creation.
4. Build through GitHub Actions macOS runners with App Store Connect API key, Apple distribution certificate, and provisioning profile secrets.

GitHub Actions macOS is a fallback, not the preferred primary path, because it is more setup work and normally costs more than Xcode Cloud included hours.

## Secrets

Do not commit:

- `.env`
- Apple `.p8`
- certificates
- provisioning profiles
- keystores
- service-role keys

Supabase Apple IAP secrets are configured in Supabase, not in the repository.

## When To Use EAS Again

Use EAS only as fallback:

- Xcode Cloud is unavailable.
- urgent build is needed.
- Xcode Cloud workflow is blocked and cannot be fixed quickly.

For JavaScript-only fixes after a binary with `expo-updates` is introduced, use OTA updates instead of native builds.
