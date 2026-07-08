# 성인인증 계약 진행 런북

업데이트: 2026-07-07

> 최신 메일 원문 판독 결과는 `ADULT_VERIFICATION_CONTRACT_STATUS_20260707.md`를 우선 기준으로 본다.
> 이 문서는 계약 진행 런북이며, 비용/서류/메일별 확정 내용은 위 상태 문서에 고정한다.

## 목적

뮤트의 성인 카테고리 접근을 앱 외부 웹에서 본인확인/성인인증 후 허용하기 위한 계약, 서류, 서버 연동 절차를 정리한다.

iOS 심사 대응 원칙은 유지한다.

- iOS 앱 안에는 성인 탭, 성인인증 안내, 외부 우회 안내를 노출하지 않는다.
- 성인 접근 허용은 외부 웹에서만 처리한다.
- Android는 추후 별도 빌드에서 성인인증 완료 계정에만 성인 탭을 노출한다.
- 결제 PG 계약과 성인/본인확인 계약은 목적이 다르므로 혼동하지 않는다.

## 현재 확인된 상황

- 사업자 상호명: 뮤트
- 통신판매업 신고번호: 2026-인천남동구-0159호
- 앱 번들 ID: app.mute.chat
- Supabase 프로젝트: oxanqrmkvyniocxwreia
- 기존 검토 대상:
  - PortOne
  - KG이니시스/KGO 통합인증서비스
  - 과거 Cafe24/NICE 본인확인 흔적
- 비용 최적화 우선순위:
  - 이미 신청이 진행된 PortOne/KG이니시스 경로를 우선 확인한다.
  - 만료된 Cafe24/NICE 계약을 재사용하려면 재개 비용과 신규 계약 비용을 비교한 뒤 진행한다.
  - 동일 목적의 본인확인 제공사를 중복 계약하지 않는다.

## 우선 결론

1. 현재는 PortOne + KG이니시스/KGO 통합인증서비스 경로를 우선 진행한다.
2. PG/전자결제 계약은 포인트 충전 등 웹 결제에 필요할 수 있지만, iOS 인앱결제와 성인인증 자체에는 직접 필수는 아니다.
3. 성인인증에 필요한 것은 “본인확인/통합인증 서비스” 계약과 API 연동 정보다.
4. 보증보험은 PG 계약에서 요구될 가능성이 높고, 본인확인 계약에도 요구되는지는 메일 원문 또는 담당자 회신으로 확정해야 한다.

## 메일/포털에서 확인해야 할 체크리스트

메일 또는 PortOne/KG이니시스 화면에서 아래 항목을 확인한다.

- 메일 제목:
  - `[PortOne] 포트원 V2 결제 연동 안내`
  - `[KGO이니시스] 통합인증서비스 가입신청서 접수 완료`
  - `[KGO이니시스] 통합인증서비스 계약/심사 안내`
- 신청 서비스명이 `통합인증서비스`, `본인확인`, `PASS 인증`, `성인인증` 계열인지 확인한다.
- 단순 PG 결제 계약 안내인지, 본인확인 계약 안내인지 구분한다.
- 현재 상태:
  - 접수 완료
  - 서류 요청
  - 심사 중
  - 계약 완료
  - 서비스 오픈
- 제출 방식:
  - 포털 업로드
  - 이메일 제출
  - 원본 우편 제출
- 계약 담당자 이메일과 전화번호
- 발급 예정 또는 이미 발급된 값:
  - 상점/고객사 ID
  - 서비스 ID
  - 채널 키
  - API Secret
  - 웹훅 Secret
  - 테스트/운영 구분

## 예상 제출 서류

메일 원문 기준으로 최종 확인해야 하지만, 일반적으로 아래가 필요하다.

- 사업자등록증 또는 사업자등록증명원
- 통신판매업 신고증
- 대표자 신분/인감 관련 서류
  - 개인 인감증명서 원본 또는 본인서명사실확인서
  - 발급 3개월 이내 요구 가능
- 통장 사본
- 이용계약서 원본 2부
  - 인감 날인 필요 가능
- 서비스 소개 자료
  - 서비스명: 뮤트
  - 서비스 형태: 커뮤니티/채팅 앱
  - 성인 카테고리 접근은 인증 완료 계정에 한정
- 개인정보처리방침 URL
- 운영정책 URL
- 서비스 URL
  - 현재 앱 출시 전이면 임시 웹 소개 페이지 또는 운영정책 페이지 사용 가능
- 보증보험 증권
  - PG 계약에서 요구될 수 있음
  - 기존 칠바이브 보증보험을 승계/변경할 수 있는지는 보증보험사와 KG이니시스 양쪽 확인 필요

## 수동 승인/제출이 필요한 작업

아래는 사용자 또는 사업자 명의자가 직접 해야 한다.

- 계약서 확인 및 서명/날인
- 인감증명서 또는 본인서명사실확인서 발급
- 보증보험 가입, 변경, 해지 환급 확인
- PortOne/KG이니시스 관리자 콘솔 권한 승인
- API 키 발급 화면에서 키 생성
- 사업자 정보, 정산 계좌, 세금 정보 제출
- 담당자 전화/메일 확인 응답

## Codex가 처리할 수 있는 작업

사용자가 계약 메일 원문, 콘솔 화면, 발급 키를 제공하면 아래를 진행한다.

- 계약 메일 내용 요약 및 누락 서류 체크
- 담당자에게 보낼 문의문 작성
- Supabase Secret 등록 명령어 작성
- Edge Function 연동 코드 수정
- 외부 성인인증 웹 페이지 UI/문구 수정
- 인증 시작/콜백/상태 조회 플로우 테스트
- iOS/Android 분기 정책 문서 업데이트
- 운영정책/개인정보처리방침 링크 정리

## 서버 연동 설계

현재 DB 필드는 다음 구조를 기준으로 유지한다.

- `users.identity_verified_at`
- `users.adult_verified_at`
- `users.identity_provider`
- `users.ci_hash`
- `users.adult_content_web_opt_in_at`
- `users.ios_adult_content_enabled`
- `users.age_confirmed_at`

권장 플로우:

1. 외부 웹에서 앱 계정 전화번호/비밀번호로 로그인
2. 로그인 성공 후 성인인증 상태 조회
3. 미인증 계정이면 `start-adult-verification` 호출
4. PortOne/KG이니시스 본인확인 페이지로 이동
5. 인증 완료 후 `adult-verification-callback` 또는 `complete-adult-verification` 호출
6. 서버에서 CI/생년월일/성인 여부 검증
7. 성인 인증 성공 시:
   - `identity_verified_at` 저장
   - `adult_verified_at` 저장
   - `identity_provider` 저장
   - `ci_hash` 저장
8. iOS 접근 허용 토글은 외부 웹에서만 관리
9. 앱은 상태 조회만 수행

## 필요한 Supabase Secrets

실제 키를 받은 뒤 아래 이름으로 통일한다.

```powershell
npx.cmd supabase secrets set PORTONE_STORE_ID="..."
npx.cmd supabase secrets set PORTONE_IDENTITY_CHANNEL_KEY="..."
npx.cmd supabase secrets set PORTONE_API_SECRET="..."
npx.cmd supabase secrets set ADULT_VERIFY_PROVIDER="portone_kg_inicis"
```

공급사가 PortOne 경유가 아닌 직접 KG이니시스 연동을 요구하면 별도 이름을 쓴다.

```powershell
npx.cmd supabase secrets set KG_INICIS_SITE_CODE="..."
npx.cmd supabase secrets set KG_INICIS_API_KEY="..."
npx.cmd supabase secrets set KG_INICIS_API_SECRET="..."
```

## 배포 명령

키 등록 후 관련 함수 배포:

```powershell
cd C:\Users\trudy\mute-chat
npx.cmd supabase functions deploy start-adult-verification
npx.cmd supabase functions deploy adult-verification-callback --no-verify-jwt
npx.cmd supabase functions deploy complete-adult-verification
npx.cmd supabase functions deploy operations-policy --no-verify-jwt
```

DB 변경이 있을 때만:

```powershell
cd C:\Users\trudy\mute-chat
npx.cmd supabase db push
```

## 테스트 매트릭스

- 미로그인 상태:
  - 성인 카테고리 섹션이 보이지 않아야 함
  - 로그인 입력만 보여야 함
- 로그인 성공:
  - 인증 상태 카드 표시
  - 미인증 계정은 `성인인증 필요`
  - 인증 완료 계정은 `성인인증 됨`
- 인증 성공:
  - DB `adult_verified_at` 저장
  - 앱 재실행 후 상태 반영
- 인증 실패:
  - 실패 사유 표시
  - DB 상태 변경 없음
- 동일 CI 재인증:
  - 같은 계정이면 허용
  - 다른 계정이면 정책 결정 필요
- iOS 앱:
  - 성인 탭 미노출
  - 외부 성인인증 안내 미노출
- Android 앱:
  - 미인증 계정 성인 탭 미노출
  - 인증 계정 성인 탭 노출

## 담당자 문의문

```text
안녕하세요. 뮤트 서비스 담당자입니다.

PortOne을 통해 KG이니시스/KGO 통합인증서비스 가입 신청을 진행했습니다.
현재 서비스는 iOS/Android 커뮤니티 앱이며, 성인 카테고리 접근 전 본인확인 및 성인 여부 확인 용도로 사용하려고 합니다.

확인 부탁드릴 사항은 아래와 같습니다.

1. 현재 신청 건이 본인확인/성인인증 용도로 정상 접수되어 있는지
2. PG 결제 계약과 별도로 통합인증서비스만 먼저 오픈 가능한지
3. 보증보험이 통합인증서비스에도 필수인지, PG 계약에만 필요한지
4. 제출해야 할 서류 목록과 원본 우편 제출 필요 여부
5. 운영 환경 연동에 필요한 상점/서비스 ID, 채널 키, API Secret 발급 위치
6. 테스트 환경 제공 여부

서비스명: 뮤트
사업자 상호명: 뮤트
통신판매업 신고번호: 2026-인천남동구-0159호

확인 후 필요한 서류와 다음 절차 안내 부탁드립니다.
감사합니다.
```

## 보류 조건

아래 중 하나라도 확인되지 않으면 코드 연동을 운영 환경으로 확정하지 않는다.

- 계약 서비스가 본인확인/성인인증이 아니라 단순 PG 결제임
- API 키가 테스트용인지 운영용인지 불명확함
- 콜백 URL 등록 방식이 불명확함
- CI 또는 생년월일 제공 여부가 불명확함
- 보증보험/서류 제출 상태가 미완료임

## 다음 액션

1. Chrome 또는 메일에서 KG/PortOne 메일 원문을 확인한다.
2. 위 체크리스트에 맞춰 계약 상태를 분류한다.
3. 부족한 서류만 사용자에게 요청한다.
4. 키가 발급되면 Supabase Secrets에 등록한다.
5. Edge Function을 실제 공급사 응답 포맷에 맞춘다.
6. 외부 성인인증 페이지에서 실인증 테스트를 한다.
7. iOS 앱에는 성인 관련 UI가 노출되지 않는지 재확인한다.
