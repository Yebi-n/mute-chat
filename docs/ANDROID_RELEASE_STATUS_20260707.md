# Android 출시 준비 현황

최종 업데이트: 2026-07-07

## 결론

Android 출시는 같은 저장소와 같은 `main` 브랜치에서 iOS와 병렬로 진행한다. 현재 앱 패키지명, EAS Android keystore, Android 빌드 스크립트는 준비되어 있다. 아직 남은 핵심 차단요소는 Google/Firebase/AdMob/Play Billing 쪽 콘솔 산출물이다.

iOS 설정은 건드리지 않는다.

## 현재 repo 확인 결과

작업 폴더:

```text
C:\Users\trudy\mute-chat
```

Android 앱 식별자:

```text
app.mute.chat
```

관련 설정 파일:

- `app.json`
- `eas.json`
- `package.json`
- `src/services/monetization.native.ts`
- `src/components/InlineBannerAd.native.tsx`
- `src/services/purchases.native.ts`
- `src/services/notifications.ts`

현재 `app.json` 기준:

- iOS Bundle ID: `app.mute.chat`
- Android package: `app.mute.chat`
- Android AdMob App ID: 테스트 ID
- iOS AdMob App ID: 실서비스 ID
- `google-services.json`: 아직 연결되지 않음
- `android.googleServicesFile`: 아직 없음

현재 `package.json` 기준 Android 명령어:

```powershell
npm.cmd run preview:android
npm.cmd run preview:android:apk
npm.cmd run build:android
npm.cmd run submit:android
```

현재 EAS Android keystore:

- Type: `JKS`
- Key Alias: `23cc65a234eeaad686fae977cc4ffe31`
- SHA1: `33:BE:F4:62:B2:A6:90:D4:5C:FD:F4:51:04:C1:15:9E:FF:E5:EB:E8`
- SHA256: `35:2C:50:E7:41:6E:8C:DC:FA:37:6F:9E:5B:0A:53:5B:33:32:09:E7:A2:A3:E0:6C:E2:C5:FB:60:5F:C0:B1:60`

이 keystore는 Play Console에 올라갈 앱 서명 흐름과 연결되므로 삭제하거나 재생성하지 않는다.

## 지금 완료된 것

- Google Play 개발자 계정 승인
- Play Console 앱 생성
- Android 패키지명 `app.mute.chat` 생성
- EAS Android keystore 생성
- Android 빌드 스크립트 존재 확인
- Android 출시 문서 작성
- iOS와 Android를 저장소 분리 없이 병렬 운영하는 기준 정리

## 아직 필요한 콘솔 산출물

### Firebase / FCM

필요:

- Firebase 프로젝트 또는 기존 프로젝트 선택
- Android 앱 `app.mute.chat` 등록
- `google-services.json` 다운로드
- FCM V1 서비스 계정 키 생성
- EAS Credentials에 FCM V1 키 연결

현재 상태:

- repo 안에 `google-services.json` 없음
- EAS FCM V1: 없음

### AdMob Android

필요:

- AdMob Android 앱 추가
- Android App ID 발급
- Android 보상형 광고 단위 ID
- Android 배너 광고 단위 ID

현재 상태:

- `app.json` Android App ID는 Google 테스트 ID
- 코드에는 Android 광고 단위 ID를 환경변수로 받을 수 있는 구조가 있음

필요 환경변수:

```text
EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID
EXPO_PUBLIC_ADMOB_BANNER_MAIN_ANDROID_ID
EXPO_PUBLIC_ADMOB_BANNER_CHAT_ANDROID_ID
EXPO_PUBLIC_ADMOB_BANNER_STORY_ANDROID_ID
```

### Google Play Billing

필요:

- Play Console 인앱 상품 생성
- Play Console 구독 상품 생성
- Google Play Developer API 활성화
- 서버 검증용 Google 서비스 계정 생성
- Supabase Edge Function에서 Android purchase token 검증 로직 연결

현재 상태:

- iOS StoreKit 검증은 붙어 있음
- Android Play Billing 검증은 별도 연결 필요

## Android 상품 ID 기준

iOS와 최대한 같은 상품 ID를 사용한다. 운영 비용과 코드 분기를 줄이기 위해서다.

포인트:

- `mute_points_5000`
- `mute_points_11000`
- `mute_points_28000`
- `mute_points_60000`
- `mute_points_200000`
- `mute_points_390000`

테마:

- `mute_theme_ocean`
- `mute_theme_lavender`
- `mute_theme_sunset`
- `mute_theme_mono`
- `mute_theme_white`
- `mute_theme_dark`

구독:

- `mute_ad_free_monthly`

채팅 꾸미기:

- `mute_bubble_color_01` ~ `mute_bubble_color_10`
- `mute_text_color_01` ~ `mute_text_color_09`
- `mute_custom_bubble_color`
- `mute_custom_text_color`
- `mute_custom_background`

## 다음 실행 순서

### 1. Play Console 내부 테스트 준비

1. Play Console 앱 콘텐츠 설문 작성
2. 데이터 보안 작성
3. 스토어 등록정보 작성
4. 내부 테스트 트랙 생성
5. AAB 업로드

초기에는 EAS submit 자동화보다 AAB 수동 업로드가 더 안전하다.

### 2. Firebase 연결

1. Firebase Android 앱 등록
2. `google-services.json` 다운로드
3. `app.json`에 `android.googleServicesFile` 추가
4. FCM V1 키를 EAS Credentials에 연결
5. Android 실기기 푸시 테스트

### 3. Android 광고 연결

1. Android AdMob 앱 ID 생성
2. Android 보상형/배너 광고 단위 생성
3. EAS 또는 빌드 환경변수에 광고 단위 ID 추가
4. 내부 테스트에서 테스트 광고 우선 확인

### 4. Android 결제 연결

1. Play Console 상품 생성
2. Google Play Developer API 서비스 계정 생성
3. Supabase Edge Function에 Android 검증 경로 추가
4. 테스트 구매 확인

## 빌드 명령어

APK 테스트:

```powershell
cd C:\Users\trudy\mute-chat
npm.cmd run preview:android:apk
```

Play Console용 AAB:

```powershell
cd C:\Users\trudy\mute-chat
npm.cmd run build:android
```

타입 검사:

```powershell
cd C:\Users\trudy\mute-chat
npm.cmd run typecheck
```

## 주의사항

- `EXPO_PUBLIC_SCREENSHOT_DEMO=1`이 켜진 빌드는 Play Console에 올리지 않는다.
- Android 설정 추가 중 iOS `bundleIdentifier`, Xcode Cloud, App Store Connect 설정을 바꾸지 않는다.
- service account JSON, keystore, p8, p12, Supabase service role key는 커밋하지 않는다.
- Android 성인 카테고리는 인증 전 노출하지 않는 원칙을 유지한다.
- 성인방은 프로모션/광고성 노출에서 제외한다.
