# 빌드 및 배포 비용 전략

최종 업데이트: 2026-07-07

## 결론

- iOS 기본 빌드는 Xcode Cloud를 사용한다.
- EAS iOS Build는 무료 한도 소진 이슈가 있어 백업 경로로만 둔다.
- Android는 GitHub Actions 또는 로컬 Gradle/Android Studio 기반으로 준비한다.
- JavaScript/UI만 바뀌는 변경은 향후 OTA 업데이트 도입 후 네이티브 빌드 없이 처리한다.

## iOS

현재 기준:

- App Store Connect 앱 ID: `6781187934`
- Bundle ID: `app.mute.chat`
- 저장소: `https://github.com/Yebi-n/mute-chat`
- Xcode Cloud가 주 빌드 경로
- `ios/.xcode.env`의 `EXPO_PUBLIC_SCREENSHOT_DEMO`는 심사용/실사용 빌드에서 `0` 또는 제거

주의:

- 빌드 번호는 이전 업로드보다 커야 한다.
- iPad 지원을 제거하려면 Expo/iOS 설정에서 iPhone 전용으로 맞추고 새 빌드가 필요하다.
- 앱 아이콘, 권한, 광고 SDK, 결제 SDK, 네이티브 의존성 변경은 새 바이너리가 필요하다.

## Android

Android는 iOS와 병렬로 준비하되 기존 iOS 플로우를 깨지 않는 것이 원칙이다.

필요한 수동 작업:

- Google Play 개발자 계정 준비
- 앱 생성
- 앱 서명 키/업로드 키 정책 결정
- 내부 테스트 트랙 생성
- 개인정보처리방침 URL 등록
- 데이터 보안, 콘텐츠 등급, 광고 포함 여부, 앱 접근 권한 설문 작성

권장 자동화:

- GitHub Actions Ubuntu runner로 AAB 생성
- keystore와 서비스 계정 JSON은 GitHub Secrets에 저장
- 릴리스 빌드는 수동 dispatch 또는 태그 기반으로만 실행

## 비용 최소화 기준

- iOS: Xcode Cloud 포함 시간 우선 사용
- Android: Linux runner 사용, macOS runner 사용 금지
- 빌드 전 로컬 `npm.cmd run typecheck`로 실패 가능성 제거
- 스크린샷 데모 빌드와 심사용 빌드 환경변수 분리
- 네이티브 변경을 묶어서 빌드 횟수 최소화

## EAS Build 사용 조건

EAS Build는 다음 경우에만 사용한다.

- Xcode Cloud 장애
- 긴급 검증
- 친구/외부 Mac 접근이 어려운 상황

EAS 무료 한도는 쉽게 소진되므로 기본 배포 경로로 사용하지 않는다.
