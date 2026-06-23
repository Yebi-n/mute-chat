# Mute point economy audit

Checked: 2026-06-22

## Top Space

| Cost | Exposure time | Approx. seconds per 100P |
|---:|---:|---:|
| 100P | 20 sec | 20 |
| 500P | 80 sec | 16 |
| 1,000P | 180 sec | 18 |
| 2,000P | 280 sec | 14 |
| 5,000P | 680 sec | 13.6 |
| 10,000P | 1,600 sec (26m 40s) | 16 |
| 30,000P | 4,800 sec (80m) | 16 |
| 50,000P | 8,000 sec (2h 13m 20s) | 16 |

- Any active room member can purchase it.
- Remaining exposure time is added to a new purchase.
- Ranking uses cumulative boost count, not total points or total exposure time.
- App and database values currently match.
- Sources: `App.tsx` `TOP_SPACE_PACKAGES`, `boost_room_top_space()`.

## Attendance and rewarded ads

| Action | Reward | Limit |
|---|---:|---|
| Attendance ad | 10P | Once per 1 hour |
| Additional rewarded ad | 5P | Up to 20 times per calendar day |

- Both rewards require the rewarded ad flow to complete.
- Attendance was originally 30 minutes, but the latest migration overrides it to 1 hour.
- The current daily ad reset uses the database server day boundary. A Korea-time reset policy should be decided before launch.
- Sources: `claim_point_reward()`, `get_my_wallet()`.

## Bubble colors

The default gray is free. The 15 paid colors cost:

| Price | Number of colors |
|---:|---:|
| 1,200P | 3 |
| 1,500P | 3 |
| 1,800P | 3 |
| 2,200P | 2 |
| 2,500P | 2 |
| 2,800P | 1 |
| 3,200P | 1 |

- Custom bubble color: 3,200P.
- App and database values currently match.

## Text colors

The default black is free. The 15 paid colors use the same distribution as bubble colors:

| Price | Number of colors |
|---:|---:|
| 1,200P | 3 |
| 1,500P | 3 |
| 1,800P | 3 |
| 2,200P | 2 |
| 2,500P | 2 |
| 2,800P | 1 |
| 3,200P | 1 |

- Custom text color: 3,200P.
- App and database values currently match.

## Chat background

- Five built-in backgrounds are currently free.
- There is no paid custom chat background product yet.

## Point transfer

- Minimum: 1P.
- Maximum: sender's current balance.
- No transfer fee or daily limit.
- Both users must be active members of the room.
- The server atomically debits the sender, credits the recipient, records two ledger rows, and writes a system message.

## Point charging UI

| Points shown | Price shown |
|---:|---:|
| 6,000P | KRW 1,200 |
| 13,000P | KRW 2,500 |
| 32,000P | KRW 5,900 |
| 66,000P | KRW 12,000 |
| 210,000P | KRW 37,000 |
| 390,000P | KRW 65,000 |

Critical: these six products are UI-only at present. `purchase_point_product()` does not accept `mute.points.*`, and the native purchase service currently calls the point-product RPC directly instead of StoreKit/Google Play Billing receipt verification. These products must not be presented as purchasable in production until store products and server receipt validation are implemented.

## Ad-free subscription

- Intended price from the product plan: KRW 4,900/month.
- Product ID exists: `mute_ad_free_monthly`.
- No active store price lookup, subscription receipt validation, entitlement expiry update, or ad suppression is connected yet.

## Other point-related state

- New users default to 0P in the database.
- The regular test accounts are seeded to at least 10,000P.
- Super-admin test balances were separately seeded in an earlier migration.
- Point ledger reasons currently include attendance, rewarded ad, Top Space, point product purchase, point transfer, and point charging/purchase labels.

## Decisions needed before repricing

1. Define a target cash value per point and keep package bonus rates monotonic.
2. Decide whether Top Space should become more efficient at higher tiers; current efficiency fluctuates.
3. Decide whether custom colors should cost more than the most expensive preset.
4. Decide rewarded-ad daily reset timezone and whether 20 ads/day is acceptable for retention and ad policy.
5. Add transfer abuse controls if points gain monetary value: daily cap, account age, cooldown, and fraud review.
6. Separate point-spend products from App Store/Play Store cash products in naming and server APIs.
