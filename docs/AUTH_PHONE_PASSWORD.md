# Mute 전화번호 인증 운영안

## 인증 흐름

- 가입: 전화번호와 비밀번호 입력 후 SMS OTP 1회 인증
- 로그인: 전화번호와 비밀번호만 사용하며 SMS를 보내지 않음
- 비밀번호 찾기: SMS OTP로 전화번호 소유를 확인한 뒤 새 비밀번호 설정
- 로그인 사용자는 설정에서 기존 세션을 이용해 비밀번호 변경 가능

## 비용 및 보안

- OTP는 가입과 실제 비밀번호 분실 때만 사용한다.
- OTP 재전송은 최소 60초로 제한한다.
- Supabase Auth SMS rate limit과 CAPTCHA를 운영 전에 활성화한다.
- 로그인과 복구 오류로 계정 존재 여부를 노출하지 않는다.
- 개발 UI 검증에는 mock data를 사용해 SMS 비용을 소비하지 않는다.
- API Key와 Secret은 앱 코드, `.env`, Git 저장소에 넣지 않는다.

## SMS 공급자

- Supabase Send SMS Hook과 Solapi를 사용한다.
- Solapi 국내 SMS는 공식 가격표 기준 건당 18원이며 VAT 별도다.
- Send SMS Hook은 Supabase Free와 Pro 플랜에서 사용할 수 있다.

## 배포 및 연결

1. `send-auth-sms` Edge Function을 `--no-verify-jwt`로 배포한다.
2. Supabase Dashboard의 `Authentication > Hooks`에서 Send SMS Hook을 HTTP로 생성한다.
3. Hook URL은 아래 주소를 사용한다.

   `https://oxanqrmkvyniocxwreia.supabase.co/functions/v1/send-auth-sms`

4. Hooks 화면에서 발급된 `whsec_` Secret을 복사한다.
5. 프로젝트 폴더에서 `.\scripts\configure-solapi-secrets.ps1`을 실행한다.
6. 터미널 프롬프트에 API Key, API Secret, 등록된 발신번호, Hook Secret을 입력한다.
7. `Authentication > Providers`에서 Phone을 활성화한다.

Edge Function은 Standard Webhooks 서명을 검증하고, `+82` 한국 전화번호와 6자리 OTP만 허용한다.

## 운영 전 필수 설정

1. `Authentication > Rate Limits`에서 SMS 제한을 보수적으로 설정한다.
2. 가입과 비밀번호 복구 요청에 CAPTCHA를 적용한다.
3. 실제 기기에서 가입, 재전송, 로그인, 비밀번호 복구를 각각 시험한다.
4. Solapi 잔액 부족과 발송 실패 시 사용자에게 일반 오류만 노출되는지 확인한다.

비밀번호는 앱 데이터베이스에 저장하지 않고 Supabase Auth가 해시와 검증을 담당한다.
