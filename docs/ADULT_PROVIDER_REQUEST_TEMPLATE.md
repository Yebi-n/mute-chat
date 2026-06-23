# Adult Verification Provider Request Template

Updated: 2026-06-19

## Recommended first target

- PortOne 본인인증

## What to ask for

Send a request that asks for:

1. test account / sandbox access
2. production onboarding requirements
3. browser-based mobile verification flow
4. callback URL registration method
5. callback payload schema
6. success/failure field names
7. adult/age verification result field names
8. CI availability
9. signature or callback verification method
10. fee structure for identity/adult verification

## Korean request draft

안녕하세요.

반익명 커뮤니티/채팅 서비스 앱을 준비 중이며, 웹 기반 성인 본인인증 연동을 검토하고 있습니다.

현재 필요한 사항은 아래와 같습니다.

1. 테스트 환경 연동 정보
2. 모바일 웹 기반 본인인증 시작 방식
3. 콜백 URL 등록 방식
4. 콜백 시 전달되는 파라미터 목록
5. 성인 여부/생년월일/내외국인 여부/CI 제공 가능 여부
6. 콜백 위변조 검증 방식
7. 운영 전환 절차
8. 건별 과금 구조 및 최소 비용 조건

저희 쪽 구현 구조는 아래와 같습니다.

- 앱에서는 웹 운영정책 페이지로 이동
- 웹에서 전화번호+비밀번호 로그인 후 본인인증 시작
- 인증 완료 후 서버 콜백 수신
- 서버에서 성인인증 완료 상태 저장 후 iOS 앱 접근 권한 활성화

가능하시다면 테스트 연동 문서와 샘플 콜백 예시도 함께 부탁드립니다.

감사합니다.

## What we will map after credentials arrive

Into `adult-verification-callback`:

- user identifier handoff
- verification success flag
- adult eligibility flag
- provider name
- CI hashing
- redirect back to the policy portal
