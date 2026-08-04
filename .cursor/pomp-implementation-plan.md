# POMP Implementation Plan

## Phase 1: Claim Lab

Status: started on `feat/pomp`.

Implemented:

- `lib/pomp.ts`
- `/pomp` claim lab route
- POAP ownership verification through ERC-721 `ownerOf`
- optional POAP drop id lookup through `tokenEvent`
- POMP atomic asset minting through AO/HyperBEAM
- POMP/POAP provenance tags

Needs validation:

- Verify RPC reliability for each supported POAP network.
- Confirm POMP atomic assets index in Bazar and Arweave gateways.
- Test with a real POAP token on Gnosis and Polygon.
- Confirm the POAP owner can be different from the Arweave minting wallet.

## Phase 2: Archive Import

Use the POAP archive from `https://poaparchive.com/`.

Archive structure:

- `poap.sqlite`
- `artwork/{drop_id}.webp`

Tables:

- `drops`
- `tokens`
- `email_reservation_stats`
- `snapshot_metadata`

Implementation path:

1. Add an archive adapter that reads `drops` and `tokens`.
2. Let a collector search by EVM owner address.
3. Show all claimable POAP drops.
4. Upload/mirror artwork to Arweave if it is not already permanent.
5. Mint one POMP per verified token.
6. Store source fields:
   - `source_uid`
   - `poap_id`
   - `drop_id`
   - `network`
   - `owner_address`
   - `minted_on`
   - `transfer_count`
   - archive snapshot hash

## Phase 3: Public Registry

The current mainnet story process path stores story records in browser localStorage. That is why local mainnet story assets can mint successfully but not appear globally in production.

POMP should not rely on localStorage.

Needed:

- A POMP registry process or tag-indexed query strategy.
- Owner to POMP lookup.
- Drop to claims lookup.
- Source POAP token to POMP lookup.
- Dashboard/profile integration.
- Duplicate claim prevention.

## Phase 4: Native POMP Drops

Native drops should not require a POAP source.

Issuer flow:

1. Create POMP drop.
2. Upload artwork.
3. Define claim rules.
4. Publish drop registry entry.
5. Share claim link.

Collector flow:

1. Open claim link.
2. Satisfy claim rule.
3. Mint POMP atomic asset.
4. See POMP in profile and collection views.

## Phase 5: Production Hardening

- Add duplicate claim checks.
- Add batch claim support.
- Add drop search and filtering.
- Add clear errors for wallet/network mismatch.
- Add integration tests around tag construction.
- Add docs for issuer and collector flows.
