# StoreKit 자체검증 결제 설정

현재 결정: RevenueCat은 사용하지 않는다. 앱은 `expo-iap`로 App Store 결제창만 열고, 결제 검증과 포인트/권한 지급은 Supabase Edge Function에서 직접 처리한다.

## 결제 흐름

1. 앱에서 `purchaseStoreProduct(productId)` 호출
2. `expo-iap`가 StoreKit 결제창 표시
3. 구매 성공 후 앱이 `transactionId`를 Supabase Edge Function `verify-store-purchase`로 전송
4. Edge Function이 Apple App Store Server API로 transaction 조회
5. 서버가 `bundleId`, `productId`, `transactionId`, 환불/취소 여부, 구독 만료일을 검증
6. 검증 성공 시 `apply_verified_store_purchase` RPC가 포인트 또는 권한 지급
7. 앱이 `finishTransaction` 호출

중복 지급 방지는 `store_transactions.transaction_id` unique 제약으로 처리한다.

## 현재 코드 위치

- 클라이언트 상품 ID: `src/services/storeProducts.ts`
- 네이티브 결제 호출: `src/services/purchases.native.ts`
- 웹/Expo web fallback: `src/services/purchases.web.ts`
- 기본 fallback: `src/services/purchases.ts`
- 서버 검증 함수: `supabase/functions/verify-store-purchase/index.ts`
- 서버 지급 RPC/테이블: `supabase/migrations/202606220012_point_economy_and_verified_store_purchases.sql`
- Xcode 로컬 테스트 상품: `ios/Mute.storekit`

## App Store Connect 상품

App Store Connect에서 아래 상품 ID를 그대로 만들어야 한다.

### 포인트 충전

| Product ID | 유형 | 가격 | 지급 |
|---|---:|---:|---:|
| `mute_points_5000` | Consumable | 1,200원 | 5,000P |
| `mute_points_11000` | Consumable | 2,500원 | 11,000P |
| `mute_points_28000` | Consumable | 5,900원 | 28,000P |
| `mute_points_60000` | Consumable | 12,000원 | 60,000P |
| `mute_points_200000` | Consumable | 37,000원 | 200,000P |
| `mute_points_390000` | Consumable | 65,000원 | 390,000P |

### 앱 테마

| Product ID | 유형 | 가격 | 지급 |
|---|---:|---:|---:|
| `mute_theme_mint` | Non-consumable | 4,900원 | 민트 테마 영구 소장 |
| `mute_theme_ocean` | Non-consumable | 4,900원 | 오션 테마 영구 소장 |
| `mute_theme_lavender` | Non-consumable | 4,900원 | 라벤더 테마 영구 소장 |
| `mute_theme_sunset` | Non-consumable | 4,900원 | 선셋 테마 영구 소장 |
| `mute_theme_mono` | Non-consumable | 4,900원 | 모노 테마 영구 소장 |

### 광고 제거

| Product ID | 유형 | 가격 | 지급 |
|---|---:|---:|---:|
| `mute_ad_free_monthly` | Auto-renewable subscription | 월 5,900원 | 광고 제거 |

## 포인트로 사는 내부 아이템

아래는 App Store 상품으로 만들지 않는다. 앱 내부 포인트로만 구매한다.

| Product ID | 가격 | 기간 |
|---|---:|---:|
| `mute_custom_bubble_color` | 3,200P | 7일 |
| `mute_custom_text_color` | 3,200P | 7일 |
| `mute_custom_background` | 3,200P | 7일 |
| `mute_bubble_color_*` | 1,200~2,200P | 7일 |
| `mute_text_color_*` | 1,800~3,200P | 7일 |

## Supabase secrets

Supabase Edge Function `verify-store-purchase`는 아래 secret이 필요하다.

```text
APP_STORE_IAP_KEY_ID
APP_STORE_ISSUER_ID
APP_STORE_BUNDLE_ID=app.mute.chat
APP_STORE_IAP_PRIVATE_KEY
```

이미 한 번 설정했다면 재설정할 필요 없다. 키를 교체한 경우에만 다시 설정한다.

PowerShell 예시:

```powershell
cd C:\Users\trudy\mute-chat
$keyPath = "C:\Users\trudy\Downloads\SubscriptionKey_<KEY_ID>.p8"
$tmp = ".supabase-apple-iap-secrets.tmp.env"
$private = (Get-Content -LiteralPath $keyPath -Raw).Replace("`r","").Replace("`n","\n")
Set-Content -LiteralPath $tmp -Encoding UTF8 -Value @(
  "APP_STORE_IAP_KEY_ID=<KEY_ID>",
  "APP_STORE_ISSUER_ID=<ISSUER_ID>",
  "APP_STORE_BUNDLE_ID=app.mute.chat",
  "APP_STORE_IAP_PRIVATE_KEY=$private"
)
npx.cmd supabase secrets set --env-file $tmp
Remove-Item -LiteralPath $tmp -Force
npx.cmd supabase functions deploy verify-store-purchase
```

Private key는 Git에 커밋하지 않는다.

## Xcode 로컬 StoreKit 테스트

`ios/Mute.storekit`을 추가해두었다.

Xcode에서:

1. Product > Scheme > Edit Scheme
2. Run > Options
3. StoreKit Configuration: `ios/Mute.storekit`
4. 앱 실행
5. 아이템샵/충전하기에서 결제창 테스트

주의: StoreKit Configuration 구매는 로컬 테스트용이다. Supabase 서버 검증은 Apple sandbox/production transaction이 있어야 통과한다.

## TestFlight 결제 테스트 조건

1. App Store Connect에 위 상품들이 모두 생성되어 있어야 한다.
2. 상품 상태가 테스트 가능한 상태여야 한다.
3. TestFlight 빌드가 해당 bundle id `app.mute.chat`로 올라가야 한다.
4. Sandbox tester 또는 TestFlight tester 계정으로 결제해야 한다.
5. Supabase `verify-store-purchase` 함수가 배포되어 있어야 한다.

검증할 DB:

- `store_transactions`: transaction이 1회만 저장되는지
- `point_ledger`: 포인트 상품 구매 시 `reason = store_purchase` 생성
- `users.point_balance`: 포인트 증가
- `user_entitlements`: 테마/광고 제거 권한 지급

## 아직 남은 작업

- App Store Server Notifications V2 연결
  - 구독 갱신, 환불, 취소, 만료를 서버가 자동 반영하려면 필요하다.
- Android Google Play Billing 자체검증
  - Play Developer API service account와 purchase token 검증 함수가 필요하다.
- 복원 구매 UI
  - non-consumable 테마와 구독 상태 복원 버튼이 필요하다.
