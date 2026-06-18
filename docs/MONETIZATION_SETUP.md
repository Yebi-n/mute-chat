# Mute monetization setup

## Store products

- `mute_bubble_color_01` ... `mute_bubble_color_15`: non-consumable, KRW 1,200-3,200
- `mute_text_color_01` ... `mute_text_color_15`: non-consumable, KRW 1,200-3,200
- `mute_custom_bubble_color`: non-consumable, KRW 3,200
- `mute_custom_text_color`: non-consumable, KRW 3,200
- `mute_ad_free_monthly`: auto-renewing subscription, KRW 4,900/month

Index `00` is the free default color and must not be registered as a store product.

Digital colors and ad-free subscriptions must use Apple In-App Purchase and Google Play Billing. The app uses RevenueCat as the cross-platform receipt and entitlement adapter.

## AdMob

Development builds use Google's rewarded test ad unit when production IDs are absent.

Set these EAS environment variables before production:

- `EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID`
- `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID`

Reward rules:

- Attendance: 10 P, once every 1 hour
- Optional rewarded ad: 5 P, up to 20 times per day

The server credits points only through `claim_point_reward`. Production should additionally verify AdMob server-side verification callbacks before crediting rewarded-ad points.

## RevenueCat

Set:

- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`

Create matching products in App Store Connect and Google Play Console, import them into RevenueCat, and map `mute_ad_free_monthly` to an `ad_free` entitlement.

## Adult verification

The `start-adult-verification` Edge Function expects:

- `ADULT_VERIFICATION_START_URL`

This URL must point to the contracted identity provider integration. Its signed callback must set `users.adult_verified_at` only after confirming the user is at least 19. Do not store resident registration numbers.
