# StoreKit 자체검증 결제 설정

## 방향

RevenueCat은 사용하지 않는다. 앱은 `expo-iap`로 App Store/Play Store 결제창만 열고, 결제 검증과 포인트/권한 지급은 Supabase Edge Function에서 처리한다.

이 구조가 현재 비용 최적화에 가장 유리하다. 외부 결제 SaaS 수수료가 없고, 중복 지급 방지는 `store_transactions.transaction_id` UNIQUE 제약으로 처리한다.

## iOS 검증 흐름

1. 앱에서 `expo-iap`로 StoreKit 결제를 시작한다.
2. 결제 성공 이벤트에서 `transactionId`와 iOS JWS 토큰을 서버로 보낸다.
3. `verify-store-purchase` Edge Function이 Apple App Store Server API에 `transactionId`를 조회한다.
4. 서버가 `bundleId`, `productId`, `transactionId`, 환불 여부, 구독 만료일을 확인한다.
5. 검증 성공 시 `apply_verified_store_purchase` RPC만 포인트/권한을 지급한다.
6. 클라이언트는 서버 검증 성공 후 `finishTransaction`을 호출한다.

## Apple 키

App Store Connect > 사용자 및 액세스 > 통합 > 앱 내 구입에서 생성한 키를 사용한다.

- Key ID: `9H4U38RRXA`
- Issuer ID: `c9a7cc6b-b5ef-42c8-a3d0-7a4f7a8fa365`
- Bundle ID: `app.mute.chat`
- Private key file: `C:\Users\trudy\Downloads\SubscriptionKey_9H4U38RRXA.p8`

Supabase secrets:

```powershell
cd C:\Users\trudy\mute-chat
$privateKey = Get-Content -LiteralPath 'C:\Users\trudy\Downloads\SubscriptionKey_9H4U38RRXA.p8' -Raw
npx supabase secrets set APP_STORE_IAP_KEY_ID=9H4U38RRXA APP_STORE_ISSUER_ID=c9a7cc6b-b5ef-42c8-a3d0-7a4f7a8fa365 APP_STORE_BUNDLE_ID=app.mute.chat APP_STORE_IAP_PRIVATE_KEY="$privateKey"
npx supabase functions deploy verify-store-purchase
```

Private key는 채팅, Git, 문서 본문에 붙여넣지 않는다.

## App Store Connect 상품

| 상품 ID | 유형 | 가격 / 지급 |
|---|---|---|
| `mute_points_5000` | 소비성 | 1,200원 / 5,000P |
| `mute_points_11000` | 소비성 | 2,500원 / 11,000P |
| `mute_points_28000` | 소비성 | 5,900원 / 28,000P |
| `mute_points_60000` | 소비성 | 12,000원 / 60,000P |
| `mute_points_200000` | 소비성 | 37,000원 / 200,000P |
| `mute_points_390000` | 소비성 | 65,000원 / 390,000P |
| `mute_theme_mint` | 비소비성 | 4,900원 |
| `mute_theme_ocean` | 비소비성 | 4,900원 |
| `mute_theme_lavender` | 비소비성 | 4,900원 |
| `mute_theme_sunset` | 비소비성 | 4,900원 |
| `mute_theme_mono` | 비소비성 | 4,900원 |
| `mute_ad_free_monthly` | 자동 갱신 구독 | 월 5,900원 |

색연필/말풍선/채팅 배경 커스텀은 원화 결제가 아니라 포인트 구매다. App Store 상품으로 만들지 않는다.

## Android 예정

Android는 Google Play Billing 결제 토큰을 서버로 보내고, 서버에서 Google Play Developer API로 검증해야 한다. Play Console 서비스 계정 JSON은 Supabase secret으로만 저장한다.

## 테스트

1. App Store Connect에 상품을 모두 만든다.
2. TestFlight 빌드에서 sandbox 결제를 실행한다.
3. `store_transactions`에 transaction ID가 한 번만 저장되는지 확인한다.
4. 포인트 상품은 `point_ledger.reason = store_purchase`가 생기는지 확인한다.
5. 테마/광고 제거는 `user_entitlements`에 저장되는지 확인한다.
6. 같은 transaction을 다시 보내도 포인트가 중복 지급되지 않는지 확인한다.

## 보류/주의

- App Store Server Notifications V2 웹훅은 아직 붙이지 않았다. 구독 갱신/환불/취소를 자동 반영하려면 다음 단계에서 추가한다.
- Android 자체검증은 별도 단계다.
- 상품이 App Store Connect에 없거나 승인 전이면 앱에서 `STORE_PRODUCT_NOT_FOUND`가 정상적으로 발생한다.
