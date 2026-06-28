# Adult Verification Provider Plan

Updated: 2026-06-28

## Recommended path

Use **PortOne V2 + KG이니시스 통합본인인증** as the production integration.

Reason:

- one integration surface
- multiple Korean verification channels available through the same developer platform
- easier to swap or compare providers later
- better fit than building direct vendor-specific web flows first

## Official references

- PortOne developer docs:
  - https://developers.portone.io/opi/ko/readme
- PortOne docs navigation currently includes:
  - `본인인증 연동하기`
  - `다날 본인인증`
  - `KCP 본인인증`
  - `KG이니시스 통합인증`

This means PortOne is already positioned as an integration layer for Korean identity verification flows rather than a single hard-coded provider.

## Current deployed state

- Public account/adult-verification portal:
  - `https://operations-policy.vercel.app/`
- PG review service introduction page:
  - `https://service-introduction-theta.vercel.app/`
- Deployed Edge Functions:
  - `start-adult-verification`
  - `complete-adult-verification`
- Applied database migration:
  - `202606280009_secure_adult_verification_attempts.sql`
- Production safety:
  - verification IDs are bound to the authenticated user for 10 minutes
  - expired, reused, or cross-account verification IDs are rejected
  - account phone mismatch is rejected when the provider returns a phone number
  - raw CI is never stored; only a salted SHA-256 value is stored
  - one CI cannot be used by multiple Mute accounts
  - mock verification mode is disabled

## Waiting for the provider

The PortOne application for KG이니시스 통합본인인증 was submitted on 2026-06-28.

After approval, collect:

1. PortOne Store ID
2. KG이니시스 identity-verification channel key
3. PortOne V2 API Secret

Set them as Supabase secrets:

```text
PORTONE_STORE_ID
PORTONE_IDENTITY_CHANNEL_KEY
PORTONE_API_SECRET
```

Then redeploy both Edge Functions and run one real adult-verification test.

## What we need from the provider side

Before the real flow can be completed, collect:

1. start URL or SDK init method
2. callback URL registration method
3. callback payload schema
4. success/failure field names
5. birthdate/adult eligibility field names
6. CI availability and rules
7. test environment credentials
8. production environment credentials

## What our backend already expects

Current callback endpoint:

- `adult-verification-callback`

Current desired outcome on success:

- `users.identity_verified_at` set
- `users.adult_verified_at` set
- `users.identity_provider` set
- `users.adult_content_web_opt_in_at` set
- `users.ios_adult_content_enabled = true`
- optional `users.ci_hash` set

## Gaps still to close

- KG이니시스 contract review and channel issuance
- production secrets listed above
- real-device PASS/integrated-certificate verification test
- confirm which KG이니시스 authentication methods are approved for the Mute service category

## Deployment order

1. receive the KG이니시스 approval email
2. create the production identity-verification channel in PortOne
3. set the three PortOne secrets
4. redeploy `start-adult-verification` and `complete-adult-verification`
5. run an adult and an underage rejection test
6. verify account-phone mismatch and duplicate-CI rejection
7. verify iOS app state refresh after returning from the browser
