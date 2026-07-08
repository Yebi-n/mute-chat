# Xcode Cloud 빌드 설정

최종 업데이트: 2026-07-07

## 현재 기준

- iOS 기본 빌드 경로는 Xcode Cloud다.
- EAS iOS는 무료 빌드 한도 때문에 백업 경로로만 둔다.
- GitHub 저장소: `https://github.com/Yebi-n/mute-chat`
- 기본 브랜치: `main`
- Bundle ID: `app.mute.chat`
- App Store Connect 앱 ID: `6781187934`

## 일반 빌드 흐름

```powershell
cd C:\Users\trudy\mute-chat
git status --short
npm.cmd run typecheck
git add <changed-files>
git commit -m "..."
git pull --rebase origin main
git push origin main
```

`main`에 push하면 Xcode Cloud 워크플로가 실행된다.

## 스크린샷 데모 모드

- 스크린샷 캡처 전용: `EXPO_PUBLIC_SCREENSHOT_DEMO=1`
- 심사용/실사용 빌드: 제거하거나 `0`
- 데모 모드가 켜져 있으면 Supabase 대신 로컬 샘플 데이터가 보인다.

## ci_post_clone 주의

Xcode Cloud 기본 이미지에는 Node가 없을 수 있다. `ios/ci_scripts/ci_post_clone.sh`에서 Node 설치 또는 경로 설정을 처리한다.

빌드 실패 예시:

```text
error: Node.js was not found in Xcode Cloud image.
Running ci_post_clone.sh script failed (exited with code 1)
```

이 경우 `ci_post_clone.sh`의 Node 설치 로직을 먼저 확인한다.

## 빌드 번호

App Store Connect 업로드는 이전 빌드보다 높은 build number가 필요하다.

오류 예시:

```text
The bundle version must be higher than the previously uploaded version.
```

해결:

- Xcode Cloud 빌드 번호 자동 증가 설정 확인
- 또는 native/app config의 build number를 올린 뒤 재빌드

## iPad 지원

앱은 현재 iPhone 중심이다. App Store Connect에서 iPad 스크린샷을 요구하면 다음 중 하나를 선택한다.

- iPad 지원을 끄고 iPhone only로 설정 후 재빌드
- iPad 스크린샷 13형 디스플레이 요구사항을 충족해 업로드

현재 목표는 iPhone only다.

