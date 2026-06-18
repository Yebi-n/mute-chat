# 역할극R+ 1.4.3 APK 정적 분석

## 대상

- 원본: `역할극R+-+또+다른+세계_1.4.3_APKPure.apk`
- SHA-256: `3A46E65C4F1496911DE68A6C63C8CD67DDE76A319ADA94615031E7A529E44BD9`
- 패키지: `net.cranix.rolechat2`
- 버전: `1.4.3` (`versionCode 98`)
- 앱 프레임워크: Flutter
- Android: `minSdk 23`, `targetSdk 35`, `compileSdk 35`

원본은 수정하지 않았고, 분석용 복사본으로 매니페스트와 압축 구조만 정적 확인했다.

## 확인된 구성

### 백엔드와 사용자 계정

- Firebase Authentication
- Firebase Realtime Database
- Firebase Cloud Messaging
- Firebase Analytics
- Firebase Dynamic Links
- Google Sign-In/Credentials 지원 흔적

### 수익화

- Google Mobile Ads SDK와 광고 식별자 권한
- Google Play Billing
- Install Referrer 및 Ads Attribution/Topics 권한
- 광고 초기화와 로딩 최적화 플래그

### 미디어와 공유

- Flutter Image Picker
- `UCropActivity` 기반 이미지 크롭
- 파일 공유 Provider
- 이메일 전송 Provider
- URL Launcher/WebView

### 알림과 백그라운드

- FCM 백그라운드 메시지 서비스
- 로컬 예약 알림
- 재부팅 후 알림 복구
- WorkManager

### 저장소와 성능

- AndroidX Room
- DataStore
- Baseline Profile
- ARM64, ARMv7, x86, x86_64 네이티브 번들

### 링크

- 웹 딥링크: `memberplay.xyz`
- 커스텀 스킴: `rolechat2://open`

## UX 벤치마킹

APK 자산에는 채팅, 다중 채팅, 사람, 문서, 검색, 더보기, 랭킹 메달과 별 아이콘이 있다. 이 사실과 매니페스트 구성을 함께 보면 다음 흐름이 핵심으로 보인다.

- 채팅과 게시물을 주 내비게이션으로 분리
- 랭킹/메달로 활동 동기 부여
- 푸시 알림에서 특정 콘텐츠로 딥링크
- 이미지 선택 직후 크롭
- 광고 시청 및 인앱 결제로 재화 획득
- 공유와 이메일 피드백을 OS 기능에 위임

## 뮤트 적용 결정

### 적용

- 전화번호 인증: Firebase Auth 또는 국내 본인인증 사업자 연동 계층으로 분리
- 채팅: 초기에는 Realtime Database 또는 Supabase Realtime 중 하나로 시작
- 푸시: FCM/APNs를 Expo Notifications 뒤에 연결
- 분석: 가입, 가입 신청, 승인, 첫 채팅, 광고 완료, 결제 완료만 최소 수집
- 광고: 보상형 광고 중심. 테마/말풍선/프로모션 재화 지급 직전에만 노출
- 결제: 포인트 묶음과 광고 제거 상품부터 시작
- 이미지: 클라이언트에서 크롭 후 긴 변 1440px, WebP/JPEG 품질 75~82로 축소
- 딥링크: 알림에서 방/스토리/가입 신청 상세로 직접 이동
- 캐시: 최근 방 목록, 마지막 메시지, 프로필 썸네일만 로컬 보관

### 그대로 적용하지 않음

- 앱 시작 시 전면 광고
- 채팅 입력 도중 광고
- 과도한 광고 추적 권한
- 범용 외부 저장소 권한
- 전체 채팅 원문을 분석 이벤트로 전송
- 모든 아키텍처 ABI를 한 APK에 포함

## 저비용 권장 구조

1. Expo/React Native 앱
2. Firebase Auth + FCM
3. Supabase Postgres/Realtime/Storage 또는 Firebase RTDB/Storage
4. 서버 함수에서 가입 승인, 권한, 제재, 포인트 원장 검증
5. 이미지 업로드 전 클라이언트 압축, 서버에서 썸네일 1종만 생성
6. 광고 보상과 결제 영수증은 서버 검증 후 포인트 원장에 기록

채팅 비용이 커지면 최근 메시지만 실시간 구독하고 과거 메시지는 커서 페이지네이션한다. 방 목록 활성도는 메시지 수 자체가 아니라 시간 감쇠 점수로 계산한다.

`activityScore = log(1 + uniqueChatters24h * 3 + messages2h) * decay(lastMessageAt)`

프로모션은 이 점수와 별도 슬롯으로 운영해 사용자에게 구분 표시한다.

## 연동 전 필요한 외부 값

- Firebase 프로젝트와 iOS/Android 앱 등록 값
- Apple/Google 푸시 인증서
- AdMob 앱 ID 및 보상형 광고 단위 ID
- App Store Connect/Play Console 상품 ID
- 본인인증 사업자 계약 정보
- 서버/DB 프로젝트 URL과 공개 키

이 값 없이 실제 광고·결제·푸시를 호출하면 테스트 단계에서도 운영 계정 오염이나 심사 문제가 생길 수 있어 코드에는 주입 지점만 둔다.
