# App Review Response - Auto-Renewable Subscription

## App changes

The `광고 없는 계정` purchase section now displays the following information before purchase:

- Subscription title: `광고 없는 계정`
- Duration: `1개월 자동 갱신`
- Price: `월 5,900원`
- Privacy Policy: `https://service-introduction-theta.vercel.app/privacy/`
- Terms of Use (Apple Standard EULA): `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`

Both links are functional in the subscription purchase flow. The Terms of Use link is also available from `내 정보 > 설정 > 이용약관`.

## App Store Connect metadata

Privacy Policy field:

```text
https://service-introduction-theta.vercel.app/privacy/
```

Add this line to the App Description:

```text
이용약관: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

## Reply to App Review

```text
Hello App Review Team,

Thank you for your feedback.

We updated the auto-renewable subscription purchase flow to clearly display the subscription title, one-month renewal period, monthly price, and functional links to both the Privacy Policy and Terms of Use (Apple Standard EULA) before purchase.

You can locate this information at:
My Info > Item Shop > Remove Ads > Ad-Free Account

The Terms of Use is also available at:
My Info > Settings > Terms of Use

Privacy Policy:
https://service-introduction-theta.vercel.app/privacy/

Terms of Use (Apple Standard EULA):
https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

We also added the Terms of Use link to the App Description metadata and confirmed the Privacy Policy URL in the Privacy Policy field.

Thank you.
```

## Screen recording checklist

1. Log in with the review account.
2. Open `내 정보`.
3. Open `아이템샵`.
4. Scroll to `광고 제거`.
5. Show the title, duration, price, Privacy Policy link, and EULA link.
6. Open each link and return to the app.
7. Optionally show `내 정보 > 설정 > 이용약관`.

