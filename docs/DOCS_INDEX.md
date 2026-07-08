# Mute 문서 인덱스

최종 업데이트: 2026-07-07

이 문서는 `docs/` 폴더의 현재 기준 색인이다. 인수인계나 다음 작업을 시작할 때는 먼저 `HANDOFF_CODEX.md`, `ACTION_PLAN.md`, `STORE_COMPLIANCE.md`, `MONETIZATION_SETUP.md`를 확인한다.

## 현재 운영 기준

- iOS 배포는 Xcode Cloud + GitHub `main` 푸시가 기준이다.
- EAS iOS는 무료 빌드 한도 때문에 백업 경로로만 둔다.
- Android는 iOS와 병렬로 준비하되, 기존 iOS 설정을 깨지 않는 방향으로 진행한다.
- Google Play Console 수동 처리와 기기 인증 확인은 2026-07-07 기준 사용자가 진행했다.
- 심사용/실사용 빌드에서는 `EXPO_PUBLIC_SCREENSHOT_DEMO`를 제거하거나 `0`으로 둔다.
- 스크린샷 캡처용 빌드에서만 `EXPO_PUBLIC_SCREENSHOT_DEMO=1`을 사용한다.
- 성인 카테고리와 성인인증 진입점은 iOS 심사 빌드에서 노출하지 않는다.
- 광고 제거 구매 계정은 모든 배너와 배너 예약 여백이 사라져야 한다.

## 우선 확인 문서

| 문서 | 현재 용도 |
| --- | --- |
| `HANDOFF_CODEX.md` | 새 Codex/개발자가 바로 이어받기 위한 전체 인수인계 |
| `ACTION_PLAN.md` | 심사 전후 우선순위와 다음 작업 |
| `STORE_COMPLIANCE.md` | App Store/Play Store 심사 대응 |
| `MONETIZATION_SETUP.md` | IAP, 포인트, 광고, 아이템 정책 |
| `ADMOB_AD_FORMAT_AND_PLACEMENT.md` | AdMob 광고 단위와 배치 정책 |
| `ADULT_VERIFICATION_CONTRACT_STATUS_20260707.md` | PortOne/KG이니시스 성인인증 계약 메일 판독 결과 |
| `ANDROID_WEB_SETUP_PROGRESS_20260707.md` | Google Play Console 웹 입력 진행표 |
| `ANDROID_RELEASE_GITHUB_STRUCTURE.md` | Android 병렬 출시 구조 |
| `ANDROID_PLAY_CONSOLE_CHECKLIST.md` | Google Play Console 수동 처리 체크리스트 |
| `ANDROID_RELEASE_STATUS_20260707.md` | Android repo/콘솔 준비 현황과 다음 실행 순서 |
| `XCODE_CLOUD_SETUP.md` | iOS 빌드/배포 절차 |
| `SCREENSHOT_DEMO_MODE.md` | 앱스토어 스크린샷용 로컬 데모 모드 |
| `ADMIN_REPORTS_WEB.md` | 운영자 신고 확인 웹 |

## 문서 상태

| 문서 | 상태 |
| --- | --- |
| `ACTION_PLAN.md` | 최신 운영 계획으로 갱신 |
| `ADMIN_REPORTS_WEB.md` | 신고 운영 웹 기준 갱신 |
| `ADMOB_AD_FORMAT_AND_PLACEMENT.md` | iOS 광고 단위/배치 기준 갱신 |
| `ADULT_PROVIDER_PLAN.md` | 성인인증 공급자 검토 참고 문서 |
| `ADULT_VERIFICATION_CONTRACT_STATUS_20260707.md` | 2026-07-07 메일 판독 기준 최신 계약 상태 |
| `ADULT_PROVIDER_REQUEST_TEMPLATE.md` | 공급자 문의 템플릿 |
| `ADULT_VERIFICATION_PLATFORM_POLICY.md` | iOS/Android 성인 정책 기준 갱신 |
| `ADULT_WEB_FLOW_SETUP.md` | 외부 성인인증 웹 흐름 기준 갱신 |
| `ANDROID_PLAY_CONSOLE_CHECKLIST.md` | Google Console 처리 상태 반영 |
| `ANDROID_RELEASE_GITHUB_STRUCTURE.md` | Android 병렬 출시 기준 반영 |
| `ANDROID_RELEASE_STATUS_20260707.md` | Android 출시 준비 현황 실측값 정리 |
| `ANDROID_WEB_SETUP_PROGRESS_20260707.md` | Play Console에서 바로 입력 가능한 항목과 보류 항목 정리 |
| `APP_REVIEW_REPLY_20260706.md` | Apple 심사 답변 초안 갱신 |
| `ARCHITECTURE.md` | 기존 구조 참고 문서 |
| `AUTH_PHONE_PASSWORD.md` | 전화번호/비밀번호 인증 참고 문서 |
| `BENCHMARK_APK_ANALYSIS.md` | Android 레퍼런스 분석 참고 문서 |
| `BUILD_DISTRIBUTION_COST.md` | 빌드 비용 의사결정 참고 문서 |
| `CHAT_COLOR_AUDIT_2026-06-29.md` | 색상/테마 감사 참고 문서 |
| `CHAT_MESSAGE_RULES.md` | 채팅 메시지 정책 참고 문서 |
| `DATA_MODEL.md` | DB 구조 참고 문서 |
| `DEFERRED_PHOTO_PAYMENT_TODO.md` | 사진/결제 후속 TODO 참고 문서 |
| `DESIGN_SYSTEM.md` | 디자인 시스템 참고 문서 |
| `FEATURE_EXPANSION_2026-06.md` | 2026-06 기능 확장 기록 |
| `FIGMA_INSPECTION.md` | Figma 점검 참고 문서 |
| `FIGMA_REDESIGN_NOTES.md` | 리디자인 참고 문서 |
| `HANDOFF_CODEX.md` | 최신 인수인계 기준으로 갱신 |
| `HARDCODED_BEHAVIOR_AUDIT.md` | 하드코딩 감사 참고 문서 |
| `IMPLEMENTATION_AUDIT.md` | 구현 감사 참고 문서 |
| `MONETIZATION_SETUP.md` | 최신 결제/광고 정책으로 갱신 |
| `POINT_ECONOMY_AUDIT.md` | 포인트 경제 감사 참고 문서 |
| `PRIVACY_POLICY_KO_DRAFT.md` | 개인정보 처리방침 초안 |
| `PRODUCT_SPEC.md` | 제품 스펙 참고 문서 |
| `PUSH_OPERATIONS.md` | 알림 운영 기준 갱신 |
| `READ_RECEIPTS_TODO.md` | 읽음선 후속 TODO 참고 문서 |
| `REPORT_EMAIL_OPERATIONS.md` | 신고 이메일/운영 기준 갱신 |
| `REQUESTS_15_32_STATUS.md` | 과거 요청 상태 기록 |
| `SCALING_RUNBOOK.md` | 서버 안정화 런북 갱신 |
| `SCREENSHOT_DEMO_MODE.md` | 데모 모드 기준 갱신 |
| `STORE_COMPLIANCE.md` | 심사 대응 기준 갱신 |
| `STOREKIT_REVENUECAT_SETUP.md` | RevenueCat 제외, 자체 검증 기준으로 갱신 |
| `XCODE_CLOUD_SETUP.md` | Xcode Cloud 기준 갱신 |
| `XCODE_FRIEND_SETUP_GUIDE.md` | 친구 Mac/Xcode 지원 참고 문서 |

## 변경 시 주의

- 문서에 실제 API Key, p8 개인키, Supabase service role key, Apple shared secret은 기록하지 않는다.
- iOS 심사 관련 문구는 성인 기능 우회 안내로 보이지 않게 작성한다.
- Android 문서 수정 시에도 iOS 빌드 설정, Bundle ID, App Store Connect 설정을 임의로 바꾸지 않는다.
- Supabase 마이그레이션이 이미 적용된 경우 `schema_migrations_pkey` 중복 에러는 원격 적용 완료 신호일 수 있으므로 SQL 함수 존재 여부를 먼저 확인한다.
