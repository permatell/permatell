# POMP Campaign Claim Model

## Model

Native event POMPs use a campaign-style atomic asset process.

The creator mints one POMP asset with `supply = maxClaims`, then the app loads a Lua addon into that asset process. The addon stores claim rules and claim history in AO state:

- `POMPCampaignConfig`
- `POMPClaims`

Each attendee claim sends `Action = Claim` to the POMP asset process. If valid, the process transfers `1` balance from the creator/owner to the claimant and records the wallet in `POMPClaims`.

This follows the Bazar campaign pattern from the `I Survived AO Testnet` campaign handler.

## Claim Rules

V1 supports:

- secret-word claims
- one claim per wallet
- max claim supply
- optional claim open/close timestamps
- HyperBEAM `patch@1.0` state sync for campaign state and claims

The secret word is never stored directly. The browser hashes:

```text
sha256("pomp:{assetId}:{normalized-lowercase-claim-word}")
```

The AO process stores only the hash and compares submitted hashes.

## Asset Tags

Campaign POMPs include:

- `Type = POMP`
- `POMP-Asset-Type = native-event`
- `POMP-Claim-Mode = secret-word-campaign`
- `POMP-Campaign-Enabled = true`
- `POMP-Max-Claims`
- `POMP-Claim-Method`
- `POMP-Claim-Start`
- `POMP-Claim-End`
- event metadata tags
- `POMP-Artwork` when artwork is mirrored to Arweave

## Claim Page

Audience claim URL:

```text
/pomp/claim/{assetId}
```

The page connects Wander/ArConnect, hashes the entered word, and sends the claim message to the POMP process.

## Future Improvements

- Read `POMP-Campaign-Info` before and after claim for confirmed status.
- Support QR claim links with one-time nonces.
- Support allowlists and creator-issued invite codes.
- Add a creator dashboard for claim stats.
- Add a public claim status card to the claim page.
