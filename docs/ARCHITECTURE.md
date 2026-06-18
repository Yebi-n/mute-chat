# 뮤트(Mute) 기술/운영 아키텍처

## 1. 문서 목적

뮤트은 사용자가 방마다 별도의 이름, 소개, 프로필 사진을 사용하는 반익명 커뮤니티 채팅 앱이다. 이 문서는 Expo React Native 기반 iOS/Android 클라이언트와 저비용 백엔드의 기준 아키텍처를 정의한다.

핵심 목표는 다음과 같다.

- 초기에는 소수 인원으로 운영 가능한 관리형 서비스를 사용한다.
- 채팅 체감 속도와 데이터 정합성을 동시에 확보한다.
- 전화번호, 성인 인증 정보, 결제 정보 같은 민감정보를 최소 수집한다.
- 광고와 인앱결제로 발행되는 포인트를 감사 가능한 원장으로 관리한다.
- 사용량 증가 시 병목 구간만 점진적으로 분리할 수 있게 설계한다.

## 2. 권장 기술 스택

### 2.1 클라이언트

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 앱 | Expo React Native + TypeScript | iOS/Android 단일 코드베이스 |
| 빌드/배포 | EAS Build, EAS Update | 네이티브 변경은 새 스토어 빌드로 배포 |
| 내비게이션 | Expo Router | 화면 단위 코드 분할 |
| 서버 상태 | TanStack Query | 캐시, 재시도, optimistic update |
| 로컬 상태 | Zustand 또는 React Context | 인증 세션과 UI 상태만 보관 |
| 로컬 저장 | expo-secure-store, AsyncStorage | 토큰은 SecureStore, 비민감 캐시는 AsyncStorage |
| 이미지 | expo-image-picker, expo-image-manipulator, expo-image | 선택/크롭/리사이즈/캐시 |
| 알림 | expo-notifications | Expo Push Service를 초기 전송 계층으로 사용 |
| 오류 수집 | Sentry 무료 구간부터 시작 | PII 제거 후 전송 |

Expo Go는 개발 초기 확인에만 사용한다. 인앱결제, 광고 SDK, 성인 인증 SDK 등 네이티브 모듈이 필요한 시점부터 development build를 사용한다.

### 2.2 백엔드

초기 권장안은 **Supabase 단일 프로젝트**다.

| 기능 | Supabase 구성 |
| --- | --- |
| 인증 | Supabase Auth 전화번호 OTP |
| 데이터베이스 | PostgreSQL |
| 권한 | Row Level Security(RLS), SECURITY DEFINER RPC |
| 실시간 | Realtime의 Postgres Changes 또는 Broadcast |
| 이미지 | Storage |
| 서버 로직 | Edge Functions + PostgreSQL 함수/트리거 |
| 예약 작업 | Supabase Cron 또는 `pg_cron` |
| 검색 | PostgreSQL `pg_trgm`, 정규화 검색 컬럼 |

단일 벤더 의존성보다 초기 운영 인력과 고정비 절감 효과가 크다. 도메인 로직은 SQL 함수와 명시적 API 계약으로 캡슐화해 추후 서비스 분리가 가능하게 한다.

### 2.3 외부 서비스

- SMS: Supabase가 지원하는 SMS 공급자 중 국내 도달률과 단가를 비교해 선택한다.
- 법적 본인/성인 인증: 국내 본인확인기관 또는 인증 대행사의 서버 API를 사용한다.
- 광고: Google AdMob 보상형 광고를 우선 고려한다.
- 결제: Apple StoreKit / Google Play Billing. 클라이언트 영수증을 신뢰하지 않고 서버에서 검증한다.
- 이메일: 피드백 연결은 초기에는 `mailto:`로 처리하고, 운영 규모가 커지면 문의 도구로 이전한다.

전화번호 OTP는 **번호 소유 확인**일 뿐 법적 본인확인이 아니다. 성인 탭 접근이나 중복 가입 방지에 법적 본인확인이 필요하면 별도 CI/DI 기반 인증을 사용해야 한다.

## 3. 전체 구조

```text
Expo App
  |
  | HTTPS + Supabase JWT
  v
Supabase API Gateway
  +-- Auth -------- 전화번호 OTP, 세션
  +-- PostgREST --- 단순 조회
  +-- RPC --------- 가입, 권한, 포인트, 랭킹 등 원자적 명령
  +-- Realtime ----- 채팅/스토리 변경 이벤트
  +-- Storage ------ 방/프로필/채팅 이미지
  +-- Edge Functions
        +-- 본인·성인 인증 콜백
        +-- 광고 SSV 검증
        +-- Apple/Google 결제 검증
        +-- 알림 fan-out
        +-- 신고 운영 연동
```

원칙은 클라이언트가 테이블을 임의로 갱신하지 않게 하는 것이다. 공개 조회와 본인 설정 변경은 RLS가 적용된 PostgREST를 사용할 수 있지만, 가입 승인, 제재, 방장 이전, 포인트 이동, 결제 반영은 반드시 서버 RPC 또는 Edge Function을 통한다.

## 4. 인증과 계정

### 4.1 로그인

1. 사용자가 E.164 형식 전화번호를 입력한다.
2. 서버가 기기/IP/번호 단위 rate limit과 CAPTCHA 또는 앱 무결성 검사를 수행한다.
3. Supabase Auth가 SMS OTP를 발송한다.
4. 사용자가 OTP를 검증하면 access token과 refresh token을 발급받는다.
5. 최초 로그인 시 `users` 행과 기본 설정을 생성한다.

앱에는 비밀번호를 두지 않는 **OTP 기반 passwordless 로그인**을 권장한다. 비밀번호 찾기 기능과 관련 고객지원 비용이 사라지고, 재로그인은 같은 전화번호로 OTP를 다시 받으면 된다. SMS 비용을 줄이기 위해 유효한 refresh token을 SecureStore에 보관하고 불필요한 재인증을 요구하지 않는다.

### 4.2 전화번호와 본인확인 데이터

- 전화번호 원문은 Auth 전용 저장소 밖으로 복제하지 않는다.
- 앱 테이블에는 마스킹 표시값과 검색 불가능한 HMAC 지문만 필요한 경우 저장한다.
- 법적 본인확인의 CI/DI 원문은 저장하지 않는다. 중복 가입 방지가 필요하면 서버 비밀키로 HMAC 처리한 식별자만 저장한다.
- 성인 인증에는 `verified_at`, `expires_at`, `provider`, `result`만 보관한다.
- 탈퇴 시 법적 보존 대상 원장을 제외한 프로필과 인증 연결을 익명화한다.

국내 성인 탭은 SMS OTP 결과로 열지 않는다. 국내 본인확인기관의 휴대폰 본인확인
결과를 서버 콜백에서 검증한 뒤 만 19세 여부를 계산한다. 원본 CI/DI, 생년월일,
실명은 저장하지 않고 서버 비밀키로 HMAC 처리한 CI와 인증 시각, 공급자만 저장한다.
`ci_hash`는 고유 인덱스로 관리해 한 사람이 여러 전화번호로 중복 가입하는 것을 막는다.

### 4.3 세션 보안

- access token은 짧게, refresh token은 회전 방식으로 운용한다.
- 로그아웃 시 로컬 토큰과 push token을 폐기한다.
- 운영자 권한은 앱 사용자 역할과 분리하고 MFA를 강제한다.
- 탈옥/루팅 탐지는 보조 신호로만 사용하고 서버 권한 검사를 대체하지 않는다.

## 5. 방, 가입, 권한

### 5.1 가입 상태

`room_memberships.status`는 `pending`, `active`, `rejected`, `left`, `kicked`, `banned`를 사용한다.

- 비회원은 공개 방 설명과 공개 프로필 요약만 읽는다.
- 가입 신청은 방당 활성 신청 하나만 허용한다.
- 방장 또는 `APPROVE_MEMBERS` 권한 보유자가 승인한다.
- 승인 시 최대 인원 확인, 상태 변경, 감사 로그 기록을 하나의 트랜잭션으로 수행한다.
- 이미 `active`인 사용자가 방 상세를 열면 채팅 화면으로 이동한다.

### 5.2 권한 모델

방 역할은 `owner`, `cohost`, `member`로 단순화한다. 방장은 여러 명의 부방장을 지정할 수 있고, 부방장은 가입 승인과 일반 운영 기능을 함께 사용한다. 방장 양도, 방 삭제, 부방장 지정·해제는 방장만 수행할 수 있다.

서버는 다음을 항상 검사한다.

- 요청자가 해당 시점에 `active` 멤버인지
- 요청 권한이 있는지
- 대상이 방장인지
- 본인보다 높은 권한을 변경하려는지
- 허용된 제재 기간인지

제재 기간은 서버 상수로 제한한다.

- 강퇴/재가입 제한: 5분, 1시간, 1일, 30일
- 채팅 금지: 5초, 30초, 1분, 30분

모든 승인, 거절, 권한 변경, 제재, 이름 강제 변경, 방장 이전, 방 편집/삭제는 `room_audit_logs`에 기록한다.

### 5.3 방장 이전과 삭제

- 이전 대상은 현재 `active` 멤버여야 한다.
- `rooms.owner_user_id` 변경과 역할 변경을 단일 트랜잭션으로 수행한다.
- 방 삭제는 즉시 물리 삭제하지 않고 `deleted_at`을 기록하는 soft delete다.
- 삭제된 방은 조회/채팅/가입을 차단하고, 유예 기간 후 이미지와 일반 콘텐츠를 비동기 정리한다.

## 6. 실시간 채팅

### 6.1 메시지 저장

메시지는 PostgreSQL을 최종 원본으로 한다. 클라이언트는 UUIDv7/ULID 형태의 `client_message_id`를 생성해 중복 전송을 방지한다.

전송 흐름:

1. 클라이언트가 임시 메시지를 즉시 표시한다.
2. `send_message` RPC가 멤버 상태, mute, 방 상태, payload 크기, rate limit을 검사한다.
3. 서버가 메시지를 저장하고 방 활동 집계값을 갱신한다.
4. Realtime 이벤트가 다른 접속자에게 전달된다.
5. 송신자는 서버 ID와 생성 시각으로 임시 메시지를 확정한다.

메시지 종류는 `text`, `image`, `system`으로 제한한다. 이미지 설명을 제외한 arbitrary JSON은 허용하지 않는다.

### 6.2 구독과 페이지네이션

- 채팅방 진입 시 최신 30~50개를 cursor 기반으로 읽는다.
- 과거 메시지는 `(created_at, id)` 커서로 가져온다. offset pagination은 사용하지 않는다.
- Realtime은 현재 열린 방만 구독하고 앱이 background로 가면 해제한다.
- 누락 복구를 위해 재연결 시 마지막 수신 커서 이후 메시지를 REST/RPC로 다시 읽는다.
- 읽음 상태는 메시지별 행이 아니라 멤버별 `last_read_message_id` 하나로 관리한다.
- 타이핑 표시와 presence는 영속화하지 않고 Broadcast/Presence로 처리한다.

### 6.3 스팸과 과부하 방지

- 사용자/방 단위 token bucket rate limit을 적용한다.
- 동일 문구 반복, 과도한 링크, 신고 누적은 별도 위험 점수로 제한한다.
- 대규모 방에서는 메시지 insert 이벤트만 구독하고 프로필/읽음 이벤트를 합치거나 지연한다.
- 메시지 수정은 지원하지 않고, 삭제는 tombstone 방식으로 본문을 비운다.

## 7. 이미지 파이프라인

### 7.1 클라이언트 전처리

갤러리/카메라 선택 후 기본 크롭을 제공하고 업로드 전에 다음 규칙을 적용한다.

| 용도 | 긴 변 최대 | 목표 형식 | 목표 크기 |
| --- | ---: | --- | ---: |
| 방/프로필 썸네일 | 512px | WebP 또는 JPEG | 150KB 내외 |
| 스토리/채팅 이미지 | 1600px | WebP 또는 JPEG | 800KB 내외 |
| 미리보기 | 320px | WebP 또는 JPEG | 60KB 내외 |

- EXIF 위치정보를 제거하고 방향을 정규화한다.
- 품질은 70~82 범위에서 조절한다.
- 원본 업로드는 기본적으로 금지한다.
- 업로드 전 MIME, 픽셀 수, 파일 크기를 검사한다.

### 7.2 저장과 접근

- 경로에 사용자 입력 파일명을 사용하지 않는다.
- 예: `rooms/{room_id}/messages/{message_id}/{asset_id}.webp`
- 비공개 방 이미지는 private bucket에 저장하고 짧은 만료 signed URL을 사용한다.
- DB 행 생성 전 임시 경로에 업로드하고, 메시지/스토리 확정 후 소유권을 연결한다.
- 연결되지 않은 임시 파일은 24시간 후 삭제한다.
- 서버는 업로드된 파일의 실제 MIME과 크기를 재검증한다.

초기에는 클라이언트 리사이즈로 비용을 절감한다. 악성 파일 방어와 다중 썸네일 생성이 필요해지면 Storage 이벤트 기반 이미지 작업자를 추가한다.

## 8. 검색

검색 대상은 방 제목, 설명, 해시태그다.

- `search_text`에 소문자화, 공백 정리, 특수문자 정리를 적용한다.
- 제목/설명은 `pg_trgm` GIN 인덱스로 부분 일치와 오타 허용 검색을 제공한다.
- 해시태그는 정규화된 별도 테이블과 정확/접두 일치 인덱스를 사용한다.
- 검색 결과는 공개 가능 상태, 성인 인증, 차단 관계, 가입 상태를 반영한다.
- 짧은 검색어는 최소 2자 또는 3자로 제한해 DB 부하를 줄인다.
- 인기 검색 캐시는 30~120초 허용한다.

PostgreSQL 기본 형태소 분석만으로 한국어 품질이 충분하지 않을 수 있다. MVP는 trigram으로 시작하고, 검색량과 품질 요구가 확인된 뒤에만 Typesense/Meilisearch 같은 별도 검색 서비스를 검토한다.

## 9. 방 목록과 랭킹

프로모션과 자연 활성화는 하나의 점수로 섞지 않고, 노출 이유가 명확한 두 채널로 관리한다.

### 9.1 프로모션 랭킹

- 방장은 정해진 cooldown마다 무료 프로모션을 실행할 수 있다.
- `room_promotions`에 시작/종료 시각을 기록한다.
- 활성 프로모션 방은 `promoted_at DESC`를 기본으로 하되 동일 방 반복 노출을 제한한다.
- 프로모션은 대화량을 위조하지 않으며 UI에 `프로모션` 배지를 표시한다.
- 향후 유료 프로모션 도입 시에도 이벤트와 결제 근거를 별도 보관한다.

### 9.2 활성 랭킹

자연 활성 점수는 고유 참여자와 최근성에 가중치를 둔다. 메시지 수만 사용하면 도배에 취약하다.

```text
activity_score =
  4.0 * log1p(unique_senders_15m)
  + 1.5 * log1p(valid_messages_15m)
  + 1.0 * log1p(join_approvals_24h)
  - 2.0 * spam_penalty
```

- 같은 사용자의 짧은 연속 메시지는 집계 시 감쇠한다.
- 시스템 메시지, 삭제 메시지, 제재 사용자의 도배는 제외한다.
- 점수는 이벤트마다 전체 재계산하지 않고 5분 bucket 집계 후 1~5분마다 갱신한다.
- 점수에는 시간 감쇠를 적용하고 최근 활동 시각을 함께 정렬한다.

### 9.3 피드 구성

`프로모션` 탭은 프로모션 슬롯과 활성 슬롯을 구분해 섞는다. 예: 10개 중 최대 3개 프로모션, 나머지는 활성 방. 같은 방은 한 페이지에 한 번만 노출한다.

`Member`, `지역별`, `성인` 탭은 해당 카테고리 필터 후 별도 활성 점수를 적용한다. 성인 방은 인증 만료 여부를 서버에서 검사한다.

## 10. 알림

### 10.1 설정 우선순위

알림 발송 여부는 다음 순서로 판단한다.

1. 계정 전체 알림 설정
2. 방별 알림 설정
3. 이벤트 종류별 설정
4. OS 알림 권한
5. 차단/탈퇴/제재 상태

### 10.2 전송 구조

- 기기별 Expo push token을 `push_devices`에 저장한다.
- 메시지 insert 트리거가 직접 외부 API를 호출하지 않는다.
- `notification_outbox`에 이벤트를 적재하고 작업자가 묶음 처리한다.
- 현재 해당 방을 보고 있는 사용자는 일반 채팅 push에서 제외한다.
- 여러 메시지는 일정 시간 동안 그룹화해 한 번에 전송한다.
- 영구 실패 토큰은 비활성화한다.
- 알림 payload에는 민감한 본문 대신 방 ID와 이벤트 ID를 우선 담는다.

대규모 fan-out이 병목이 되면 outbox 작업자만 별도 큐/서버리스 서비스로 이동한다.

## 11. 포인트, 광고, 인앱결제

### 11.1 포인트 원장

잔액을 클라이언트가 직접 수정할 수 없게 한다. `point_transactions`와 `point_ledger_entries`의 복식부기 원장을 사용한다.

- 모든 거래에서 원장 entry 합계는 0이다.
- 사용자 지갑, 시스템 발행, 시스템 소각, 수수료 계정을 분리한다.
- 잔액은 원장 합계가 원본이며 `point_wallets.balance`는 잠금 기반 캐시다.
- `idempotency_key`로 광고/결제 콜백 중복 지급을 막는다.
- 포인트 보내기는 발신/수신 지갑을 동일 트랜잭션에서 잠근다.
- 음수 잔액을 허용하지 않는다.
- 원장 행은 수정/삭제하지 않고 정정 거래를 추가한다.

### 11.2 보상형 광고

1. 앱이 서버에서 광고 보상 nonce를 발급받는다.
2. 사용자가 보상형 광고를 완료한다.
3. 광고 네트워크의 server-side verification(SSV)이 Edge Function을 호출한다.
4. 서명, nonce, 사용자, 광고 단위, 만료, 중복 여부를 검증한다.
5. 검증 성공 시 포인트 발행 거래를 기록한다.

클라이언트의 `onRewarded` 이벤트만으로 포인트를 지급하지 않는다. 일/시간당 보상 횟수와 계정/기기 위험 제한을 둔다.

### 11.3 인앱결제

- 앱은 스토어 상품 ID로 결제하고 transaction ID/영수증을 서버로 보낸다.
- 서버는 Apple App Store Server API 또는 Google Play Developer API로 검증한다.
- bundle/package ID, 상품 ID, 금액/환경, 구매 상태, 취소/환불 상태를 확인한다.
- transaction ID에 unique constraint를 둔다.
- 검증 성공 후에만 포인트를 발행하거나 기능 entitlement를 부여한다.
- Apple/Google 서버 알림으로 환불과 취소를 비동기 반영한다.
- 소비성 포인트와 영구/기간제 기능 entitlement를 별도 모델로 관리한다.

스토어 정책상 디지털 기능과 포인트는 플랫폼 인앱결제를 사용해야 한다. 구체 정책과 수수료는 출시 시점에 다시 확인한다.

## 12. 신고, 차단, 운영

- 멤버 신고와 방 신고는 대상 snapshot, 신고 사유, 신고자, 시각을 저장한다.
- 같은 대상에 대한 반복 신고는 병합하되 서로 다른 신고자는 유지한다.
- 자동 조치는 신고 수만으로 결정하지 않고 계정 신뢰도, 최근성, 증거를 함께 본다.
- 신고자는 대상 사용자를 즉시 로컬/서버 차단할 수 있다.
- 운영자 조회와 조치는 별도 admin API를 통해 수행하고 모두 감사 로그를 남긴다.
- 신고 증거 보존 기간과 개인정보 처리방침을 일치시킨다.

운영 최소 도구에는 신고 큐, 사용자/방 조회, 제재, 원장 조회, 결제 검증 상태, 알림 실패율, 감사 로그가 필요하다.

## 13. API 설계

외부 API는 `/v1` 의미의 안정 계약으로 취급한다. Supabase PostgREST/RPC 이름은 아래 계약을 구현하며, 서버 전용 작업은 Edge Function으로 노출한다.

### 13.1 공통

- 인증: `Authorization: Bearer <JWT>`
- 요청 추적: `X-Request-Id`
- 멱등성: 상태 변경 API에 `Idempotency-Key`
- 페이지네이션: `cursor`, `limit`(기본 30, 최대 100)
- 오류 형식:

```json
{
  "error": {
    "code": "ROOM_MEMBER_LIMIT_REACHED",
    "message": "방의 최대 인원에 도달했습니다.",
    "requestId": "..."
  }
}
```

클라이언트 분기에 쓰는 `code`는 안정적으로 유지하고 사용자 메시지는 변경 가능하게 한다.

### 13.2 주요 엔드포인트

| Method | 경로/RPC | 목적 |
| --- | --- | --- |
| POST | `/auth/request-otp` | OTP 요청, abuse 검사 포함 |
| POST | `/auth/verify-otp` | OTP 검증 및 세션 발급 |
| GET | `/rooms` | 탭/지역/성인/랭킹별 방 목록 |
| GET | `/rooms/search` | 제목/설명/해시태그 검색 |
| POST | `rpc/create_room` | 방 생성과 방장 membership 생성 |
| PATCH | `rpc/update_room` | 권한 검사 후 방 정보 수정 |
| POST | `rpc/request_room_join` | 가입 신청 |
| POST | `rpc/review_room_join` | 가입 승인/거절 |
| POST | `rpc/set_room_permission` | 위임 권한 변경 |
| POST | `rpc/sanction_room_member` | 강퇴/채팅 금지 |
| POST | `rpc/transfer_room_ownership` | 방장 이전 |
| DELETE | `rpc/delete_room` | 방 soft delete |
| GET | `/rooms/{id}/messages` | cursor 기반 메시지 조회 |
| POST | `rpc/send_message` | 검증 후 메시지 전송 |
| POST | `rpc/delete_message` | tombstone 삭제 |
| POST | `/media/upload-ticket` | 용도/크기 제한이 포함된 업로드 권한 |
| POST | `rpc/confirm_media` | 업로드 파일과 콘텐츠 연결 |
| GET/POST | `/rooms/{id}/stories` | 스토리 조회/작성 |
| PATCH/DELETE | `/stories/{id}` | 권한 기반 편집/삭제 |
| POST | `rpc/promote_room` | 무료 프로모션 실행 |
| POST | `rpc/send_points` | 멤버 간 포인트 전송 |
| POST | `/ads/reward-token` | 광고 nonce 발급 |
| POST | `/webhooks/ads/{provider}` | 광고 SSV 검증/지급 |
| POST | `/purchases/verify` | Apple/Google 영수증 검증 |
| POST | `/webhooks/apple` | 스토어 서버 알림 |
| POST | `/webhooks/google` | 실시간 개발자 알림 |
| POST | `/reports` | 멤버/방/콘텐츠 신고 |
| PUT | `/notification-settings` | 전체/방별 알림 설정 |
| POST/DELETE | `/devices/push-token` | push token 등록/해제 |

### 13.3 Realtime 채널

```text
room:{room_id}:messages    메시지 insert/delete
room:{room_id}:stories     스토리 변경
room:{room_id}:presence    비영속 접속 상태
user:{user_id}:events      가입 승인, 제재, 포인트, 알림
```

채널 참가 전 서버가 활성 membership을 검사한다. 데이터베이스 publication과 RLS만 믿지 말고 private channel authorization을 함께 사용한다.

## 14. 비용 절감 전략

### 14.1 초기

- Supabase 한 프로젝트로 Auth/DB/Realtime/Storage/Functions를 통합한다.
- OTP 재발송 cooldown, IP/번호 rate limit으로 SMS 낭비를 막는다.
- 이미지 리사이즈를 기기에서 수행하고 원본을 저장하지 않는다.
- 방 목록은 집계 테이블을 사용하고 짧은 TTL 캐시를 허용한다.
- presence/typing/read receipt를 최소한만 전송한다.
- 알림을 outbox에서 batch 처리한다.
- 로그에 채팅 본문과 토큰을 남기지 않는다.

### 14.2 데이터 수명

- 채팅 보존 기간은 운영/정책 결정 후 명시하고 오래된 메시지는 월 단위 파티션으로 보관 또는 삭제한다.
- orphan media, 만료 promotion, 오래된 notification outbox를 예약 정리한다.
- 감사/결제/포인트 원장은 일반 콘텐츠보다 길게 보존하고 접근을 제한한다.
- 분석 이벤트는 샘플링하고 고카디널리티 payload를 피한다.

### 14.3 분리 기준

다음 신호가 나타날 때만 구성 요소를 분리한다.

- Realtime 연결/변경 이벤트 한계가 지속적으로 임박: 전용 WebSocket 계층 검토
- 알림 backlog가 SLO를 초과: 관리형 큐와 독립 worker 도입
- 검색 p95가 목표 초과 또는 한국어 검색 품질 부족: 전용 검색엔진 도입
- 이미지 변환 CPU/egress 증가: CDN 이미지 변환 서비스 도입
- 메시지 테이블이 운영 쿼리에 영향: 파티셔닝/읽기 복제본/보관 DB 적용

## 15. 보안 기준

- 모든 공개 스키마 테이블에 RLS를 활성화하고 기본 deny로 시작한다.
- service role key는 Edge Function/CI 비밀 저장소에만 둔다.
- 앱에는 publishable/anon key만 포함한다.
- 포인트, 결제, 제재, 방장 변경은 SECURITY DEFINER 함수에서 `search_path`를 고정한다.
- 동적 SQL을 피하고 입력 길이, enum, UUID를 서버에서 검증한다.
- 파일 업로드는 허용 MIME/크기/픽셀을 제한하고 실행형 파일을 거부한다.
- OTP, 메시지, 가입 신청, 신고, 광고 보상에 rate limit을 적용한다.
- 사용자 차단이 검색, 알림, 메시지 조회에 일관되게 반영되도록 테스트한다.
- DB 백업과 point ledger 복구 절차를 정기 검증한다.
- 개인정보 export/탈퇴/삭제 요청 절차를 제공한다.
- 운영 로그에서 전화번호, JWT, 영수증 원문, CI/DI, 채팅 본문을 마스킹한다.

위협 모델의 우선순위는 계정 대량 생성, SMS 폭탄, 채팅 도배, 비공개 이미지 URL 유출, 권한 상승, 포인트 이중 지급, 위조 영수증, 광고 리워드 재사용이다.

## 16. 관측성과 운영 지표

### 서비스 SLO 초안

- 메시지 저장 API p95: 500ms 이하
- 온라인 메시지 전달 p95: 1초 이하
- 방 목록 API p95: 800ms 이하
- push outbox 처리: 95%가 60초 이내
- 결제 검증: 99%가 30초 이내, 실패 시 재처리 가능

### 핵심 지표

- OTP 요청/성공/실패율과 번호·IP별 차단량
- 동시 Realtime 연결 수, 이벤트 전달 지연
- 메시지 insert 수, 실패율, 중복 방지 횟수
- 이미지 평균 업로드 크기와 egress
- 검색 latency와 검색 후 가입 신청 전환
- promotion 실행 수와 신규 가입 전환
- 알림 발송/도달/비활성 token 비율
- 포인트 발행/소각/전송 및 원장 불일치 검사
- 광고 SSV 거절률, 결제 검증/환불률
- 신고 처리 시간과 재발률

## 17. 단계별 구현 순서

### Phase 1: 기반

- Auth, 사용자, 방, 방별 프로필, 가입 승인
- RLS와 감사 로그
- 텍스트 채팅, cursor 조회, Realtime
- 기본 검색과 방 목록

### Phase 2: 미디어와 운영

- 이미지 전처리/Storage
- 스토리, 신고/차단, 권한/제재
- Expo push와 outbox
- 프로모션/활성 랭킹

### Phase 3: 수익화

- 포인트 복식부기 원장
- 멤버 간 전송
- 광고 SSV
- Apple/Google 인앱결제 및 환불 처리
- 테마/색상 entitlement

각 Phase는 RLS 테스트, 동시성 테스트, 비용 대시보드, 운영 runbook까지 완료해야 종료한다.
