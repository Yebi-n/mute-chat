# Apple 심사 답변 초안

최종 업데이트: 2026-07-07

## Guideline 2.1 - ATT

상황에 따라 둘 중 하나로 대응한다.

### 앱이 tracking을 하지 않는 것으로 정리할 경우

```
Hello,

Thank you for the review.

We do not track users across apps or websites owned by other companies. We have updated the App Privacy information in App Store Connect so that tracking is not declared.

The app may display ads, but we do not use AppTrackingTransparency-gated tracking data for the reviewed build.

Thank you.
```

### ATT를 유지할 경우

```
Hello,

Thank you for the review.

We have updated the app so that the App Tracking Transparency permission request appears before any tracking-related advertising data is collected.

We attached a screen recording showing:
1. Launching the app after a fresh install/reset tracking permissions
2. The ATT permission prompt appearing
3. The user flow after the prompt

Thank you.
```

## Guideline 2.3.6 - Age Rating

```
Hello,

Thank you for pointing this out.

The app does not include Parental Controls or Age Assurance mechanisms in the reviewed iOS build. We updated the Age Rating selections to "None" for both Parental Controls and Age Assurance in App Store Connect.

Thank you.
```

## Guideline 2.1 - User Generated Content

```
Hello,

Mute includes user-generated chat rooms, messages, profiles, and stories. The following safety mechanisms are available in the app:

1. Reporting objectionable content
- Users can report rooms, profiles, stories, and related content from the "more" menus in each area.
- Reported items are sent to the server and are available to the operator for review.

2. Blocking and moderation
- Room owners/co-hosts can remove users, block users from rooms, and restrict chat.
- Users who are blocked or removed can no longer access the relevant room.

3. Filtering and review
- Reports are collected on the server with target type, target ID, reporter ID, room/user context, and timestamp.
- The operator reviews submitted reports and can hide, remove, or restrict content/users.

4. 24-hour action
- We review objectionable content reports within 24 hours.
- If a violation is confirmed, we remove or hide the content and restrict/eject the user who provided the offending content.

For review, please log in with the provided test account. Reporting and moderation actions can be found from the more menus in rooms, profiles, and stories.

Thank you.
```

## App Review Notes 추천 문구

```
심사용 계정으로 로그인 후 주요 기능을 확인할 수 있습니다.

앱 내 구입은 포인트 충전, 앱 테마, 채팅 꾸미기 아이템 및 광고 제거 기능에 사용됩니다.

신고 및 차단 기능은 각 방, 프로필, 스토리의 더보기 메뉴에서 확인할 수 있습니다. 운영자는 접수된 신고를 24시간 이내 검토하고, 필요한 경우 콘텐츠 비노출/삭제 및 사용자 제한 조치를 수행합니다.

성인 카테고리 및 성인인증 기능은 iOS 심사 빌드에서 제공되지 않습니다.
```
