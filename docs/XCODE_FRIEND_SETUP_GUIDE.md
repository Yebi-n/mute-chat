# Xcode Cloud 최초 연결 요청 가이드

목표는 친구 Mac에서 이 저장소를 Xcode로 열고, 내 Apple Developer 계정으로 로그인한 뒤 Xcode Cloud workflow를 최초 1회 생성하는 것입니다.

앱 기능 확인, 테스트, 코드 수정, 환경변수 변경은 필요하지 않습니다.

## 작업 범위

친구가 해주면 되는 작업은 아래 5가지입니다.

1. 전달받은 GitHub 저장소를 Mac에서 clone
2. Xcode에서 iOS 프로젝트 열기
3. Xcode에 내 Apple Developer 계정으로 로그인
4. Xcode Cloud workflow 최초 1개 생성
5. 첫 빌드가 시작되는지만 확인

아래 작업은 하지 않아도 됩니다.

- 앱 실행 및 기능 확인
- 코드 수정
- 환경변수 확인 또는 변경
- 비밀번호 확인 또는 저장
- App Store 입력 정보 작성
- 오류 장시간 디버깅

## 준비할 것

내가 친구에게 전달할 것:

- GitHub 저장소 주소
- GitHub 저장소 접근 권한
- Apple Developer 계정 로그인 정보
- 2단계 인증 코드가 필요할 경우 실시간으로 전달

친구가 따로 준비하지 않아도 되는 것:

- 본인 Apple Developer 계정
- 본인 App Store Connect 권한
- 앱 심사 정보
- 배포용 인증서 수동 생성

## 보안 주의사항

친구 Mac에 내 Apple 계정으로 로그인해도 됩니다. 다만 작업이 끝나면 아래 항목은 반드시 정리해야 합니다.

1. Xcode > Settings > Accounts에서 내 Apple 계정 제거
2. macOS 시스템 설정에 내 Apple ID가 로그인되어 있다면 로그아웃
3. 브라우저에서 GitHub 또는 Apple Developer에 로그인했다면 로그아웃
4. 저장된 비밀번호, 키체인 저장 요청이 나오면 저장하지 않기
5. 작업 폴더가 더 필요 없으면 clone한 저장소 폴더 삭제

가능하면 Apple 계정 로그인은 macOS 전체 Apple ID 로그인이 아니라 Xcode의 Accounts에만 추가하는 방식으로 진행합니다.

## Mac에서 저장소 열기

GitHub 웹사이트에서 Code > Download ZIP으로 받은 파일은 사용하지 않습니다.

Xcode Cloud workflow를 만들려면 Xcode가 이 프로젝트가 어떤 GitHub 저장소와 branch에 연결되어 있는지 알아야 합니다. ZIP으로 받은 폴더에는 `.git` 정보가 없어서 Repository 또는 Branch 선택 단계에서 문제가 날 수 있습니다.

터미널 사용이 부담되면 GitHub Desktop으로 저장소를 clone해도 됩니다. 중요한 것은 “파일 다운로드”가 아니라 “Git 저장소로 clone”하는 것입니다.

아래 명령어에서 `<REPOSITORY_URL>`만 전달받은 GitHub 저장소 주소로 바꿔 실행합니다.

```bash
git clone <REPOSITORY_URL>
cd <CLONED_FOLDER>
npm ci
open ios/app.xcodeproj
```

만약 Xcode 또는 터미널에서 workspace를 열라는 안내가 나오면 아래처럼 엽니다.

```bash
open ios/app.xcworkspace
```

## Xcode에서 계정 및 서명 확인

1. Xcode > Settings > Accounts 열기
2. 내 Apple Developer 계정으로 로그인
3. 왼쪽 Project navigator에서 프로젝트 선택
4. Target 선택
5. Signing & Capabilities에서 Team이 내 Apple Developer Team으로 선택되어 있는지 확인
6. Bundle Identifier는 기존 값 그대로 유지
7. Scheme은 Xcode에 표시되는 기본 scheme 사용

임의로 Bundle Identifier, Team ID, Scheme, 배포 설정을 바꾸지 않습니다. Team 선택이 비어 있거나 다른 팀으로 되어 있을 때만 내 Apple Developer Team으로 선택합니다.

## Xcode Cloud Workflow 생성

1. Xcode 상단 메뉴에서 Product > Xcode Cloud > Create Workflow 선택
2. Repository는 현재 clone한 GitHub 저장소 선택
3. Branch는 `main` 선택
4. Scheme은 Xcode에 표시되는 기본 scheme 선택
5. Action은 Archive 선택
6. Signing은 Apple managed signing 사용
7. Distribution은 TestFlight 선택
8. Save 또는 Start Build 선택

첫 빌드가 Xcode Cloud에 등록되고 시작되면 완료입니다.

## 완료 후 알려줄 것

아래 형식으로만 알려주면 됩니다.

```text
1. Xcode Cloud workflow 생성 여부:
2. 첫 빌드 시작 여부:
3. 오류가 있으면 오류 문구:
```

## 오류가 나면

아래 오류가 뜨면 화면 캡처와 오류 문구만 전달해 주세요. 장시간 디버깅하지 않아도 됩니다.

- Apple Developer Team 선택 오류
- Bundle Identifier 소유권 오류
- GitHub repository 접근 권한 오류
- Signing 오류
- Scheme 없음
- Xcode Cloud 권한 오류
- Build script 실패

## 작업 종료 체크리스트

작업이 끝나면 다음을 확인합니다.

```text
1. Xcode Accounts에서 Apple 계정 제거:
2. 브라우저 로그인 세션 로그아웃:
3. 저장된 비밀번호 없음:
4. 필요 시 clone한 저장소 폴더 삭제:
```
