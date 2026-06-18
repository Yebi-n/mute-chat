# 뮤트 (Mute)

방마다 다른 프로필로 참여하는 반익명 커뮤니티 채팅 앱의 Expo 프로토타입입니다.

## 실행

```bash
npm install
npm run android
```

iOS는 macOS의 시뮬레이터 또는 Expo Go/EAS Build를 사용합니다.

## 현재 구현

- 프로모션, Member, 콘셉트, 지역별, 성인 탐색 탭
- 제목, 설명, 해시태그 통합 검색
- Figma 흐름을 반영한 방 상세와 가입 신청 상태
- Supabase 전화번호 OTP 세션, 방 목록, 방 생성, 가입 신청 연결
- 8단계 포인트 상품과 시간 누적 방식의 탑스페이스
- 채팅, 스토리, 멤버 및 세부 권한 화면
- 방별 프로필 표현
- 알림, 인증 번호, 포인트, 정책을 포함한 설정 화면
- 공통 디자인 토큰과 iOS/Android 대응

Supabase 환경 변수가 없으면 `src/mockData.ts`의 로컬 목업으로 실행됩니다.
환경 변수가 있으면 인증과 방 관련 데이터부터 서버 모드로 전환됩니다.
실시간 메시지, 스토리지, 결제는 `docs/ARCHITECTURE.md`의 경계에 맞춰 순차 연동합니다.

## Supabase 연결

```bash
copy .env.example .env
```

`.env`에 프로젝트 URL과 **publishable key만** 입력합니다. `service_role` 또는
secret key는 앱과 `.env`에 절대 넣지 않습니다.

```bash
npx supabase link --project-ref oxanqrmkvyniocxwreia
npx supabase db push
```

전화번호 로그인을 실제 발송하려면 Supabase Dashboard의 Authentication에서 SMS
공급자를 별도로 설정해야 합니다. OTP는 회원가입, 새 기기, 세션 만료 때만 요청하고
Supabase Auth rate limit과 SMS 공급자 일일 예산 알림을 반드시 설정합니다.

전화번호 OTP는 번호 소유 확인이며 국내 법적 본인인증이나 성인인증을 대신하지 않습니다.

현재 구현 상태와 출시 전 누락 기능은 `docs/IMPLEMENTATION_AUDIT.md`에 정리되어 있습니다.

## 문서

- `docs/PRODUCT_SPEC.md`: 기능 명세
- `docs/ACTION_PLAN.md`: 단계별 실행 계획
- `docs/DESIGN_SYSTEM.md`: 브랜드와 디자인 시스템
- `docs/ARCHITECTURE.md`: 기술 및 운영 구조
- `docs/DATA_MODEL.md`: 데이터 모델과 API
- `docs/STORE_COMPLIANCE.md`: Apple/Google 심사와 국내 성인인증 운영 기준
- `docs/FEATURE_EXPANSION_2026-06.md`: 강퇴·답장·GIF·스토리·비밀방·푸시 확장 명세
