# Mute monetization setup

## Store products

- Point packages are App Store / Play Store consumables.
- App themes are non-consumables.
- `mute_ad_free_monthly`: auto-renewing subscription, KRW 5,900/month.

Chat bubble, text color, and custom background items are point purchases inside the app. They are not separate App Store products.

The app uses `expo-iap` to open the native purchase sheet. Supabase `verify-store-purchase` verifies purchases directly against Apple App Store Server API before crediting points or entitlements.

## AdMob

광고 형식과 화면별 배치 기준은
`docs/ADMOB_AD_FORMAT_AND_PLACEMENT.md`를 따른다.

Development builds use Google's rewarded test ad unit when production IDs are absent.

Only rewarded ads are enabled. Banner and interstitial ads are intentionally
excluded to keep chat and story navigation uninterrupted.

### AdMob console setup

1. In AdMob, add the iOS app with bundle ID `app.mute.chat`.
2. Add an Android app later with package name `app.mute.chat`.
3. Create one **Rewarded** ad unit for each platform.
4. In each rewarded unit's server-side verification settings, enter the SSV
   callback URL below.
5. In Privacy & messaging, publish the consent message required for the regions
   where the app will be distributed.

AdMob provides two different identifiers:

- App ID: `ca-app-pub-...~...` - goes in the `react-native-google-mobile-ads`
  plugin configuration in `app.json`.
- Rewarded ad unit ID: `ca-app-pub-.../...` - goes in the EAS environment
  variables below and in the Supabase allowlist secret.

Set these EAS environment variables before production:

- `EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID` (currently `ca-app-pub-4013454985021474/1566965165`)
- `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID`
- `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false`
- `EXPO_PUBLIC_ADMOB_BANNER_MAIN_IOS_ID` (currently `ca-app-pub-4013454985021474/9051959127`)
- `EXPO_PUBLIC_ADMOB_BANNER_CHAT_IOS_ID` (optional placement override)
- `EXPO_PUBLIC_ADMOB_BANNER_STORY_IOS_ID` (optional placement override)

Use separate production ad units for main, chat, and story placements. Until the
two additional units are created, chat and story fall back to the main inline
banner unit. See `docs/ADMOB_AD_FORMAT_AND_PLACEMENT.md` for the placement and
policy rules.

Use official Google test IDs until all production identifiers are configured.
The repository defaults to test ads even in TestFlight. Set
`EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false` only for App Store release builds or
after registering every tester device as an AdMob test device.

Reward rules:

- Attendance reward: 20 P, once every 1 hour
- Optional rewarded ad: 10 P, once every 1 hour

Development builds use Google's official test IDs. Production must use AdMob
server-side verification (SSV) before crediting points; the client
`EARNED_REWARD` event alone is not sufficient proof.

Production setup requires:

- iOS and Android AdMob app IDs
- one rewarded ad unit ID per platform
- SSV callback URL configured on both rewarded ad units
- EAS environment variables for the rewarded ad unit IDs
- Supabase SSV signature verification and transaction-id idempotency

SSV callback URL:

`https://oxanqrmkvyniocxwreia.supabase.co/functions/v1/admob-reward-ssv`

Deploy after setting the production rewarded unit IDs:

```powershell
npx.cmd supabase secrets set ADMOB_REWARDED_AD_UNIT_IDS="<ios-unit-id>,<android-unit-id>"
npx.cmd supabase db push
npx.cmd supabase functions deploy admob-reward-ssv --no-verify-jwt
```

Do not replace the Google sample app IDs in `app.json` until the real AdMob
app IDs and rewarded unit IDs have been created. TestFlight production testing
must use a test device configured in AdMob; never click live ads for testing.

## StoreKit direct verification

Current iOS secrets:

- `APP_STORE_IAP_KEY_ID`
- `APP_STORE_ISSUER_ID`
- `APP_STORE_BUNDLE_ID`
- `APP_STORE_IAP_PRIVATE_KEY`

See `docs/STOREKIT_REVENUECAT_SETUP.md` for exact product IDs and deployment steps. The filename is kept for continuity, but the current decision is no RevenueCat.

## Adult verification

The `start-adult-verification` Edge Function expects:

- `ADULT_VERIFICATION_START_URL`

This URL must point to the contracted identity provider integration. Its signed callback must set `users.adult_verified_at` only after confirming the user is at least 19. Do not store resident registration numbers.
