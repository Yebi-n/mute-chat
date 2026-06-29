# Mute AdMob 광고 단위 및 배치 정책

업데이트: 2026-06-29

## 광고 형식

- 보상형 광고: 사용자가 직접 선택한 경우에만 전체 화면으로 노출한다.
- 배너 광고: 적응형 배너를 사용하고 콘텐츠나 조작 버튼을 가리지 않는다.
- 광고 제거 구독 사용자는 배너를 보지 않는다. 보상형 광고는 사용자가 선택하면 계속 볼 수 있다.
- 개발 및 TestFlight 기본값은 Google 테스트 광고다. 운영 광고는 테스트 기기 등록 및 출시 준비가 끝난 뒤에만 활성화한다.

## iOS 식별자

- 앱 ID: `ca-app-pub-4013454985021474~4784155440`
- 보상형 광고 단위: `ca-app-pub-4013454985021474/1566965165`
- 현재 공용 인라인 배너 단위: `ca-app-pub-4013454985021474/9051959127`
- 보상형 SSV 콜백: `https://oxanqrmkvyniocxwreia.supabase.co/functions/v1/admob-reward-ssv`

## 배너 단위 분리

출시 전에는 메인, 채팅, 스토리 배너를 각각 별도 광고 단위로 분리한다. 화면별 수익, 로드 실패, 클릭률을 분리해서 확인하고 비정상 클릭이 발생한 위치만 중단하기 위해서다.

| 위치 | 권장 광고 단위 이름 | 환경변수 |
|---|---|---|
| 메인 탭 하단 | `Mute iOS 메인 배너` | `EXPO_PUBLIC_ADMOB_BANNER_MAIN_IOS_ID` |
| 채팅 키보드 상단 | `Mute iOS 채팅 배너` | `EXPO_PUBLIC_ADMOB_BANNER_CHAT_IOS_ID` |
| 스토리 본문과 댓글 사이 | `Mute iOS 스토리 인라인 배너` | `EXPO_PUBLIC_ADMOB_BANNER_STORY_IOS_ID` |

별도 ID가 설정되지 않은 개발 빌드는 현재 공용 인라인 배너 ID로 폴백한다. 광고 단위가 생성되면 Xcode Cloud 환경변수에 각 ID를 넣으며 코드 변경은 필요 없다.

## 실제 배치

1. 메인: 모든 메인 탭에서 바텀 내비게이터 바로 위에 한 개.
2. 채팅: 키보드가 열린 동안 메시지 입력창과 키보드 사이에 한 개.
3. 스토리 상세: 마지막 본문 블록과 댓글 영역 사이에 한 개.

메인과 채팅은 `ANCHORED_ADAPTIVE_BANNER`, 스토리 상세는 `INLINE_ADAPTIVE_BANNER`를 사용한다.

## 배치 안전 기준

- 로그인, 회원가입, 인증, PIN, 결제, 신고, 프로필 편집 화면에는 광고를 넣지 않는다.
- 광고 로드 전 빈 공간을 예약하지 않고, 로드 실패 시 조용히 원래 레이아웃으로 복구한다.
- 한 화면에 동시에 보이는 배너는 원칙적으로 한 개다.
- 광고와 입력창, 전송 버튼, 탭, 뒤로가기 같은 조작 요소 사이에 구분선과 여백을 둔다.
- 광고를 일반 콘텐츠나 버튼처럼 보이게 꾸미지 않는다.
- 화면 전환 직후 같은 터치가 광고 클릭으로 이어지지 않도록 광고 위에 오버레이를 두지 않는다.
- 스토리 스크롤 중 광고가 늦게 로드되어 콘텐츠 위치가 크게 이동하지 않도록 최대 높이를 제한한다.

## 보상형 광고

- 출석 보상: 20P.
- 추가 광고 보상: 10P.
- SSV 서명 검증과 거래 ID 중복 방지는 Supabase에서 처리한다.
- 광고가 완료되기 전에는 포인트를 지급하지 않는다.

## 출시 설정

- 테스트 광고 기본값: `EXPO_PUBLIC_ADMOB_USE_TEST_ADS` 미설정 또는 `true`.
- 운영 광고 활성화: `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false`.
- 운영 광고를 활성화하기 전에 AdMob 테스트 기기를 등록하고 실제 기기 QA를 끝낸다.
- Android는 별도의 앱 ID와 위치별 광고 단위를 생성한다.

## 공식 참고

- Google iOS 배너 광고: https://developers.google.com/admob/ios/banner
- Google iOS 보상형 광고: https://developers.google.com/admob/ios/rewarded
- Google 광고 구현 지침: https://support.google.com/admob/answer/2936217
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
