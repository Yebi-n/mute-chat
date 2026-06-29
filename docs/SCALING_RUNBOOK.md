# Mute Scaling And Incident Runbook

## 목표

- 채팅 저장 API p95 500ms 이하
- 채팅 화면 반영 p95 1초 이하
- 방 목록 p95 800ms 이하
- Push outbox의 가장 오래된 대기 작업 60초 이하
- 데이터 손실 없이 기능을 단계적으로 축소할 수 있을 것

## 현재 방어 장치

- 채팅은 최근 50개를 우선 읽고 이전 메시지는 cursor 방식으로 추가 조회한다.
- Realtime 이벤트는 250~300ms 동안 병합하며 이전 조회가 끝나기 전에 같은 조회를 중복 실행하지 않는다.
- Storage signed URL은 앱 프로세스에서 50분 동안 최대 2,000개 캐시한다.
- 방 대표 이미지는 개별 URL 요청이 아니라 일괄 signed URL 요청을 사용한다.
- Push outbox는 `FOR UPDATE SKIP LOCKED`로 최대 100건을 원자적으로 선점한다.
- Expo Push 요청도 최대 100개 메시지 단위로 묶는다.
- Push 실패는 최대 5회 재시도하고 영구 실패로 전환한다.
- 사용자별 채팅 제한은 3초에 15건, 1분에 100건이다. 정상적인 연속 채팅과 사진 5장 전송은 허용한다.
- 채팅 본문은 DB에서 최대 2,000자로 제한한다.

## Supabase 용량 기준

Supabase 공식 Realtime 기본 한도는 요금제에 따라 달라진다. 2026-06-29 기준 Free는 동시 연결 200개와 초당 메시지 100개, Pro는 동시 연결 500개와 초당 메시지 500개다.

- 공식 문서: https://supabase.com/docs/guides/realtime/limits
- Edge Function 제한: https://supabase.com/docs/guides/functions/limits

다음 중 하나가 15분 이상 지속되면 요금제 또는 구조 확장을 검토한다.

| 지표 | 경고 | 조치 |
| --- | ---: | --- |
| Realtime 동시 연결 | 요금제 한도의 60% | 채널 수 확인, Pro 전환 준비 |
| Realtime 초당 메시지 | 한도의 60% | 불필요한 구독 제거, Broadcast 전환 검토 |
| DB CPU | 60% | 느린 쿼리와 인덱스 점검 |
| DB CPU | 80% | 쓰기 외 기능 축소, compute 증설 |
| DB 연결 | 70% | 연결 누수 확인, Supavisor 사용 점검 |
| DB/Storage 용량 | 70% | 보존 정책 실행, 용량 증설 준비 |
| Push backlog 최고 대기 | 60초 | worker/Cron 상태 확인 |
| Push backlog | 1,000건 | worker 주기 단축 또는 별도 worker 검토 |
| API 5xx | 1% | 배포 중단, 최근 변경 롤백 검토 |

## 반드시 설정할 작업

### 1. Push worker

Supabase Cron 또는 신뢰 가능한 스케줄러에서 `send-push-outbox`를 1분마다 실행한다. 앱의 즉시 호출은 지연 감소용이고 Cron은 유실 방지용이다.

### 2. 임시 데이터 정리

매일 새벽 아래 함수를 service role 또는 Supabase Cron으로 실행한다.

```sql
select * from public.cleanup_transient_operational_data();
```

- 전송 완료 push: 7일 보관
- 영구 실패 push: 14일 보관
- 읽은 인앱 알림: 90일 보관

### 3. 백업

- 출시 전 유료 플랜의 자동 백업과 PITR 제공 범위를 확인한다.
- 월 1회 복구 리허설을 수행한다.
- 결제, 포인트 원장, 신고 데이터는 일반 콘텐츠보다 오래 보존한다.

## 배포 전 부하 검증

운영 DB가 아닌 별도 staging 프로젝트에서 수행한다.

1. 동시 접속 20명, 각 사용자 1분당 10개 메시지로 10분 실행
2. 동시 접속 50명, 각 사용자 1분당 5개 메시지로 10분 실행
3. 한 방에 80명 접속 후 10명이 동시에 연속 메시지 전송
4. 사진 5장 전송 10회와 스토리 이미지 업로드 10회
5. Push outbox 1,000건을 만든 뒤 worker 처리 시간 측정

검증 중 `artifacts/production_capacity_diagnostic.sql`을 실행해 인덱스 사용, backlog, 테이블 크기, 장기 쿼리를 확인한다.

## 장애 대응 순서

### Realtime 지연 또는 연결 거부

1. Supabase Realtime 로그에서 `too_many_connections`, `too_many_joins`, `tenant_events` 확인
2. 앱 재배포보다 먼저 불필요한 채널과 반복 reconnect 여부 확인
3. 채팅 저장이 정상이라면 Realtime만 장애임을 공지하고 재조회 fallback 유지
4. 한도 80% 이상이면 즉시 상위 플랜 또는 한도 증설

### DB CPU 급등

1. 진단 SQL의 장기 실행 쿼리와 순차 스캔 확인
2. 공개 스토리, 검색, 랭킹 같은 읽기 기능을 우선 제한
3. 채팅 쓰기와 방 입장은 유지
4. 문제 쿼리를 중단하고 인덱스 또는 페이지 크기 수정

### Push 적체

1. `push_outbox`의 pending 수와 최고 대기 시간 확인
2. Edge Function 5xx, Expo Push 응답, 비활성 토큰 비율 확인
3. worker를 수동 1회 실행
4. 앱에서 무제한 재호출하지 않는다. Cron/worker만 확장한다.

### Storage 비용 급등

1. 업로드 평균 크기와 signed URL 호출량 확인
2. orphan 파일과 실패 업로드 정리
3. 원본 저장 여부와 이미지 리사이즈가 실제 적용되는지 점검
4. CDN egress가 병목이면 썸네일 전용 파일 도입

## 다음 확장 시점

- 방 하나의 초당 이벤트가 커지면 Postgres Changes 대신 private Broadcast 채널을 검토한다.
- Push backlog가 반복적으로 60초를 넘으면 Edge Function을 앱에서 호출하지 않고 전용 worker로 완전히 분리한다.
- 공개 스토리 조회량이 채팅보다 커지면 feed 전용 materialized view 또는 집계 테이블을 둔다.
- 메시지 테이블이 수천만 행에 접근하면 월 단위 파티셔닝과 오래된 메시지 보관 정책을 검토한다.

