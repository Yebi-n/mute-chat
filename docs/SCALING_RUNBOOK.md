# 서버 안정화 런북

최종 업데이트: 2026-07-07

## 목표

베타 사용자 증가 시 채팅, 알림, 이미지, 결제, 신고 기능이 먼저 터지지 않도록 점검 기준을 정리한다.

## 우선순위

1. 채팅 읽기/쓰기 지연
2. 푸시 알림 지연
3. 이미지 업로드 실패
4. 결제 검증 실패
5. 신고/차단 누락

## 채팅

- 채팅방 진입 시 최신 메시지부터 제한 개수만 가져온다.
- 오래된 메시지는 위로 스크롤할 때 페이지네이션으로 추가 로드한다.
- 안 읽은 메시지가 많아도 전체를 한 번에 불러오지 않는다.
- `여기까지 읽었어요`는 서버의 마지막 읽은 메시지 기준으로 계산한다.
- Realtime 구독은 현재 방 단위로만 유지한다.

## 인덱스 점검

필수 인덱스 후보:

- `messages(room_id, created_at)`
- `messages(room_id, id)`
- `room_memberships(user_id, status)`
- `room_memberships(room_id, status)`
- `room_reports(reporter_user_id, room_id)`
- `notifications(user_id, created_at)`
- `stories(visibility, created_at)`

## 푸시

- 푸시는 Edge Function에서 비동기로 처리한다.
- 실패 토큰은 기록하고 반복 실패 시 비활성화한다.
- 사용자가 현재 보고 있는 방의 메시지는 푸시하지 않는다.
- 로그아웃 시 푸시 토큰을 정리한다.

## 이미지

- 프로필/방/스토리/채팅 사진은 업로드 전 리사이즈와 압축을 적용한다.
- 여러 장 전송은 실패/재전송/삭제 상태를 UI에 표시한다.
- Storage 객체 삭제는 DB 삭제와 분리해 실패해도 앱 흐름을 막지 않는다.

## 결제

- 클라이언트 구매 성공만 신뢰하지 않는다.
- StoreKit 영수증은 `verify-store-purchase`에서 검증한다.
- 검증 후 `apply_verified_store_purchase` 또는 대응 RPC로 서버 권한을 부여한다.
- 앱 계정 로그아웃 시 로컬 구매 상태 캐시를 초기화한다.

## 신고/차단

- 신고는 서버에 저장하고 운영 페이지에서 확인한다.
- 신고된 방 숨김, 차단된 방 숨김, 강퇴 후 차단 숨김을 목록 쿼리에 모두 반영한다.
- 신고/차단 필터 때문에 본인이 참여 중인 방이 사라지지 않도록 참여 중인 방 신고를 앱에서 차단한다.

## 장애 시 확인 순서

1. Supabase Dashboard Logs
2. Edge Function Logs
3. Realtime 연결 수와 에러
4. Storage 업로드 실패
5. App Store/StoreKit 검증 로그
6. Xcode/TestFlight crash log

