# POMP POAP Archive Fallback

## Goal

POMP should keep working if live POAP metadata endpoints become unreliable or disappear. The live POAP contract/RPC path remains the preferred ownership proof, but the Kira POAP archive can provide durable drop metadata and artwork for recovery and migration flows.

## Archive Source

Use the ZIP from `https://poaparchive.com/`, not the ZIM.

- ZIP contains `poap.sqlite` plus `artwork/{drop_id}.webp`.
- ZIM is useful for human offline browsing with Kiwix, but it is not the right shape for programmatic lookup.
- Do not commit the 15 GB archive into this repository.

Verify downloads before use:

```bash
sha256sum -c <<'EOF'
046850de3bd4b3c6aa75c33c4a1a589b4ab176aacdd5986c1a824df803c07633  archive.zip
EOF
```

## Server Configuration

After extracting the archive somewhere on the server or a mounted volume:

```bash
POAP_ARCHIVE_DB_PATH=/data/poap-archive/poap.sqlite
POAP_ARCHIVE_ARTWORK_DIR=/data/poap-archive/artwork
POAP_ARCHIVE_SQLITE_BIN=sqlite3
```

`POAP_ARCHIVE_SQLITE_BIN` is optional and defaults to `sqlite3`.

The app does not require these variables. If they are missing, the current live POAP API/on-chain fallback continues to work.

## Runtime Behavior

- `/api/poap/archive?tokenId=...` looks up a token/drop in `poap.sqlite`.
- `/api/poap/archive?dropId=...` looks up drop metadata without requiring ownership.
- `/api/poap/artwork?dropId=...` serves `artwork/{drop_id}.webp` from the archive folder.
- `/api/poap/collector?address=...` still proves collection ownership from the live API or chain, then fills missing title, description, dates, location, event URL, year, and artwork from the archive.

## Provenance Model

For current claims:

1. Prove ownership from live POAP API or POAP contracts when possible.
2. Use archive metadata only as a fallback/enrichment source.
3. Mint POMP with normal POAP provenance tags plus archive-derived artwork if live artwork is missing.

For future disaster recovery:

1. If live contracts/RPCs become unavailable, use `tokens.owner_address` from the archive as a clearly marked snapshot claim source.
2. Tag those POMPs with `POAP-Archive-Snapshot` and make the UI show that the claim is archive-snapshot based, not live-chain verified.

Snapshot claims should be a separate mode so users can tell the difference between live ownership verification and archive recovery.

## Public Launch Checklist

- Keep live POAP and on-chain fallback enabled.
- Configure archive env vars only on servers that have the extracted ZIP mounted.
- Confirm `sqlite3` is available in the deployment image.
- Test `/api/poap/archive?dropId=228100`.
- Test `/api/poap/artwork?dropId=228100`.
- Claim a POAP whose live metadata has missing dates or artwork and confirm the POMP form is populated from archive fallback.
