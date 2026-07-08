# Mute 실행 계획

최종 업데이트: 2026-07-07

## 최우선

1. iOS 심사 대응
   - ATT 선언/권한 팝업 상태 정리
   - Age Rating에서 Parental Controls/Age Assurance를 `None`으로 수정
   - UGC 신고/차단/운영자 24시간 조치 설명을 심사 메모에 추가
   - iPhone-only 설정 또는 iPad 스크린샷 요구사항 정리

2. 안정성
   - 방 편집 crash log 재현/수정
   - 방 삭제 RPC/RLS 최종 검증
   - 채팅 검색 결과 이동 안정화
   - 오래된 메시지 pagination 스크롤 위치 보존
   - 신고한 방 숨김 로직과 참여 중 방 신고 차단 검증

3. 결제/광고
   - App Store Connect 상품 ID와 코드 상품 ID 일치 확인
   - StoreKit 자체 검증 실패 로그 개선
   - 광고 제거 계정에서 모든 배너와 예약 여백 제거
   - AdMob 배너가 메인 4탭/채팅/스토리에서 정책에 맞게 뜨는지 확인

## iOS 릴리스 플로우

```powershell
cd C:\Users\trudy\mute-chat
git status --short
npm.cmd run typecheck
git add <changed-files>
git commit -m "..."
git pull --rebase origin main
git push origin main
```

그 다음 Xcode Cloud에서 빌드 상태를 확인한다.

## Android 준비

- Google Play Console 수동 처리는 사용자가 진행했다.
- Android는 iOS와 병렬로 진행하되 iOS 설정을 변경하지 않는다.
- Android 패키지명은 iOS bundle id와 동일한 `app.mute.chat` 기준으로 맞춘다.
- AdMob Android 광고 단위는 별도 생성 전까지 테스트/비활성 기준으로 둔다.
- 성인 탭은 인증 완료 계정에만 노출한다.

## 심사 제출 전 체크리스트

- [ ] `EXPO_PUBLIC_SCREENSHOT_DEMO` 비활성
- [ ] 성인 기능/운영정책 성인인증 링크가 iOS 심사 빌드에서 노출되지 않음
- [ ] ATT 또는 App Privacy tracking 설정이 실제 동작과 일치
- [ ] Age Rating에서 Parental Controls/Age Assurance가 잘못 선택되지 않음
- [ ] 신고/차단/운영자 검토 플로우 설명 준비
- [ ] 앱 내 구입 상품 ID 일치
- [ ] 광고 제거 구매 시 광고와 여백이 모두 제거됨
- [ ] 방 생성/편집/삭제 정상 동작
- [ ] 가입신청/승인/거절/강퇴/차단 알림 정상 동작
- [ ] 전화번호 가입/로그인/비밀번호 찾기 정상 동작

## 다음 개발 후보

- Android AAB 빌드 파이프라인
- Android Play Billing 연결
- Android AdMob 실광고 단위 연결
- 외부 성인인증 공급자 최종 선정 및 계약
- 운영자 신고 웹 인증/필터 고도화
- 서버 부하 대비 인덱스/쿼리 최적화
