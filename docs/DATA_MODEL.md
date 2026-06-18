# Mute Chat 데이터 모델

## 1. 모델링 원칙

- PostgreSQL을 시스템의 최종 원본으로 사용한다.
- 모든 주 키는 `uuid`를 사용한다. 시간순 정렬이 중요한 신규 엔티티는 UUIDv7 사용을 권장한다.
- 시각은 `timestamptz`, 금액/포인트는 정수형을 사용한다.
- 사용자 삭제 가능 데이터는 `deleted_at` 기반 soft delete를 우선한다.
- 권한이 필요한 상태 변경은 RPC에서 트랜잭션과 row lock을 사용한다.
- 모든 클라이언트 접근 테이블은 RLS를 활성화하고 기본 deny 정책을 적용한다.
- JSONB는 공급자 원본이나 확장 메타데이터처럼 스키마 변동이 불가피한 곳에만 쓴다.
- 전화번호, CI/DI, 영수증 원문을 일반 업무 테이블에 저장하지 않는다.

이 문서의 `auth.users`는 Supabase Auth 관리 테이블이며 앱에서 직접 수정하지 않는다.

## 2. Enum

구현 시 PostgreSQL enum 또는 CHECK constraint 중 마이그레이션 전략에 맞는 방식을 선택한다.

```text
user_status:
  active | suspended | deleted

room_visibility:
  public | unlisted

room_status:
  active | frozen | deleted

room_category:
  member | regional | adult | general

membership_status:
  pending | active | rejected | left | kicked | banned

room_permission:
  approve_members | kick_members | mute_members | rename_members
  | manage_stories | edit_room_info | edit_room_image
  | edit_member_limit

sanction_type:
  mute | kick | ban

message_type:
  text | image | system

media_status:
  pending | ready | rejected | deleted

report_target_type:
  user | room | message | story

report_status:
  open | reviewing | resolved | dismissed

point_transaction_type:
  ad_reward | purchase | peer_transfer | feature_spend
  | refund | admin_adjustment | reversal

purchase_platform:
  apple | google

purchase_status:
  pending | verified | rejected | refunded | revoked
```

## 3. 계정과 인증

### 3.1 `users`

`auth.users`와 1:1인 앱 계정이다.

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK, FK `auth.users(id)` |
| `status` | user_status | NOT NULL, default `active` |
| `phone_masked` | text | 예: `010-****-1234`, nullable |
| `phone_hmac` | text | 선택, 서버 HMAC 결과, UNIQUE |
| `global_notifications_enabled` | boolean | NOT NULL default true |
| `terms_version` | text | 동의한 약관 버전 |
| `terms_accepted_at` | timestamptz | 약관 동의 시각 |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |
| `deleted_at` | timestamptz | nullable |

RLS:

- 본인은 자신의 비민감 행을 읽을 수 있다.
- 본인은 허용된 설정만 갱신할 수 있다.
- `status`, HMAC, 삭제 필드는 서버만 갱신한다.

### 3.2 `identity_verifications`

법적 본인/성인 인증의 최소 결과만 저장한다.

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | FK `users`, NOT NULL |
| `provider` | text | NOT NULL |
| `purpose` | text | `identity` 또는 `adult` |
| `subject_hmac` | text | CI/DI 등 원문을 HMAC 처리 |
| `result` | text | `verified`, `failed`, `expired` |
| `adult_verified` | boolean | NOT NULL default false |
| `verified_at` | timestamptz | nullable |
| `expires_at` | timestamptz | nullable |
| `provider_reference` | text | 민감정보가 아닌 추적 ID |
| `created_at` | timestamptz | NOT NULL |

제약/인덱스:

- 필요 시 `(purpose, subject_hmac)` partial unique index로 중복 가입을 통제한다.
- `subject_hmac`는 애플리케이션 서버만 읽을 수 있다.
- 인증 공급자의 전체 응답은 단기 암호화 보관 후 삭제하거나 저장하지 않는다.

### 3.3 `user_blocks`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `blocker_user_id` | uuid | FK `users` |
| `blocked_user_id` | uuid | FK `users` |
| `created_at` | timestamptz | NOT NULL |

PK는 `(blocker_user_id, blocked_user_id)`, 본인 차단 금지 CHECK를 둔다.

### 3.4 `push_devices`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | FK `users`, NOT NULL |
| `expo_push_token` | text | UNIQUE, NOT NULL |
| `platform` | text | `ios`, `android` |
| `app_version` | text | nullable |
| `locale` | text | nullable |
| `enabled` | boolean | NOT NULL default true |
| `last_seen_at` | timestamptz | NOT NULL |
| `created_at` | timestamptz | NOT NULL |
| `disabled_at` | timestamptz | nullable |

## 4. 방과 방별 프로필

### 4.1 `rooms`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `owner_user_id` | uuid | FK `users`, NOT NULL |
| `title` | varchar(80) | NOT NULL |
| `description` | varchar(1000) | NOT NULL default `''` |
| `representative_media_id` | uuid | FK `media_assets`, nullable |
| `visibility` | room_visibility | NOT NULL default `public` |
| `status` | room_status | NOT NULL default `active` |
| `category` | room_category | NOT NULL |
| `region_code` | text | FK `regions`, nullable |
| `adult_only` | boolean | NOT NULL default false |
| `max_members` | integer | NOT NULL, CHECK 범위 예: 2~500 |
| `active_member_count` | integer | NOT NULL default 1, 캐시 |
| `search_text` | text | 정규화된 제목+설명 |
| `last_message_at` | timestamptz | nullable, 목록 캐시 |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |
| `deleted_at` | timestamptz | nullable |

제약:

- `adult_only = true`이면 `category = adult`가 되도록 CHECK 또는 서버 검증한다.
- `active_member_count`는 RPC/트리거로만 수정한다.
- owner는 반드시 해당 방의 active membership을 가져야 한다. 이 교차 테이블 불변식은 deferred constraint trigger 또는 RPC로 보장한다.

인덱스:

- `(status, category, region_code)`
- `(last_message_at DESC) WHERE status = 'active'`
- `GIN (search_text gin_trgm_ops)`
- `owner_user_id`

### 4.2 `regions`

운영에서 지역 목록을 변경할 수 있게 코드 테이블로 둔다.

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `code` | text | PK, 예: `SEOUL`, `GYEONGGI_SOUTH` |
| `name_ko` | text | UNIQUE, NOT NULL |
| `sort_order` | integer | NOT NULL |
| `enabled` | boolean | NOT NULL default true |

### 4.3 `hashtags`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `normalized_name` | varchar(40) | UNIQUE, NOT NULL |
| `display_name` | varchar(40) | NOT NULL |
| `created_at` | timestamptz | NOT NULL |

`normalized_name`은 `#` 제거, Unicode 정규화, 소문자화, 앞뒤 공백 제거 결과다.

### 4.4 `room_hashtags`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `room_id` | uuid | FK `rooms` ON DELETE CASCADE |
| `hashtag_id` | uuid | FK `hashtags` |
| `position` | smallint | 표시 순서 |

PK `(room_id, hashtag_id)`. 방당 태그 개수는 RPC에서 제한한다.

### 4.5 `room_memberships`

가입 신청과 현재/과거 멤버 상태를 한 행으로 관리한다.

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `room_id` | uuid | FK `rooms`, NOT NULL |
| `user_id` | uuid | FK `users`, NOT NULL |
| `status` | membership_status | NOT NULL |
| `join_message` | varchar(500) | nullable |
| `requested_at` | timestamptz | nullable |
| `reviewed_at` | timestamptz | nullable |
| `reviewed_by_user_id` | uuid | FK `users`, nullable |
| `joined_at` | timestamptz | nullable |
| `left_at` | timestamptz | nullable |
| `rejoin_blocked_until` | timestamptz | nullable |
| `last_read_message_id` | uuid | nullable, FK는 파티셔닝 고려 시 생략 가능 |
| `last_read_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

제약/인덱스:

- UNIQUE `(room_id, user_id)`
- `(user_id, status)`
- `(room_id, status, requested_at)`로 가입 대기열 조회
- active 전환 시 방 행을 `FOR UPDATE`로 잠그고 `active_member_count < max_members`를 확인한다.

RLS:

- 본인은 자신의 membership을 읽는다.
- active 멤버는 같은 방의 공개 가능한 active 멤버 목록을 읽는다.
- 신청/승인/탈퇴/제재 상태 변경은 RPC만 허용한다.

### 4.6 `room_profiles`

사용자의 방별 반익명 프로필이다.

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `room_id` | uuid | FK `rooms` |
| `user_id` | uuid | FK `users` |
| `display_name` | varchar(30) | NOT NULL |
| `bio` | varchar(160) | NOT NULL default `''` |
| `profile_media_id` | uuid | FK `media_assets`, nullable |
| `bubble_color` | varchar(9) | nullable, 허용 팔레트 검증 |
| `text_color` | varchar(9) | nullable, 대비율 검증 |
| `updated_at` | timestamptz | NOT NULL |
| `created_at` | timestamptz | NOT NULL |

PK `(room_id, user_id)`. active/pending membership이 있는 사용자만 생성할 수 있다.

다른 멤버가 이름을 변경한 경우 원래 사용자에게 이벤트를 보내며 `room_audit_logs`에 남긴다.

### 4.7 부방장 역할

`room_members.role`은 `member`, `co_host`, `owner`를 사용한다.

- 방장은 방마다 1명이다.
- 부방장은 한 방에 여러 명 존재할 수 있다.
- 방장만 멤버를 부방장으로 지정하거나 해제할 수 있다.
- 부방장은 가입 승인, 제재, 이름 변경, 스토리 관리, 방 정보 수정을 수행할 수 있다.
- 방 삭제, 방장 양도, 부방장 역할 변경은 방장 전용 RPC로 제한한다.
- 모든 역할 변경은 `room_audit_logs`에 기록한다.

### 4.8 `room_sanctions`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `room_id` | uuid | FK `rooms`, NOT NULL |
| `target_user_id` | uuid | FK `users`, NOT NULL |
| `type` | sanction_type | NOT NULL |
| `reason` | varchar(500) | nullable |
| `starts_at` | timestamptz | NOT NULL |
| `ends_at` | timestamptz | nullable |
| `created_by_user_id` | uuid | FK `users`, NOT NULL |
| `revoked_at` | timestamptz | nullable |
| `revoked_by_user_id` | uuid | FK `users`, nullable |
| `created_at` | timestamptz | NOT NULL |

인덱스:

- `(room_id, target_user_id, type, ends_at) WHERE revoked_at IS NULL`
- `send_message`는 현재 시각에 유효한 mute를 확인한다.

## 5. 채팅과 스토리

### 5.1 `messages`

트래픽 증가 시 `created_at` 월 단위 range partitioning을 적용한다.

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `room_id` | uuid | FK `rooms`, NOT NULL |
| `sender_user_id` | uuid | FK `users`, nullable(system 가능) |
| `client_message_id` | uuid | NOT NULL |
| `type` | message_type | NOT NULL |
| `body` | varchar(4000) | nullable |
| `media_id` | uuid | FK `media_assets`, nullable |
| `reply_to_message_id` | uuid | nullable |
| `metadata` | jsonb | system message의 제한된 payload |
| `created_at` | timestamptz | NOT NULL, 서버 시각 |
| `deleted_at` | timestamptz | nullable |
| `deleted_by_user_id` | uuid | FK `users`, nullable |

제약:

- UNIQUE `(room_id, sender_user_id, client_message_id)`
- text는 `body` 필수, image는 `media_id` 필수
- 삭제 시 `body`, 민감 metadata를 비우고 tombstone은 유지한다.

인덱스:

- `(room_id, created_at DESC, id DESC)`
- `(sender_user_id, created_at DESC)`는 운영/신고 조회가 필요할 때만 추가
- 파티션 적용 후 unique 제약은 partition key 포함 여부를 고려해 조정한다.

RLS:

- 현재 active 멤버만 해당 방 메시지를 조회한다.
- insert/update/delete 직접 권한은 차단하고 RPC를 사용한다.
- 차단 사용자 메시지 숨김은 API query 또는 클라이언트 필터만이 아니라 서버 응답에도 반영한다.

### 5.2 `stories`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `room_id` | uuid | FK `rooms`, NOT NULL |
| `author_user_id` | uuid | FK `users`, NOT NULL |
| `title` | varchar(120) | NOT NULL |
| `body` | text | NOT NULL, 최대 길이 제한 |
| `pinned` | boolean | NOT NULL default false |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |
| `deleted_at` | timestamptz | nullable |

인덱스 `(room_id, pinned DESC, created_at DESC)`.

작성/편집 가능자는 방장 또는 `MANAGE_STORIES` 권한자다. 작성자 본인 권한 정책은 제품 정책에 따라 추가하되, 서버에서 일관되게 적용한다.

### 5.3 `story_media`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `story_id` | uuid | FK `stories` ON DELETE CASCADE |
| `media_id` | uuid | FK `media_assets` |
| `position` | smallint | NOT NULL |

PK `(story_id, media_id)`.

## 6. 미디어

### 6.1 `media_assets`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `owner_user_id` | uuid | FK `users`, NOT NULL |
| `room_id` | uuid | FK `rooms`, nullable |
| `purpose` | text | `profile`, `room`, `message`, `story` |
| `status` | media_status | NOT NULL default `pending` |
| `bucket` | text | NOT NULL |
| `storage_path` | text | UNIQUE, NOT NULL |
| `thumbnail_path` | text | nullable |
| `mime_type` | text | 허용 목록 |
| `byte_size` | integer | CHECK > 0 및 용도별 상한 |
| `width` | integer | CHECK > 0 |
| `height` | integer | CHECK > 0 |
| `sha256` | text | 무결성/중복 탐지 |
| `created_at` | timestamptz | NOT NULL |
| `confirmed_at` | timestamptz | nullable |
| `deleted_at` | timestamptz | nullable |

인덱스:

- `(status, created_at)`로 orphan 정리
- `(room_id, purpose)`
- `sha256`는 전역 dedup을 자동 적용하지 않고 악성/중복 분석에 사용한다.

스토리지 정책:

- private bucket을 기본으로 한다.
- `pending` asset은 소유자만 접근한다.
- `ready` asset은 연결된 방/콘텐츠를 볼 수 있는 사용자만 signed URL을 발급받는다.
- DB 삭제와 Storage 삭제는 outbox를 통해 재시도 가능하게 한다.

## 7. 탑스페이스와 활성 랭킹

### 7.1 `room_top_space_events`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `room_id` | uuid | FK `rooms`, NOT NULL |
| `created_by_user_id` | uuid | FK `users`, NOT NULL |
| `point_ledger_entry_id` | uuid | FK `point_ledger`, UNIQUE |
| `point_cost` | integer | NOT NULL, positive |
| `duration_seconds` | integer | NOT NULL, positive |
| `starts_at` | timestamptz | NOT NULL |
| `expires_at` | timestamptz | NOT NULL |
| `created_at` | timestamptz | NOT NULL |

인덱스 `(room_id, expires_at DESC)`, `(expires_at DESC)`, `(created_at DESC)`.

`boost_top_space` RPC는 활성 멤버 여부, 포인트 잔액, 중복 요청 토큰을 확인하고 포인트 차감과 이벤트 생성을 한 트랜잭션에서 수행한다. 모든 멤버가 실행할 수 있다. 이미 노출 중이면 `starts_at`은 기존 `expires_at`, 아니면 현재 시각이며 구매 시간은 뒤에 누적한다.

상품표:

| 포인트 | 노출 시간 |
| ---: | ---: |
| 100P | 10분 |
| 500P | 1시간 |
| 1,000P | 3시간 |
| 2,000P | 8시간 |
| 5,000P | 1일 |
| 10,000P | 3일 |
| 30,000P | 10일 |
| 50,000P | 30일 |

현재 시각보다 `expires_at`이 늦은 이벤트가 하나도 없으면 홈에는 `Top` 섹션을 렌더링하지 않고 `Hot`만 표시한다.

### 7.2 `room_activity_buckets`

5분 단위 자연 활동 집계다.

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `room_id` | uuid | FK `rooms` |
| `bucket_started_at` | timestamptz | 5분 경계 |
| `valid_message_count` | integer | NOT NULL default 0 |
| `unique_sender_count` | integer | NOT NULL default 0 |
| `join_approval_count` | integer | NOT NULL default 0 |
| `spam_penalty` | numeric | NOT NULL default 0 |

PK `(room_id, bucket_started_at)`. 오래된 raw bucket은 집계 보존 기간 후 삭제한다.

고유 발신자 집계는 메시지마다 배열을 누적하지 않는다. 필요하면 `(room_id, bucket, user_id)` 임시 집계 테이블 또는 HyperLogLog 확장을 검토한다. 초기에는 트래픽이 낮으므로 distinct 집계를 예약 작업에서 수행할 수 있다.

### 7.3 `room_rankings`

목록 조회용 materialized/cache 테이블이다.

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `room_id` | uuid | PK, FK `rooms` |
| `top_space_count` | bigint | NOT NULL default 0 |
| `activity_score` | numeric | NOT NULL default 0 |
| `activity_ranked_at` | timestamptz | NOT NULL |
| `last_top_spaced_at` | timestamptz | nullable |
| `updated_at` | timestamptz | NOT NULL |

전체 랭킹은 탭 구분 없이 `top_space_count DESC`로 정렬한다. Hot의 자연 활동 점수와 탑스페이스 누적 횟수는 별도 기준으로 유지한다.

인덱스:

- `(activity_score DESC, activity_ranked_at DESC)`
- `(top_space_count DESC, last_top_spaced_at DESC)`

## 8. 알림

### 8.1 `room_notification_settings`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `room_id` | uuid | FK `rooms` |
| `user_id` | uuid | FK `users` |
| `enabled` | boolean | NOT NULL default true |
| `messages_enabled` | boolean | NOT NULL default true |
| `stories_enabled` | boolean | NOT NULL default true |
| `updated_at` | timestamptz | NOT NULL |

PK `(room_id, user_id)`.

### 8.2 `notification_outbox`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `recipient_user_id` | uuid | FK `users`, NOT NULL |
| `event_type` | text | NOT NULL |
| `room_id` | uuid | nullable |
| `object_id` | uuid | nullable |
| `dedupe_key` | text | nullable |
| `payload` | jsonb | 최소 push payload |
| `available_at` | timestamptz | NOT NULL |
| `attempt_count` | integer | NOT NULL default 0 |
| `processed_at` | timestamptz | nullable |
| `last_error_code` | text | nullable |
| `created_at` | timestamptz | NOT NULL |

인덱스 `(available_at, created_at) WHERE processed_at IS NULL`.

`dedupe_key`로 짧은 시간의 동일 방 메시지를 묶는다. 작업자는 `FOR UPDATE SKIP LOCKED`로 병렬 소비한다.

## 9. 포인트와 상품

### 9.1 `point_accounts`

사용자 및 시스템 계정이다.

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `owner_user_id` | uuid | FK `users`, nullable |
| `account_type` | text | `user`, `issuance`, `sink`, `fee` |
| `currency` | text | NOT NULL default `POINT` |
| `created_at` | timestamptz | NOT NULL |
| `closed_at` | timestamptz | nullable |

제약:

- 사용자 계정은 `(owner_user_id, currency)` UNIQUE.
- 시스템 계정은 `owner_user_id IS NULL`.

### 9.2 `point_wallets`

빠른 잔액 조회용 캐시다.

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `account_id` | uuid | PK, FK `point_accounts` |
| `balance` | bigint | NOT NULL default 0 |
| `version` | bigint | NOT NULL default 0 |
| `updated_at` | timestamptz | NOT NULL |

사용자 지갑에는 `balance >= 0` CHECK를 둔다. 시스템 발행 계정은 음수 허용 여부를 별도 정책으로 둔다.

### 9.3 `point_transactions`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `type` | point_transaction_type | NOT NULL |
| `idempotency_key` | text | UNIQUE, NOT NULL |
| `actor_user_id` | uuid | FK `users`, nullable |
| `reference_type` | text | `ad_reward`, `purchase`, `feature` 등 |
| `reference_id` | text | 공급자/업무 ID |
| `description` | text | 민감정보 제외 |
| `metadata` | jsonb | 제한된 감사 메타데이터 |
| `created_at` | timestamptz | NOT NULL |
| `reversed_by_transaction_id` | uuid | self FK, nullable |

### 9.4 `point_ledger_entries`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `transaction_id` | uuid | FK `point_transactions`, NOT NULL |
| `account_id` | uuid | FK `point_accounts`, NOT NULL |
| `amount` | bigint | NOT NULL, 0 금지 |
| `created_at` | timestamptz | NOT NULL |

제약/규칙:

- 거래별 `SUM(amount) = 0`을 deferred constraint trigger 또는 원장 기록 RPC로 보장한다.
- 원장 행 UPDATE/DELETE를 DB 권한으로 금지한다.
- 거래 기록 시 관련 `point_wallets`를 account ID 순으로 잠가 deadlock을 줄인다.
- 잔액 캐시와 원장 합계를 주기적으로 대사한다.

멤버 간 100 포인트 전송 예:

```text
sender user account   -100
receiver user account +100
합계                     0
```

광고로 100 포인트 발행 예:

```text
system issuance account -100
user account             +100
합계                        0
```

### 9.5 `products`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `code` | text | UNIQUE, 내부 상품 코드 |
| `type` | text | `point_pack`, `theme`, `bubble_color` 등 |
| `apple_product_id` | text | UNIQUE nullable |
| `google_product_id` | text | UNIQUE nullable |
| `point_amount` | bigint | nullable |
| `enabled` | boolean | NOT NULL default true |
| `metadata` | jsonb | 표시/기능 메타데이터 |
| `created_at` | timestamptz | NOT NULL |

가격은 앱/DB 하드코딩값이 아니라 스토어 조회 결과를 표시한다.

### 9.6 `purchases`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | FK `users`, NOT NULL |
| `product_id` | uuid | FK `products`, NOT NULL |
| `platform` | purchase_platform | NOT NULL |
| `store_transaction_id` | text | UNIQUE, NOT NULL |
| `original_transaction_id` | text | nullable |
| `status` | purchase_status | NOT NULL |
| `environment` | text | `sandbox`, `production` |
| `purchased_at` | timestamptz | nullable |
| `verified_at` | timestamptz | nullable |
| `refunded_at` | timestamptz | nullable |
| `point_transaction_id` | uuid | FK `point_transactions`, nullable |
| `verification_payload` | jsonb | 최소 검증 결과, 영수증 원문 제외 |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

### 9.7 `ad_reward_claims`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK, nonce로 사용 가능 |
| `user_id` | uuid | FK `users`, NOT NULL |
| `provider` | text | NOT NULL |
| `ad_unit_id` | text | NOT NULL |
| `provider_event_id` | text | UNIQUE nullable |
| `status` | text | `issued`, `verified`, `rejected`, `expired` |
| `reward_amount` | bigint | NOT NULL |
| `expires_at` | timestamptz | NOT NULL |
| `verified_at` | timestamptz | nullable |
| `point_transaction_id` | uuid | FK `point_transactions`, nullable |
| `created_at` | timestamptz | NOT NULL |

`provider_event_id`, nonce, point transaction id의 unique 제약으로 중복 지급을 방지한다.

### 9.8 `user_entitlements`

포인트 잔액과 구매한 기능 권리를 분리한다.

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | FK `users`, NOT NULL |
| `entitlement_code` | text | NOT NULL |
| `source_type` | text | `purchase`, `point_spend`, `promotion` |
| `source_id` | uuid | 업무 원본 ID |
| `starts_at` | timestamptz | NOT NULL |
| `ends_at` | timestamptz | nullable |
| `revoked_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL |

활성 entitlement 조회용 `(user_id, entitlement_code, ends_at) WHERE revoked_at IS NULL` 인덱스를 둔다.

## 10. 신고와 감사

### 10.1 `reports`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `reporter_user_id` | uuid | FK `users`, NOT NULL |
| `target_type` | report_target_type | NOT NULL |
| `target_id` | uuid | NOT NULL |
| `room_id` | uuid | FK `rooms`, nullable |
| `reason_code` | text | NOT NULL |
| `description` | varchar(1000) | nullable |
| `evidence_snapshot` | jsonb | 신고 시점의 최소 증거 |
| `status` | report_status | NOT NULL default `open` |
| `assigned_admin_id` | uuid | 관리자 식별자, nullable |
| `resolved_at` | timestamptz | nullable |
| `resolution_code` | text | nullable |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

인덱스:

- `(status, created_at)`
- `(target_type, target_id, created_at DESC)`
- `(reporter_user_id, created_at DESC)`

신고자는 자신의 신고 상태만 제한적으로 읽고, 다른 신고자의 정보와 내부 처리 메모는 볼 수 없다.

### 10.2 `room_audit_logs`

| 컬럼 | 타입 | 제약/설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `room_id` | uuid | FK `rooms`, NOT NULL |
| `actor_user_id` | uuid | FK `users`, nullable(system 가능) |
| `action` | text | NOT NULL |
| `target_user_id` | uuid | FK `users`, nullable |
| `target_object_id` | uuid | nullable |
| `before_data` | jsonb | 민감정보 제외 |
| `after_data` | jsonb | 민감정보 제외 |
| `request_id` | text | 추적 ID |
| `created_at` | timestamptz | NOT NULL |

인덱스 `(room_id, created_at DESC)`, `(actor_user_id, created_at DESC)`.

일반 멤버는 읽을 수 없고 방장에게도 필요한 일부 이력만 별도 view로 제공한다. 전체 로그는 운영자 전용이다.

### 10.3 `admin_audit_logs`

운영자의 신고 처리, 계정 제재, 포인트 정정, 데이터 조회를 기록한다. append-only이며 별도 admin schema에 두는 것을 권장한다.

## 11. 서버 작업용 Outbox

### 11.1 `storage_deletion_outbox`

DB soft delete 후 Storage 파일 삭제를 재시도한다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `media_id` | uuid | 대상 |
| `storage_path` | text | 삭제 경로 |
| `available_at` | timestamptz | 처리 가능 시각 |
| `attempt_count` | integer | 재시도 횟수 |
| `processed_at` | timestamptz | 완료 시각 |
| `last_error_code` | text | 오류 코드 |

### 11.2 `webhook_events`

외부 webhook의 중복 처리와 감사를 위한 테이블이다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `provider` | text | 광고/Apple/Google |
| `provider_event_id` | text | 공급자 이벤트 ID |
| `event_type` | text | 이벤트 종류 |
| `signature_valid` | boolean | 서명 검증 결과 |
| `status` | text | `received`, `processed`, `failed` |
| `payload_hash` | text | 원문 대신 해시 |
| `attempt_count` | integer | 처리 횟수 |
| `received_at` | timestamptz | 수신 시각 |
| `processed_at` | timestamptz | 완료 시각 |

UNIQUE `(provider, provider_event_id)`.

## 12. 주요 트랜잭션

### 12.1 방 생성

1. 사용자 상태와 생성 rate limit 확인
2. `rooms` insert
3. owner의 `room_memberships(active)` insert
4. `room_profiles` insert
5. 해시태그 upsert 및 연결
6. `room_audit_logs` insert
7. commit

실패 시 전체 rollback한다.

### 12.2 가입 승인

1. room과 신청 membership을 `FOR UPDATE`로 잠금
2. 승인자 권한 확인
3. 방 상태와 최대 인원 확인
4. pending을 active로 변경
5. `rooms.active_member_count + 1`
6. 감사 로그와 사용자 이벤트/outbox 기록
7. commit

### 12.3 메시지 전송

1. membership과 room 상태 확인
2. 유효 mute/ban 확인
3. rate limit 확인
4. `(room, sender, client_message_id)` 중복 확인
5. message insert
6. room의 `last_message_at` 갱신
7. activity 집계 이벤트 및 알림 outbox 생성
8. commit

중복 키 충돌 시 기존 message를 반환해 클라이언트 재시도를 성공으로 처리한다.

### 12.4 포인트 전송

1. idempotency key로 기존 거래 확인
2. 발신/수신 계정을 고정된 순서로 `FOR UPDATE`
3. 발신 잔액과 제한 확인
4. transaction insert
5. 두 ledger entry insert
6. 두 wallet balance/version 갱신
7. 합계 0 확인 후 commit

### 12.5 결제 포인트 지급

1. store transaction ID 중복 확인
2. 스토어 서버 검증
3. purchase 행 잠금/upsert
4. verified 상태가 최초인 경우만 point transaction 생성
5. issuance/user ledger entry와 wallet 갱신
6. purchase에 point transaction 연결
7. commit

## 13. RLS 정책 요약

| 데이터 | 읽기 | 쓰기 |
| --- | --- | --- |
| 사용자 설정 | 본인 | 본인 허용 필드만 |
| 방 공개 정보 | 공개 조건을 만족하는 사용자 | 방장/권한자의 RPC |
| 가입 신청 | 본인, 방장/승인 권한자 | RPC |
| 방별 프로필 | 같은 방 active 멤버 | 본인 또는 이름 변경 권한 RPC |
| 메시지 | 같은 방 active 멤버 | `send_message` RPC |
| 스토리 | 같은 방 active 멤버 | 방장/스토리 권한 RPC |
| 미디어 | 연결 콘텐츠 접근 가능자 | 업로드 ticket + confirm RPC |
| 포인트 잔액 | 본인 | 서버 RPC만 |
| 포인트 원장 | 본인에게 노출할 view만 | 서버 RPC만, UPDATE/DELETE 금지 |
| 결제/광고 | 본인 요약 | Edge Function만 |
| 신고 | 신고자 본인 요약 | create만, 처리 변경은 admin |
| 감사 로그 | 제한된 운영/방장 view | 서버만 |

RLS 함수는 재귀 쿼리와 권한 우회를 피하도록 `security definer` helper를 최소화한다. helper 함수는 `search_path`를 고정하고 execute 권한을 명시한다.

## 14. 데이터 보존과 삭제

정확한 기간은 개인정보 처리방침과 국내 법률 검토 후 확정한다.

| 데이터 | 권장 초기 정책 |
| --- | --- |
| 미연결 pending media | 24시간 후 삭제 |
| 처리 완료 notification outbox | 7~30일 후 삭제 |
| room activity raw bucket | 30~90일 후 삭제 |
| 만료 promotion | 분석 필요 기간 후 집계만 유지 |
| 일반 채팅/스토리 | 제품 정책에 따른 보존 후 삭제/보관 |
| 탈퇴 사용자 프로필 | 즉시 비식별화, 유예 후 미디어 삭제 |
| 신고 증거 | 분쟁/정책상 필요한 기간 제한 보관 |
| 포인트/결제/감사 | 회계·분쟁·법적 요구에 맞춰 장기 보관 |

탈퇴 시:

- `users`를 deleted 상태로 전환하고 표시 정보를 익명화한다.
- 방별 프로필은 `탈퇴한 사용자`로 대체한다.
- 메시지는 대화 문맥/신고 증거 정책에 따라 작성자 연결을 비식별화한다.
- point ledger와 purchase는 삭제하지 않고 사용자 연결을 제한된 별도 키로 보존한다.
- push token과 활성 세션은 즉시 폐기한다.

## 15. 무결성 점검 작업

예약 작업으로 다음을 검사하고 이상 시 경고한다.

- `rooms.active_member_count`와 실제 active membership 수 불일치
- 방장 membership 누락 또는 owner가 둘 이상인 상태
- 거래별 ledger 합계가 0이 아닌 경우
- wallet balance와 ledger 합계 불일치
- verified purchase/ad claim인데 point transaction이 없는 경우
- 만료 sanction이 활성 동작에 영향을 주는 경우
- 콘텐츠 연결이 없는 ready media
- 삭제된 방의 활성 promotion/realtime 접근
- 처리 지연 notification/storage outbox

자동 수정은 카운터/캐시처럼 원본이 명확한 항목에만 적용한다. 포인트와 결제 이상은 자동 덮어쓰기하지 않고 운영 경보와 정정 거래를 사용한다.
