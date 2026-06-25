# Deferred Photo Editor / Payment TODO

작성일: 2026-06-25

## 사진 편집

- 카카오톡/인스타그램처럼 사진 위에 크롭 박스를 올리고, 사진을 확대/축소/이동해 크롭 영역에 맞추는 UX로 고도화가 필요하다.
- 현재 구현 상태:
  - 하단 편집바
  - 사진별 임시 편집값 저장
  - 썸네일별 삭제
  - 회전/비율/위치 값이 최종 전송 이미지에 반영됨
- 추가 개선:
  - 자유 크롭 박스 리사이즈 UX
  - 긴 사진 편집 시 세로 스크롤과 하단 고정바 충돌 TestFlight 확인

## 결제

완료:

- RevenueCat 없이 StoreKit 자체 검증 구조로 유지한다.
- `expo-iap`가 StoreKit 결제창을 열고, Supabase Edge Function `verify-store-purchase`가 Apple App Store Server API로 거래를 검증한다.
- 포인트 상품, 앱 테마, 광고 제거 구독 상품 ID를 `src/services/storeProducts.ts`, `ios/Mute.storekit`, `verify-store-purchase`에서 동일하게 맞췄다.
- 결제 중복 탭 방지를 추가했다.
- 구매 실패 원인을 상품 미조회와 서버 검증 실패로 구분해 보여준다.
- 비소모성 상품과 구독을 위한 `구매 복원` 버튼을 아이템샵에 추가했다.
- `verify-store-purchase` Edge Function은 검증 실패 사유를 클라이언트가 읽을 수 있게 응답한다.

TestFlight에서 확인할 것:

- App Store Connect 상품 ID가 아래 값과 정확히 일치하는지 확인한다.
  - `mute_points_5000`
  - `mute_points_11000`
  - `mute_points_28000`
  - `mute_points_60000`
  - `mute_points_200000`
  - `mute_points_390000`
  - `mute_theme_mint`
  - `mute_theme_ocean`
  - `mute_theme_lavender`
  - `mute_theme_sunset`
  - `mute_theme_mono`
  - `mute_ad_free_monthly`
- TestFlight에서 상품 조회가 되는지 확인한다.
- 구매 성공 후 `users.point_balance`, `point_ledger`, `store_transactions`, `user_entitlements`가 갱신되는지 확인한다.
- 구매 복원 버튼이 광고 제거 구독과 앱 테마를 복원하는지 확인한다.

빌드/푸시는 사용자 요청 시에만 진행한다.
