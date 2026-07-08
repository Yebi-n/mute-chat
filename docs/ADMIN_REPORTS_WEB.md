# 운영자 신고 확인 페이지

최종 업데이트: 2026-07-07

## 목적

앱에서 접수된 신고를 운영자가 모바일 브라우저에서 확인하고 처리 상태를 바꾸는 내부 운영 페이지다.

## URL

```text
https://oxanqrmkvyniocxwreia.supabase.co/functions/v1/admin-reports
```

## 현재 상태

- Supabase Edge Function `admin-reports`로 배포한다.
- HTML이 소스 코드 그대로 보이면 응답 헤더를 `Content-Type: text/html; charset=utf-8`로 수정해야 한다.
- 운영자 계정으로 로그인한 뒤 신고 목록을 본다.
- 일반 사용자에게 공유하지 않는 내부 URL이다.

## 배포

```powershell
cd C:\Users\trudy\mute-chat
npx.cmd supabase functions deploy admin-reports --no-verify-jwt
```

## 표시해야 할 정보

- 신고 ID
- 신고 상태: 접수, 검토 중, 조치 완료, 기각
- 신고 시각
- 신고자 user id
- 신고 대상 유형: 방, 사용자, 메시지, 스토리, 댓글
- 신고 대상 id
- 관련 방 id와 방 이름
- 신고 사유와 상세 내용
- 증빙 JSON 또는 클라이언트 컨텍스트
- 처리 메모

## 처리 액션

- `received`: 접수
- `triaged`: 검토 중
- `actioned`: 조치 완료
- `dismissed`: 기각

상태 변경은 Edge Function에서 Supabase 권한으로 처리한다. 클라이언트에 service role key를 노출하지 않는다.

## 운영 원칙

- 신고는 24시간 이내 확인하는 기준으로 운영한다.
- 명백한 불법 촬영물, 아동·청소년 성착취물, 개인정보 노출, 위협성 콘텐츠는 즉시 제한한다.
- 허위 신고가 반복되는 계정은 운영 정책에 따라 제한할 수 있다.
- 사용자가 이미 참여 중인 방은 신고하지 못하게 앱에서 막는다. 과거 잘못 접수된 신고는 운영자가 삭제 또는 기각한다.

