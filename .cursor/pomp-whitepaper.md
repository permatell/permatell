# POMP: Proof of Memory Protocol

## Summary

POMP is PermaTell's Arweave-native proof of memory format. It is inspired by POAP's proof-of-attendance model, but designed for permanent storage, atomic asset ownership, open indexing, and richer memory context.

The first POMP use case is POAP continuity: a collector who already owns a POAP can claim a corresponding Arweave atomic asset that preserves the event memory, artwork provenance, and original chain ownership proof.

## Why POMP

POAP proved that lightweight event collectibles can become a meaningful social memory layer. The next step is making those memories permanent, portable, and open to richer publishing workflows.

POMP should solve four problems:

1. Permanent storage for the artwork and memory metadata.
2. Verifiable provenance from existing POAP ownership or new PermaTell drop rules.
3. Discoverable ownership and drop indexing without depending on a closed app.
4. A storytelling layer where attendance proofs can become durable narratives.

## Core Concepts

### POMP Drop

A POMP Drop describes the shared memory:

- title
- description
- artwork Arweave transaction id
- start and end date
- city, country, or virtual location
- issuer wallet
- claim rules
- maximum supply or open claim status
- source provenance, such as POAP archive data

### POMP Claim

A POMP Claim is a collector-specific record. For POAP migration, the claim is valid when the connected EVM wallet owns the referenced POAP token on the referenced chain.

### POMP Atomic Asset

A POMP Atomic Asset is the claimable collectible minted through AO/HyperBEAM using Permaweb atomic asset conventions. The asset contains structured JSON data and tags for discovery.

Required tags:

- `App-Name=PermaTell`
- `Type=POMP`
- `POMP-Version=0.1`
- `POMP-Asset-Type=poap-claim`
- `POMP-Claim-Mode=poap-owner-verified`
- `POMP-Source=POAP`
- `POAP-Contract=0x22C1f6050E56d2876009903609a2cC3fEf83B415`
- `POAP-Network`
- `POAP-Chain-Id`
- `POAP-Token-Id`
- `POAP-Drop-Id`
- `POAP-Owner`

## POAP Migration Flow

1. Collector connects an EVM wallet.
2. PermaTell reads POAP ownership from the live POAP ERC-721 contract.
3. PermaTell optionally enriches the drop from the POAP archive snapshot.
4. Collector connects an Arweave wallet.
5. PermaTell mints a POMP atomic asset with POAP provenance.
6. POMP assets are indexed by tags and shown in PermaTell profiles and dashboards.

## Long-Term Direction

POMP should become more than a POAP mirror. Native POMP drops can support:

- event attendance
- private community claims
- story completion mementos
- writer/fan participation proofs
- geolocated or virtual memories
- issuer-curated collections
- immutable publication receipts

The protocol should stay simple: a drop, a claim, a permanent asset, and a public index.
