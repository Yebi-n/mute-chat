# 스토어 심사 대응

최종 업데이트: 2026-07-07

## App Store

### 현재 주요 피드백

1. ATT 프롬프트 확인 불가
2. Age Rating의 Parental Controls/Age Assurance 선택 불일치
3. UGC 안전장치 설명 필요
4. iPad 스크린샷 요구

### 대응

- 앱이 tracking하지 않는다면 App Privacy에서 tracking 선언 제거
- tracking한다면 ATT 프롬프트를 광고/추적 데이터 수집 전에 표시하고 실기기 녹화 첨부
- Age Rating에서 Parental Controls/Age Assurance는 `None`
- 신고/차단/운영자 24시간 조치 내용을 App Review Notes에 기재
- iPhone-only 앱이면 iPad 지원을 끄고 새 빌드 제출
- iPad 지원을 유지하면 13-inch iPad 스크린샷 업로드

## App Review Notes

권장 문구:

```text
심사용 계정으로 로그인 후 주요 기능을 확인할 수 있습니다.

앱 내 구입은 포인트 충전, 앱 테마, 채팅 꾸미기 아이템 및 광고 제거 기능에 사용됩니다.

신고 및 차단 기능은 각 방, 프로필, 스토리의 더보기 메뉴에서 확인할 수 있습니다. 운영자는 접수된 신고를 24시간 이내 검토하고, 필요한 경우 콘텐츠 비노출/삭제 및 사용자 제한 조치를 수행합니다.

성인 카테고리 및 성인인증 기능은 iOS 심사 빌드에서 제공되지 않습니다.
```

## 자동 갱신 구독

- 구독 구매 화면에 상품명, 구독 기간, 가격을 함께 표시한다.
- 구매 전에 개인정보처리방침과 이용약관 링크를 모두 확인할 수 있어야 한다.
- 개인정보처리방침: `https://service-introduction-theta.vercel.app/privacy/`
- Apple 표준 EULA: `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
- App Store Connect의 앱 설명에도 Apple 표준 EULA 링크를 기재한다.

## UGC 안전장치

- 신고 대상: 방, 프로필, 스토리, 채팅 관련 콘텐츠
- 신고 위치: 각 화면의 더보기 메뉴
- 차단/강퇴: 방장/부방장/관리자 권한
- 서버 기록: reporter id, target type/id, room id, created_at, status
- 운영 원칙: 24시간 이내 검토, 위반 콘텐츠 삭제/비노출, 반복 위반 사용자 제한

## 성인 기능

- iOS 심사 빌드에서는 성인 탭과 성인인증 진입점을 노출하지 않는다.
- 방 생성/편집에서 성인 항목은 비활성화만 표시한다.
- 앱 안에서 외부 우회 방법이나 웹 성인인증 안내를 직접 제공하지 않는다.

## Google Play

- Google Play Console 수동 처리와 기기 인증은 사용자가 진행했다.
- Android 출시 시 데이터 보안 설문과 실제 권한/SDK 사용이 일치해야 한다.
- Android 성인 탭은 인증 완료 계정에만 노출한다.
- 프로모션에는 성인방을 노출하지 않는다.
