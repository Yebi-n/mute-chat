# Android / iOS 병렬 출시 구조

최종 업데이트: 2026-07-07

## 원칙

Android 출시는 기존 iOS 출시 흐름을 건드리지 않고 병렬로 붙인다.

- iOS: 기존 Xcode Cloud, App Store Connect, TestFlight 흐름 유지
- Android: 같은 React Native/Expo 코드베이스에서 Android 설정만 추가
- 공통 기능은 하나의 코드로 유지
- 플랫폼 차이가 필요한 기능만 `Platform.OS` 또는 환경변수로 분기
- 비용과 운영 부담을 줄이기 위해 저장소를 분리하지 않는다.

## 저장소 전략

현재 저장소:

```text
C:\Users\trudy\mute-chat
```

권장 브랜치:

- `main`: iOS/Android 공통 기준 브랜치
- 별도 Android 브랜치는 긴급 실험이 필요할 때만 사용
- 심사용/캡처용 데모 모드는 환경변수로만 제어하고 코드 브랜치를 분리하지 않는다.

커밋 전 기본 순서:

```powershell
cd C:\Users\trudy\mute-chat
git status --short
npm.cmd run typecheck
git add <필요한 파일만>
git commit -m "<작업 요약>"
git pull --rebase origin main
git push origin main
```

커밋하지 말아야 할 것:

- `supabase/.temp/*`
- 로컬 로그
- `.apk`
- `.aab`
- keystore 파일
- Google service account JSON
- App Store / Play Console 비밀키
- 임시 캡처 파일

## 플랫폼별 설정 위치

### Expo / 앱 설정

- `app.json`
- `eas.json`
- `package.json`

Android 관련 주요 필드:

- `android.package`: `app.mute.chat`
- `android.adaptiveIcon`
- `android.googleServicesFile`가 필요해질 수 있음
- Google Mobile Ads Android App ID

iOS 관련 주요 필드:

- `ios.bundleIdentifier`: `app.mute.chat`
- `ios.supportsTablet`: 현재 iPhone 중심 설정
- iOS AdMob App ID
- ATT 문구

주의:

- Android 설정을 추가할 때 iOS bundle id, build number, Xcode Cloud 설정을 임의로 바꾸지 않는다.

### 환경변수

캡처용 데모 모드:

```text
EXPO_PUBLIC_SCREENSHOT_DEMO=1
```

실사용/심사용 빌드:

```text
EXPO_PUBLIC_SCREENSHOT_DEMO=0
```

또는 환경변수 제거.

주의:

- 데모 모드가 켜진 빌드는 심사용/실사용에 올리지 않는다.

## Android 빌드 흐름

### 1. 로컬 타입 검사

```powershell
npm.cmd run typecheck
```

### 2. Android APK 프리뷰

```powershell
npm.cmd run preview:android:apk
```

용도:

- 개발자/테스터 직접 설치
- Play Console 없이 빠른 기능 확인

### 3. Android AAB 프로덕션 빌드

```powershell
npm.cmd run build:android
```

용도:

- Play Console 업로드
- 내부 테스트/비공개 테스트/프로덕션 출시

### 4. Play Console 제출

```powershell
npm.cmd run submit:android
```

단, Google Play service account key가 EAS에 연결된 뒤 사용하는 것이 안정적이다.

초기에는 AAB를 수동 업로드해도 된다.

## iOS 빌드 흐름

iOS는 기존대로 유지한다.

- Xcode Cloud에서 `main` push 기반 빌드
- App Store Connect에서 TestFlight 및 심사 제출
- iOS 심사용 설정은 Android 작업 중 임의 변경하지 않는다.

## Android 전용으로 분리해야 할 기능

### 성인 카테고리

정책 원칙:

- iOS: 성인 탭/성인 인증 유도 UI 노출 금지
- Android: 성인 인증 전에는 성인 탭 자체를 노출하지 않는 방향
- 인증 완료 계정만 성인 카테고리 접근 가능
- 프로모션에는 성인방 노출 금지

구현 원칙:

```ts
if (Platform.OS === 'android') {
  // Android 성인 카테고리 정책
}
```

iOS 조건을 약화시키는 방식으로 구현하지 않는다.

### 광고

Android에는 별도 AdMob 앱 ID와 광고 단위 ID가 필요하다.

권장 구조:

- iOS 광고 ID와 Android 광고 ID를 분리
- 개발/테스트에서는 테스트 ID 사용
- 실서비스 빌드는 실제 ID 사용

### 결제

iOS:

- StoreKit
- App Store Server API 또는 App Store 검증

Android:

- Google Play Billing
- Google Play Developer API 검증

서버에서는 플랫폼별 검증 경로를 분리해야 한다.

```text
purchase.platform = ios | android
```

검증 후 공통 테이블에 entitlement/point 지급을 기록하는 구조가 가장 안전하다.

### 푸시 알림

iOS:

- APNs / Expo push

Android:

- FCM V1
- Firebase `google-services.json`
- EAS Credentials에 FCM V1 key 연결

## Play Console 출시 단계

1. 앱 생성
2. 패키지명 `app.mute.chat` 확인
3. AAB 업로드
4. 앱 콘텐츠 설문 작성
5. 데이터 보안 작성
6. 스토어 등록정보 작성
7. 내부 테스트 트랙 생성
8. 비공개 테스트 트랙 생성
9. 테스터 12명 이상 확보
10. 14일 테스트 기간 충족
11. 프로덕션 신청

## 운영 체크리스트

Android와 iOS를 동시에 운영할 때 확인할 것:

- 같은 Supabase 프로젝트를 사용한다.
- 플랫폼별 결제 검증만 다르고 지급 결과는 같은 테이블에 기록한다.
- 신고/차단/강퇴/운영자 검토 로직은 공통으로 유지한다.
- 광고 제거 구독은 iOS/Android 각각 구매 가능하지만 앱 내 상태는 계정 기준으로 통합 처리한다.
- 테마/색연필/말풍선 등 아이템 소유권은 계정 기준으로 통합 처리한다.
- 앱 버전별 마이그레이션이 충돌하지 않도록 DB migration은 항상 `supabase db push` 상태를 확인한다.

## 수동으로 해야 하는 일

사용자가 직접 처리해야 하는 항목:

- Google Play Console 앱 콘텐츠 설문
- 스토어 등록정보 문구/이미지 최종 확인
- 비공개 테스트 테스터 초대
- Android 개발자 계정 본인/기기 인증
- Firebase 프로젝트 생성 또는 연결
- Google Play 결제 상품 생성
- AdMob Android 앱/광고 단위 생성
- Google Play service account key 발급

Codex가 처리할 수 있는 항목:

- Android 문서 정리
- Android용 설정 파일 추가
- Android 분기 코드 작성
- Android 결제 검증 Edge Function 작성
- Android 광고 ID 반영
- FCM 연결 코드 점검
- 타입 검사
- 커밋 준비
- 빌드 명령어 정리

## 위험 요소

- iOS 심사용 데모/정책 우회 코드가 Android 작업 중 다시 켜지는 경우
- Android 실제 AdMob ID가 아닌 테스트 ID로 출시되는 경우
- Google Play Billing 상품 ID와 앱 코드가 불일치하는 경우
- FCM V1 key 누락으로 Android 푸시가 오지 않는 경우
- Play Console 비공개 테스트 14일 조건을 놓치는 경우
- service account JSON 또는 keystore를 git에 커밋하는 경우

## 다음 액션

1. Play Console 앱 설정 남은 항목 확인
2. Android AdMob 앱/광고 단위 생성
3. Firebase Android 앱 등록 및 `google-services.json` 확보
4. Google Play 인앱 상품 생성
5. Android APK 프리뷰 빌드
6. Android 실기기에서 로그인/채팅/이미지/푸시/광고/구매 스모크 테스트
7. Android AAB 빌드
8. Play Console 내부 테스트 업로드

