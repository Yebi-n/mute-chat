# 친구 Mac/Xcode 최초 연결 가이드

Updated: 2026-07-07

## 현재 기준

이 문서는 친구 Mac에서 Xcode Cloud 최초 연결을 도움받기 위해 만든 기록이다.

현재 실제 배포 기준 문서는 `XCODE_CLOUD_SETUP.md`다. 충돌이 있으면 이 문서보다 `XCODE_CLOUD_SETUP.md`, `HANDOFF_CODEX.md`, `DOCS_INDEX.md`를 우선한다.

## 친구에게 맡기는 범위

최초 1회 연결만 요청한다.

- GitHub 저장소 clone
- Xcode에서 iOS 프로젝트 열기
- Apple Developer 계정 로그인
- Xcode Cloud workflow 생성 또는 연결 확인
- 첫 빌드가 시작되는지 확인

친구에게 맡기지 않는 것:

- 코드 수정
- 앱 기능 테스트
- 결제 상품 수정
- App Store Connect 메타데이터 작성
- 사업자 계약/서류 정보 입력
- 비밀번호, 인증키, API secret 저장

## 공유 가능한 정보

- GitHub 저장소 URL
- 저장소 접근 권한
- Apple Developer 계정 로그인에 필요한 일회성 인증 지원
- Xcode Cloud workflow 목적: `main` 브랜치 push 후 iOS TestFlight 빌드

## 공유하지 않는 정보

- Supabase service role key
- App Store Connect API key 원문
- Apple 개인키 `.p8`
- 사업자등록증, 인감증명서, 통장 사본
- 결제/성인인증 계약 관련 상세 자료

## 친구 Mac에서 할 작업

```bash
git clone <REPOSITORY_URL>
cd mute-chat
npm ci
open ios/app.xcodeproj
```

Xcode에서:

1. Xcode > Settings > Accounts
2. Apple Developer 계정 추가
3. 프로젝트 target의 Signing & Capabilities 확인
4. Bundle Identifier가 `app.mute.chat`인지 확인
5. Team은 사용자 Apple Developer Team 선택
6. Xcode Cloud workflow 생성
7. Repository: GitHub `main`
8. Action: Archive
9. Distribution: TestFlight

## 작업 후 정리

친구 Mac에서 작업이 끝나면 아래를 정리한다.

1. Xcode > Settings > Accounts에서 Apple 계정 제거
2. 브라우저 Apple/GitHub 세션 로그아웃
3. clone한 저장소 삭제
4. 로컬에 남은 인증서나 계정 정보가 있으면 제거

## 실패 시 확인

- Team이 보이지 않으면 App Store Connect/Developer 권한 문제
- signing certificate 오류는 Apple 계정/팀/프로비저닝 문제
- `ci_post_clone.sh` 오류는 Node 설치 또는 Xcode Cloud 스크립트 문제
- build number 오류는 이전 업로드보다 높은 build number 필요
