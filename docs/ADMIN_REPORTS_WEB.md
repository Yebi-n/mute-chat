# 운영자 신고 확인 페이지

## 목적

앱 안에서 들어온 신고를 운영자가 모바일 브라우저로 빠르게 확인하고 처리 상태를 바꿀 수 있는 내부용 페이지입니다.

## 배포 URL

Supabase Edge Function으로 배포합니다.

```text
https://oxanqrmkvyniocxwreia.supabase.co/functions/v1/admin-reports
```

## 배포 명령

```powershell
cd C:\Users\trudy\mute-chat
npx.cmd supabase functions deploy admin-reports --no-verify-jwt
```

## 접근 권한

로그인한 계정이 `auth.users.is_super_admin = true`인 경우에만 신고 목록을 볼 수 있습니다.

관리자 문자열 계정은 이메일 칸에 관리자 ID만 입력해도 페이지 내부에서 `@admin.mute.local`을 붙여 로그인합니다.

## 표시 정보

각 신고 카드에는 다음 정보를 표시합니다.

- 신고 ID
- 신고 상태: 접수, 검토 중, 조치 완료, 기각
- 우선순위
- 신고 일시
- 신고자 ID, 이메일, 전화번호
- 대상 유형: 방, 유저, 메시지, 스토리, 댓글
- 대상 ID
- 대상 요약 정보: 방 이름, 메시지 본문, 스토리 제목, 댓글 본문 등 조회 가능한 범위
- 신고 사유
- 상세 내용
- 증빙 JSON
- 신고 메일 발송 상태

## 처리 기능

운영자는 신고별로 다음 상태를 지정할 수 있습니다.

- `triaged`: 검토 중
- `actioned`: 조치 완료
- `dismissed`: 기각

상태 변경은 서버 함수가 서비스 롤 권한으로 수행하며, 브라우저에는 서비스 키를 노출하지 않습니다.

## 보안 메모

- 이 URL은 내부 운영용입니다. 외부에 공개하지 않습니다.
- 서비스 롤 키는 Edge Function 내부에서만 사용합니다.
- 운영자 계정 권한은 Supabase `auth.users.is_super_admin`으로만 판단합니다.
- 신고 대상 콘텐츠는 개인정보나 민감정보를 포함할 수 있으므로 운영 목적으로만 열람합니다.
