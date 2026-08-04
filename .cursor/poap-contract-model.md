# POAP Contract Model For POMP

## Current Contract Reference

POAP documents its live ERC-721 contract address as:

`0x22C1f6050E56d2876009903609a2cC3fEf83B415`

Documented supported networks include:

- Ethereum Mainnet, chain id `1`
- Gnosis, chain id `100`
- Base, chain id `8453`
- Arbitrum, chain id `42161`
- Apechain, chain id `33139`
- Linea, chain id `59144`
- Mantle, chain id `5000`
- Polygon, chain id `137`
- Unichain, chain id `130`
- Chiliz, chain id `88888`
- Celo, chain id `42220`

Source: POAP Smart Contract Reference at `documentation.poap.tech/docs/smart-contract-reference`.

## Relevant POAP Contract Shape

The older verified implementation is ERC-721 plus POAP-specific event/drop mapping and minter roles.

Important read functions:

- `ownerOf(uint256 tokenId) returns (address)`
- `balanceOf(address owner) returns (uint256)`
- `tokenURI(uint256 tokenId) returns (string)`
- `tokenEvent(uint256 tokenId) returns (uint256)`
- `tokenDetailsOfOwnerByIndex(address owner, uint256 index) returns (uint256 tokenId, uint256 eventId)`
- `isEventMinter(uint256 eventId, address account) returns (bool)`

Important write functions:

- `mintToken(uint256 eventId, address to) returns (bool)`
- `mintToken(uint256 eventId, uint256 tokenId, address to) returns (bool)`
- `mintEventToManyUsers(uint256 eventId, address[] to) returns (bool)`
- `mintUserToManyEvents(uint256[] eventIds, address to) returns (bool)`
- `addEventMinter(uint256 eventId, address account)`
- `removeEventMinter(uint256 eventId, address account)`
- `burn(uint256 tokenId)`
- `pause()`
- `unpause()`

Important events:

- `EventToken(uint256 eventId, uint256 tokenId)`
- `EventMinterAdded(uint256 eventId, address account)`
- `EventMinterRemoved(uint256 eventId, address account)`
- standard ERC-721 `Transfer`, `Approval`, `ApprovalForAll`

## What POMP Should Copy

POMP should copy the useful protocol semantics, not the EVM implementation:

- A drop/event id groups many individual collectibles.
- A token/asset id identifies one collector's proof.
- Ownership is collector-specific.
- Issuers can mint or authorize claims.
- Drop metadata and artwork are visible to wallets and apps.
- Indexers can map owner to token and token to drop.

## What POMP Should Improve

- Store drop metadata and artwork on Arweave by default.
- Tag assets for open discovery.
- Link claims to archive snapshots and source contracts.
- Support story/memory metadata, not only attendance metadata.
- Avoid dependence on a single hosted API for collection display.

## Current Implementation Notes

`lib/pomp.ts` implements:

- POAP chain metadata for common supported networks.
- live `ownerOf` verification for POAP token ownership.
- optional `tokenEvent` lookup for drop id discovery.
- POMP atomic asset minting with POAP provenance tags.

The `/pomp` route is a lab UI. It can load a collector's POAPs, verify selected token ownership, mirror artwork to Arweave, and mint a POMP atomic asset through the same AO/HyperBEAM atomic asset path used by story assets.

The server collector route first uses POAP API credentials when available. If credentials are missing, it falls back to public RPC calls against the POAP contract and token metadata.
