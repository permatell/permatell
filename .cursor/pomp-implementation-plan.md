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
- server-side POAP collection lookup through `/api/poap/collector`
- no-key fallback that enumerates POAP ownership from public RPCs using `balanceOf`, `tokenDetailsOfOwnerByIndex`, and `tokenURI`
- POAP artwork proxy route at `/api/poap/artwork`
- artwork mirroring to Arweave before POMP minting

Needs validation:

- Verify RPC reliability for each supported POAP network.
- Confirm POMP atomic assets index in Bazar and Arweave gateways.
- Test with a real POAP token on Gnosis and Polygon.
- Confirm the POAP owner can be different from the Arweave minting wallet.
- Compare POAP API metadata against on-chain `tokenURI` metadata for several drops.

## POAP Data Strategy

Preferred path:

1. Use `GET https://api.poap.tech/actions/scan/{address}` from a server route.
2. Keep credentials server-only with `POAP_API_KEY` or `POAP_AUTH_TOKEN`.
3. Use the returned event details, token id, chain, owner address, and artwork URL to prefill POMP.

Fallback path while waiting for POAP API approval:

1. Query the live POAP ERC-721 contract on supported chains.
2. Read `balanceOf(owner)`.
3. Enumerate `tokenDetailsOfOwnerByIndex(owner, index)` to get token id and drop id.
4. Read `tokenURI(tokenId)`.
5. Fetch NFT metadata from the token URI.
6. Use the metadata image/title/description to prefill POMP.

This fallback is slower and depends on public RPC reliability, but it avoids POAP API credentials and is enough for collector-side migration testing.

Metadata completeness depends on the token URI. Title, description, image, token id, and drop id are usually available. Start date, end date, city, country, and event URL are parsed from direct metadata fields, nested event/drop objects, or attributes when present. The official POAP API remains the richer source for event details.

`POST /actions/claim-delivery-v2` is not useful for POMP collection import. It claims a POAP from a delivery id and still requires `x-api-key`; it does not list a collector's existing POAPs.

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
