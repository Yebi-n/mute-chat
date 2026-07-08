# StoreKit 자체 검증 설정

최종 업데이트: 2026-07-07

## 현재 결정

- RevenueCat은 사용하지 않는다.
- 비용 최소화와 통제권 확보를 위해 StoreKit 직접 연동 + Supabase 검증을 사용한다.

## 구성

1. 앱에서 StoreKit 구매 실행
2. 구매 결과/transaction 정보를 Supabase Edge Function으로 전송
3. `verify-store-purchase`가 Apple App Store Server API로 검증
4. 검증 성공 시 `apply_verified_store_purchase` RPC로 포인트/entitlement 반영

## Supabase secrets

필수:

- `APP_STORE_IAP_KEY_ID`
- `APP_STORE_ISSUER_ID`
- `APP_STORE_BUNDLE_ID=app.mute.chat`
- `APP_STORE_IAP_PRIVATE_KEY`

주의:

- p8 private key는 문서나 Git에 기록하지 않는다.
- secret 변경 후 `verify-store-purchase`를 재배포한다.

```powershell
npx.cmd supabase functions deploy verify-store-purchase
```

## App Store Connect 상품

- 코드 상품 ID와 App Store Connect 상품 ID는 정확히 같아야 한다.
- suffix, 테스트 prefix, 과거 `_v2` suffix를 임의로 붙이지 않는다.
- 상품 상태가 `Ready to Submit` 또는 심사 가능한 상태여야 TestFlight에서 조회된다.

## 오류별 점검

| 오류 | 의미 | 조치 |
| --- | --- | --- |
| `STORE_PRODUCT_NOT_FOUND` | StoreKit이 상품을 못 찾음 | 상품 ID, Bundle ID, 상품 상태, 빌드 반영 확인 |
| `STORE_VERIFICATION_FAILED` | 서버 검증 실패 | Apple key/issuer/bundle, transaction id, Supabase function log 확인 |
| `TRANSACTION_OWNED_BY_ANOTHER_ACCOUNT` | 다른 앱 계정에 연결된 transaction | 로그아웃 시 구매 캐시 초기화, 계정 매핑 확인 |
| `product_id is ambiguous` | SQL 컬럼/파라미터 이름 충돌 | RPC 파라미터 alias 수정 |

## 계정 전환 주의

테스터가 여러 앱 계정을 오가며 같은 Apple ID로 구매할 수 있다.

- 앱 로그아웃 시 로컬 entitlement/theme cache를 제거한다.
- Apple transaction은 중복 사용 방지하되, 앱 계정 전환 오류 메시지가 명확해야 한다.
- 복원은 현재 로그인한 앱 계정 기준으로 처리한다.
