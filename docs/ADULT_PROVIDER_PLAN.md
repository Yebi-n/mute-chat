# Adult Verification Provider Plan

Updated: 2026-06-19

## Recommended path

Use **PortOne 본인인증** as the first integration target.

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

The callback function is generic right now. It still needs to be adapted to the actual provider payload.

Likely changes after credentials arrive:

- verify provider signature format
- map provider success field names
- map adult/age result field names
- hash/store CI consistently
- redirect back to the deployed static portal URL

## Deployment order

1. deploy static policy portal
2. set `EXPO_PUBLIC_OPERATIONS_POLICY_URL`
3. receive provider test credentials
4. set:
   - `ADULT_VERIFICATION_START_URL`
   - `ADULT_VERIFICATION_CALLBACK_SECRET`
   - `ADULT_VERIFICATION_CI_SALT`
5. adapt callback payload parser
6. run end-to-end web verification test
7. verify iOS app state refresh after returning from browser
