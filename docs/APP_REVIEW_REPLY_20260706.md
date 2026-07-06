# App Review Reply - 2026-07-06

## 1. ATT 안내

이번 빌드에서 광고 SDK 초기화 전에 App Tracking Transparency 권한 요청이 먼저 실행되도록 수정했습니다.

검수 메모에 첨부할 내용:

```text
We updated the app so the App Tracking Transparency prompt is requested before initializing the Google Mobile Ads SDK or requesting ads.

To verify:
1. Install the app fresh, or reset tracking permissions in iOS Settings.
2. Launch the app.
3. The ATT permission prompt appears before ad initialization.
4. After the user responds, the app continues to the main flow and ads are requested with non-personalized ad settings.
```

필요 작업:

- 실제 기기에서 앱 삭제 후 재설치 또는 설정에서 추적 권한 초기화
- 첫 실행부터 ATT 팝업이 뜨는 화면 녹화
- App Review Information의 Notes에 녹화 첨부

## 2. Age Rating 수정

현재 iOS 심사용 앱에는 별도 보호자 통제나 앱 내 연령 보증 UI를 노출하지 않습니다.

App Store Connect에서 다음처럼 수정:

- Parental Controls: None
- Age Assurance: None

## 3. UGC 안전장치 답변

App Review 답변 초안:

```text
Mute includes user-generated chat rooms, messages, stories, comments, profile content, and images. The app provides the following moderation precautions:

1. Filtering objectionable content
   - The service is phone-authenticated.
   - Adult-category access is hidden on iOS for review builds.
   - Reported rooms or blocked rooms are hidden from room lists, story lists, promotion lists, and top-space lists for the reporting or blocked user.
   - We operate keyword filtering and manual operator review for illegal, abusive, or objectionable content.

2. Flagging objectionable content
   - Users can report rooms, users, stories, comments, chat messages, and images from the relevant more/profile/report menus.
   - Reports are stored on the server with reporter user ID, target type, target ID, room/story/message context, reason, and creation time.
   - Operators can review reports from the admin report page.

3. Blocking abusive users
   - Room owners and moderators can mute, kick, and block members.
   - Blocked members cannot re-enter the room and cannot see the room in room lists, promotions, top-space lists, or story surfaces.
   - Users can also report abusive accounts.

4. 24-hour moderation
   - We review objectionable content reports within 24 hours.
   - If a report is valid, we remove or restrict the content and eject, block, or suspend the offending user as appropriate.
```

심사자가 앱 안에서 찾을 위치:

```text
- Room report: Home > select a room > room detail > more menu > Report
- User report/block: Chat room > member profile or member management > more/actions
- Story report: Public Story or room story > story detail > more menu > Report
- Comment/report handling: story detail and admin report page
```

## 4. Permission Prompt Test Notes

Use these notes when recording or replying to App Review:

```text
Permission prompts are intentionally shown at the point where the related feature is used.

- App Tracking Transparency: shown on a fresh launch before Google Mobile Ads SDK initialization.
- Push notifications: shown after login when the app registers the device for room/story/join-request notifications.
- Camera: shown when the user chooses Camera from profile, room image, story, or chat image upload.
- Photos: shown when the user chooses Gallery from profile, room image, story, or chat image upload.
- Photo library save permission: shown when the user opens a chat image and taps Save.

For ATT testing, the device must have Settings > Privacy & Security > Tracking > Allow Apps to Request to Track enabled. If the prompt was already answered, reinstall the app or reset tracking permissions before recording.
```
