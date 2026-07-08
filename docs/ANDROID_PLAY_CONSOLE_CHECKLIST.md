# Android Play Console 출시 체크리스트

최종 업데이트: 2026-07-07

## 현재 상태

- Google Play Console 개발자 계정: 승인 완료
- 앱 패키지명: `app.mute.chat`
- Play Console 앱: 생성됨
- EAS Android keystore: 생성됨. 재생성/삭제 금지
- Android 빌드 산출물: 아직 Play Console에 업로드 전 기준
- iOS 출시/심사 플로우: 기존 Xcode Cloud/App Store Connect 흐름 유지
- Android는 iOS와 병렬로 준비하되, 기존 iOS 설정은 수정하지 않는 것을 원칙으로 한다.

## EAS Android 인증 정보

현재 EAS에 등록된 Android keystore:

- Application Identifier: `app.mute.chat`
- Keystore type: `JKS`
- Key Alias: `23cc65a234eeaad686fae977cc4ffe31`
- SHA1: `33:BE:F4:62:B2:A6:90:D4:5C:FD:F4:51:04:C1:15:9E:FF:E5:EB:E8`
- SHA256: `35:2C:50:E7:41:6E:8C:DC:FA:37:6F:9E:5B:0A:53:5B:33:32:09:E7:A2:A3:E0:6C:E2:C5:FB:60:5F:C0:B1:60`

주의:

- 이 keystore가 바뀌면 기존 Play Console 앱과 서명 체인이 꼬일 수 있다.
- `Download existing keystore`는 백업 목적일 때만 사용한다.
- `Set up a new keystore`, `Delete your keystore`는 명확한 이유 없이는 선택하지 않는다.

## Play Console에서 수동 처리할 항목

### 1. 앱 설정

- 앱 이름: `뮤트`
- 기본 언어: 한국어
- 앱/게임: 앱
- 무료/유료: 무료
- 카테고리: 소셜 또는 커뮤니케이션 계열로 검토
- 연락처 이메일: 운영 메일
- 개인정보처리방침 URL: 현재 앱 심사용으로 사용하는 개인정보처리방침 링크 사용

### 2. 스토어 등록정보

필수 항목:

- 짧은 설명
- 자세한 설명
- 앱 아이콘
- 휴대전화 스크린샷
- 7인치/10인치 태블릿 스크린샷 요구 여부 확인
- 기능 그래픽
- 앱 카테고리 및 태그

주의:

- iOS 심사용과 동일하게 성인 탭이 노출되지 않는 화면을 우선 사용한다.
- 만남/성인/선정적 표현으로 오해될 수 있는 문구는 피한다.
- 스크린샷에는 신고/차단/운영 정책 접근 가능성이 드러나는 화면이 있으면 심사 대응에 유리하다.

### 3. 앱 콘텐츠

Play Console에서 확인해야 할 항목:

- 개인정보 및 데이터 보안
- 광고 포함 여부
- 앱 액세스 권한
- 콘텐츠 등급
- 타겟층 및 콘텐츠
- 뉴스 앱 여부
- 금융 기능 여부
- 정부 앱 여부
- 건강 관련 기능 여부

현재 앱 기준 예상 입력:

- 사용자 생성 콘텐츠 있음
- 채팅, 프로필, 스토리, 이미지 업로드 있음
- 신고 기능 있음
- 차단/강퇴/운영자 검토 기능 있음
- 앱 내 구매 있음
- 광고 있음
- 전화번호 인증 사용
- 푸시 알림 사용

### 4. 데이터 보안

수집/처리 가능성이 있는 데이터:

- 전화번호
- 인증 정보
- 사용자 ID
- 프로필 이름/소개/이미지
- 채팅/스토리/댓글/쪽지
- 신고 정보
- 구매 내역
- 포인트 내역
- 앱 활동 및 진단 정보
- 광고 식별자 또는 광고 관련 데이터

주의:

- 실제 수집 여부와 App Store/Play Console 선언이 다르면 심사 리스크가 크다.
- AdMob을 붙인 경우 광고 관련 데이터와 광고 ID 항목을 반드시 확인한다.

### 5. 앱 액세스

심사용 계정 제공:

- 전화번호 계정 또는 관리자/테스트 계정 중 하나를 지정한다.
- 심사자가 로그인 후 주요 기능을 볼 수 있어야 한다.
- 성인 카테고리는 iOS 심사와 충돌하지 않도록 Android에서도 인증 전에는 숨김/비활성 원칙을 유지한다.

### 6. 비공개 테스트

개인 개발자 계정의 경우 Google Play 정책상 프로덕션 출시 전에 다음 조건이 필요할 수 있다.

- 12명 이상의 테스터
- 14일 이상 연속 테스트
- 테스터 opt-in 필요
- 내부 테스트만으로 프로덕션 신청이 열리지 않을 수 있음

따라서 초기 순서는 다음과 같이 간다.

1. 내부 테스트 트랙에 AAB 업로드
2. 설치 및 핵심 기능 점검
3. 비공개 테스트 트랙 생성
4. 테스터 12명 이상 초대 및 opt-in 확인
5. 14일 테스트 기간 확보
6. 프로덕션 신청

## Android에서 추가로 준비해야 할 외부 서비스

### Firebase / FCM

필요한 것:

- Firebase 프로젝트
- Android 앱 등록: `app.mute.chat`
- `google-services.json`
- FCM V1 서비스 계정 키

EAS Credentials 상태:

- FCM Legacy: 없음
- FCM V1: 없음

해야 할 일:

- Firebase Console에서 Android 앱 추가
- `google-services.json` 다운로드
- EAS에 FCM V1 서비스 계정 키 등록
- Android 실기기에서 푸시 수신 테스트

### AdMob

현재 `app.json`에는 Android 테스트 AdMob 앱 ID가 들어가 있다.

- Android 테스트 앱 ID: `ca-app-pub-3940256099942544~3347511713`
- iOS 실제 앱 ID: `ca-app-pub-4013454985021474~4784155440`

Android 실출시 전 필요:

- AdMob에 Android 앱 추가
- Android 앱 ID 발급
- Android 보상형 광고 단위 ID 발급
- Android 배너 광고 단위 ID 발급
- `app.json` 또는 환경변수에 Android 실제 ID 반영

주의:

- 테스트 빌드에서는 테스트 광고 ID 사용이 안전하다.
- 실출시 빌드에서 테스트 ID가 남아 있으면 수익화가 되지 않는다.
- 반대로 개발 중 실제 광고를 반복 노출하면 정책 리스크가 있다.

### Google Play Billing

현재 iOS StoreKit 결제는 붙어 있지만, Android는 Google Play 결제 검증이 별도로 필요하다.

필요한 것:

- Play Console 인앱 상품 생성
- Play Console 구독 상품 생성
- Google Play Developer API 권한
- 서버 검증용 서비스 계정
- Supabase Edge Function 또는 서버 함수에서 Google 구매 토큰 검증

상품 ID는 iOS와 최대한 동일하게 유지하는 것이 관리 비용이 낮다.

## Android 상품 ID 기준

포인트 충전:

- `mute_points_5000`
- `mute_points_11000`
- `mute_points_28000`
- `mute_points_60000`
- `mute_points_200000`
- `mute_points_390000`

앱 테마:

- `mute_theme_white`
- `mute_theme_mint`
- `mute_theme_ocean`
- `mute_theme_lavender`
- `mute_theme_sunset`
- `mute_theme_mono`
- `mute_theme_dark`

광고 제거:

- `mute_ad_free_monthly`

채팅 꾸미기:

- `mute_bubble_color_01` ~ `mute_bubble_color_10`
- `mute_text_color_01` ~ `mute_text_color_09`
- `mute_custom_bubble_color`
- `mute_custom_text_color`
- `mute_custom_background`

주의:

- Play Console 상품 ID와 앱 코드 상품 ID가 1글자라도 다르면 구매 실패가 난다.
- iOS에서 있었던 `_v2`, `unlock_v2` 같은 임시 suffix는 Android에도 넣지 않는다.

## 빌드 명령어

작업 폴더:

```powershell
cd C:\Users\trudy\mute-chat
```

타입 검사:

```powershell
npm.cmd run typecheck
```

Android APK 프리뷰:

```powershell
npm.cmd run preview:android:apk
```

Android AAB 프로덕션 빌드:

```powershell
npm.cmd run build:android
```

Play Console 제출:

```powershell
npm.cmd run submit:android
```

## 첫 Android 빌드 전 점검

- `EXPO_PUBLIC_SCREENSHOT_DEMO`가 `1`이 아닌지 확인
- iOS용 App Store 심사 대응 코드가 Android에서 노출되지 않는지 확인
- Android AdMob ID가 테스트/실서비스 중 어느 모드인지 명확히 확인
- Android 권한 문구가 앱 기능과 맞는지 확인
- Android에서 이미지 선택/카메라/푸시/구매가 정상 동작하는지 확인
- Android 성인 카테고리는 인증 전 노출 금지 원칙 유지
- Android에서만 허용할 기능은 `Platform.OS === 'android'`로 분기

## 현재 블로커

- Android 실제 AdMob 앱/광고 단위 ID 필요
- Firebase FCM V1 설정 필요
- Google Play Billing 서버 검증 구현 필요
- Play Console 비공개 테스트 조건 충족 필요
- 첫 AAB 업로드 후 열리는 Play Console 체크리스트 추가 확인 필요

