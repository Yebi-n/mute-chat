# Mute monetization setup

## Store products

- Point packages are App Store / Play Store consumables.
- App themes are non-consumables.
- `mute_ad_free_monthly`: auto-renewing subscription, KRW 5,900/month.

Chat bubble, text color, and custom background items are point purchases inside the app. They are not separate App Store products.

The app uses `expo-iap` to open the native purchase sheet. Supabase `verify-store-purchase` verifies purchases directly against Apple App Store Server API before crediting points or entitlements.

## AdMob

Development builds use Google's rewarded test ad unit when production IDs are absent.

Set these EAS environment variables before production:

- `EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID`
- `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID`

Reward rules:

- Attendance: 10 P, once every 1 hour
- Optional rewarded ad: 5 P, up to 20 times per day

The server credits points only through `claim_point_reward`. Production should additionally verify AdMob server-side verification callbacks before crediting rewarded-ad points.

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
