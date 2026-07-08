# Mute 인수인계

최종 업데이트: 2026-07-07

## 목적

이 문서만 읽어도 새 Codex 또는 개발자가 `C:\Users\trudy\mute-chat`에서 바로 이어서 작업할 수 있도록 현재 구조, 배포 방식, 서버, 심사 상태, 주의점을 정리한다.

## 로컬/원격

- 로컬 폴더: `C:\Users\trudy\mute-chat`
- GitHub: `Yebi-n/mute-chat`
- 기본 브랜치: `main`
- iOS Bundle ID: `app.mute.chat`
- App Store Connect 앱 ID: `6781187934`
- Supabase project ref: `oxanqrmkvyniocxwreia`

## 현재 배포 전략

### iOS

- 기본 빌드 경로는 Xcode Cloud다.
- GitHub `main`에 푸시하면 Xcode Cloud가 빌드한다.
- EAS iOS는 무료 빌드 한도 때문에 백업 경로로만 사용한다.
- Xcode Cloud 빌드 실패 시 먼저 `ios/ci_scripts/ci_post_clone.sh`와 Node 설치 로그를 확인한다.
- 빌드 번호 오류가 나면 이전 업로드 빌드보다 높은 build number가 필요하다.

일반 작업 순서:

```powershell
cd C:\Users\trudy\mute-chat
git status --short
npm.cmd run typecheck
git add <changed-files>
git commit -m "..."
git pull --rebase origin main
git push origin main
```

### Android

- Android는 iOS와 병렬로 준비한다.
- iOS 설정을 건드리지 않는 것을 원칙으로 한다.
- Google Play Console 수동 처리와 기기 인증 확인은 사용자가 진행했다.
- 초기 Android 빌드는 EAS Android 또는 추후 GitHub Actions/Gradle 중 비용이 낮은 쪽을 선택한다.

## 데모 모드

앱스토어 스크린샷 캡처용 데모 모드가 있다.

- 환경변수: `EXPO_PUBLIC_SCREENSHOT_DEMO=1`
- Supabase에 저장하지 않는 로컬 전용 데이터
- 심사용/실사용 빌드에서는 반드시 제거하거나 `0`으로 설정

검수 체크:

```powershell
Select-String -Path ios/.xcode.env -Pattern "EXPO_PUBLIC_SCREENSHOT_DEMO"
```

## Supabase

기본 명령:

```powershell
cd C:\Users\trudy\mute-chat
npx.cmd supabase login
npx.cmd supabase link --project-ref oxanqrmkvyniocxwreia
npx.cmd supabase db push
```

Edge Function 배포:

```powershell
npx.cmd supabase functions deploy <function-name> --no-verify-jwt
```

주의:

- `schema_migrations_pkey` 중복 에러는 해당 마이그레이션이 이미 원격 DB에 적용됐다는 뜻일 수 있다.
- 이 경우 실패로 단정하지 말고 함수/컬럼이 실제 존재하는지 SQL로 확인한다.
- `supabase/.temp/*` 파일은 로컬 상태 파일이므로 커밋하지 않는다.

## 주요 서버 기능

- 전화번호 회원가입/로그인
- 방 생성/수정/삭제
- 방 멤버/권한/가입신청
- 채팅/사진/쪽지/하트/포인트 전송
- 스토리/댓글
- 신고/차단
- 포인트/아이템/테마 구매 검증
- AdMob 리워드 SSV
- 운영자 신고 확인 웹

## 결제/광고

자세한 값은 `MONETIZATION_SETUP.md`와 `ADMOB_AD_FORMAT_AND_PLACEMENT.md`를 기준으로 한다.

핵심 기준:

- StoreKit은 RevenueCat 없이 자체 검증한다.
- 검증 함수: `verify-store-purchase`
- Apple IAP 상품 ID는 App Store Connect의 ID와 정확히 일치해야 한다.
- 앱 코드에 `_unlock_v2` 같은 임시 suffix가 남아 있으면 구매 검증이 실패한다.
- 광고 제거 구매 계정은 배너와 배너 예약 여백까지 모두 사라져야 한다.

## 성인 기능

- iOS 심사 빌드에서는 성인 탭과 성인인증 진입점을 노출하지 않는다.
- 방 생성/편집에서 성인 항목은 비활성화 상태로 표시한다.
- iOS 문구: `인증 필요`, `iOS에서 이용할 수 없는 기능입니다.`
- Android는 성인인증 완료 계정에만 성인 탭을 노출하는 방향으로 별도 진행한다.
- 외부 성인인증 공급자 계약은 아직 확정 전이다.
- PortOne/KG이니시스 통합인증 계약 진행 상황과 제출 서류는 `ADULT_PROVIDER_PLAN.md`를 기준으로 본다.
- 계약서 날인, 인감증명서, 보증보험, PG/본인확인 최종 승인처럼 법적/금융 책임이 있는 단계는 사용자가 직접 승인한다.

## Apple 심사 대응

최근 Apple 피드백:

- ATT 권한 요청이 보이지 않음
- Age Rating에서 Parental Controls/Age Assurance 선택이 잘못됨
- UGC 신고/차단/필터링/24시간 조치 설명 필요

현재 대응 방향:

- 앱이 추적을 하지 않는다면 App Privacy에서 tracking 선언을 제거한다.
- 앱이 AdMob 추적을 한다면 ATT 요청을 광고/추적 데이터 수집 전에 띄우고 실기기 녹화본을 첨부한다.
- Age Rating에서 Parental Controls와 Age Assurance는 `None`으로 수정한다.
- 신고/차단/운영자 검토 위치를 심사 메모에 명시한다.

## 현재 알려진 주의점

- 신고한 방은 방 목록/프로모션/탑스페이스/스토리에서 숨겨진다.
- 사용자가 이미 참여 중인 방은 신고하지 못하게 해야 한다.
- 방이 안 보이면 먼저 `room_reports` 또는 신고 필터를 확인한다.
- 방 삭제는 `delete_room_as_owner(uuid)` RPC와 RLS/권한 함수를 함께 확인한다.
- 방 편집 충돌은 TestFlight crash log와 `update_room_details` RPC를 같이 봐야 한다.
- 채팅 검색 이동은 레이아웃 계산 완료 전 화살표를 비활성화해야 한다.
- 오래된 메시지 pagination은 스크롤 위치 보존이 중요하다.

## 빌드 전 체크

```powershell
cd C:\Users\trudy\mute-chat
git status --short
npm.cmd run typecheck
```

빌드 전 확인 항목:

- `EXPO_PUBLIC_SCREENSHOT_DEMO`가 꺼져 있는지
- iOS 심사용 빌드에서 성인 진입점이 노출되지 않는지
- App Store Connect 상품 ID와 코드 상품 ID가 일치하는지
- `supabase/.temp/*`, crash log, 로컬 캡처 산출물이 커밋되지 않았는지
- Google/Apple/PG 관련 개인키나 토큰이 문서에 남지 않았는지

## 수동 처리 항목

사용자가 직접 해야 하는 항목:

- App Store Connect 메타데이터 수정
- Google Play Console 계정/앱/기기 인증 관련 웹 콘솔 처리
- Apple/Google 결제 상품 생성 및 심사 제출
- 성인인증/본인확인 공급자 계약
- 실기기 권한 팝업 녹화

Codex가 할 수 있는 항목:

- 코드 수정
- 문서 갱신
- Supabase migration/function 작성
- SQL 점검 쿼리 작성
- 커밋/푸시 준비
- 심사 답변 초안 작성
