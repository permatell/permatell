# arweave.nyc HyperBEAM Notes

Permatell can write through any HyperBEAM node, but the write URL, scheduler,
and authority must belong to the same node/operator setup.

## Architecture (Portal-like)

1. **Spawn / hydrate (Node + JWK)** — run once:
   `npm run ao:spawn-mainnet -- --wallet /path/to/jwk.json`
   Prints `NEXT_PUBLIC_MAINNET_STORIES_PROCESS_ID` and
   `NEXT_PUBLIC_MAINNET_STORYPOINTS_PROCESS_ID`.
2. **Browser writes** — Wander/Beacon `createDataItemSigner` via
   `connect({ MODE: "mainnet", URL, SCHEDULER, signer })`. Story body goes in
   message `Data` (not tags). aoconnect hardcodes `/{id}~process@1.0/push`; on
   `app-1.forward.computer` that path is the working write endpoint.
   `~relay@1.0/push` and `~relay@1.0/schedule` hard-404 there — the browser
   fetch wrapper keeps process@1.0/push (at most 2 URL attempts), skips hung
   Portal `/push`, and does not spray relay/schedule fallbacks.
3. **Browser reads** — Discovery lists mainnet per-story processes from a
   hard-coded seed (POMP Story `hJ7Intf…`), localStorage, and Arweave GraphQL
   (`App-Name=PermaTell` + `PermaTell-Asset-Type=story-process`, with
   `Zone-Type=Story` fallback). Each id is hydrated from HyperBEAM
   `/{id}~process@1.0/now` on app-1 (and `/now/story/versions/{n}`). If version
   JSON is missing, `/now` title/creator headers still produce a Discovery card.
   Registry GetStories is still merged when a wallet is present, but create no
   longer depends on `r-tsuNh…` because spawned story processes are not stored
   there. Existing per-story ids still receive edit/upvote on that process. The
   first edit/upvote also Eval-repairs handlers (story-json-v1) so older spawns
   (e.g. POMP Story) persist versions via `story_json` under patch@1.0.
4. **Legacy toggle** — remains available unless `NEXT_PUBLIC_AO_LOCK_NETWORK=true`.

Never commit JWKs or `.env.local`.

## Current Stable App Settings (Portal scheduler + Forward write node)

Portal (`hb.portalinto.com`) is reachable for `GET /~meta@1.0/info`, but Node
`POST /push` spawn currently hangs there. Use Portal's scheduler/authority with
`https://app-1.forward.computer` for spawn/hydrate (and browser writes after
spawn). Browser wallets use ANS-104 DataItem signing against
`~process@1.0/push` on that write node.

```env
NEXT_PUBLIC_AO_MODE=mainnet
NEXT_PUBLIC_AO_WRITE_URL=https://app-1.forward.computer
NEXT_PUBLIC_HYPERBEAM_URL=https://app-1.forward.computer
NEXT_PUBLIC_AO_MAINNET_SCHEDULER=n_XZJhUnmldNFo4dhajoPZWhBXuJk-OcQr5JQ49c4Zo
NEXT_PUBLIC_AO_MAINNET_AUTHORITY=a5ZMUKbGClAsKzB4SHDYrwkOZZHIIfpbaxrmKwUHCe8
NEXT_PUBLIC_AO_MAINNET_SCHEDULER_DEVICE=scheduler@1.0
NEXT_PUBLIC_AO_MAINNET_DEVICE=relay@1.0
NEXT_PUBLIC_AO_MAINNET_MODULE=ISShJH1ij-hPPt9St5UFFr_8Ys3Kj5cyg7zrMGt7H9s
```

After spawn, also set:

```env
NEXT_PUBLIC_MAINNET_STORIES_PROCESS_ID=<from spawn script>
NEXT_PUBLIC_MAINNET_STORYPOINTS_PROCESS_ID=<from spawn script>
```

Do not mix Portal's scheduler or authority with `https://arweave.nyc`.

## Spawn commands

```sh
# Config + node probe only (no wallet)
npm run ao:smoke
npm run ao:spawn-mainnet:dry

# Real spawn (JWK stays on your machine)
npm run ao:spawn-mainnet -- --wallet ~/path/to/arweave-jwk.json
```

If `NEXT_PUBLIC_AO_WRITE_URL` still points at Portal, browser writes now skip
Portal automatically (`getHyperbeamWriteUrl` + fetch wrapper) and use
`https://app-1.forward.computer`. The spawn script also times out Portal
`POST /push` and retries app-1 while keeping the Portal scheduler. Use
`--no-fallback` to disable that spawn fallback.

`.env.local` is first-wins: do not leave Portal URLs above the app-1 lines.

Paste the printed process IDs into Vercel env and redeploy. Prefer the printed
`NEXT_PUBLIC_AO_WRITE_URL` from a successful spawn. Vercel must also set:

```env
NEXT_PUBLIC_AO_MODE=mainnet
NEXT_PUBLIC_AO_WRITE_URL=https://app-1.forward.computer
NEXT_PUBLIC_HYPERBEAM_URL=https://app-1.forward.computer
NEXT_PUBLIC_AO_MAINNET_DEVICE=relay@1.0
NEXT_PUBLIC_AO_MAINNET_SCHEDULER=n_XZJhUnmldNFo4dhajoPZWhBXuJk-OcQr5JQ49c4Zo
NEXT_PUBLIC_AO_MAINNET_AUTHORITY=a5ZMUKbGClAsKzB4SHDYrwkOZZHIIfpbaxrmKwUHCe8
NEXT_PUBLIC_MAINNET_STORIES_PROCESS_ID=r-tsuNhTP6nl4j-Wc9qYV-_1oeTxamVZ1jUe0Nuf90E
NEXT_PUBLIC_MAINNET_STORYPOINTS_PROCESS_ID=hPJ24tP3ws-eIk28UBq8-aQiCOhTnzH3MzjJ_8AzUBk
```

Production is https://permatell.vercel.app. A hashed chunk like
`1396-54bc1c820ac90e19.js` is a stale Vercel build; after redeploy the hash
changes (current production already includes `app-1` + `relay@1.0`). Local
`npm run dev` still needs a restart after `.env.local` changes.

## arweave.nyc Switch-Over

Before pointing Permatell writes at `arweave.nyc`, the scheduler, authority,
and write URL must all belong to the node. The current observed node address is
usable as the first local scheduler/authority candidate because the node reports
`process-workers=true` and `scheduling-mode=local_confirmation`:

```env
NEXT_PUBLIC_AO_WRITE_URL=https://arweave.nyc
NEXT_PUBLIC_HYPERBEAM_URL=https://arweave.nyc
NEXT_PUBLIC_AO_MAINNET_SCHEDULER=8VtduyebKx2aJhlg5pIKzvB9Pb6gvTINcTXszCEtKKI
NEXT_PUBLIC_AO_MAINNET_AUTHORITY=8VtduyebKx2aJhlg5pIKzvB9Pb6gvTINcTXszCEtKKI
NEXT_PUBLIC_AO_MAINNET_SCHEDULER_DEVICE=scheduler@1.0
```

Then re-run the spawn script against that triple and update the mainnet process
IDs. Operator wallets (e.g. `4QbcnRb5…`) are not interchangeable with the node
`address` used as `SCHEDULER` unless the node is configured that way.

The public metadata endpoint currently returns JSON when called with:

```sh
curl -H 'Accept: application/json' https://arweave.nyc/~meta@1.0/info
```

Observed node address:

```text
8VtduyebKx2aJhlg5pIKzvB9Pb6gvTINcTXszCEtKKI
```

Observed relevant flags:

```text
force-signed=true
scheduling-mode=local_confirmation
process-workers=true
store-all-signed=true
compute-mode=lazy
```

## Device Targets

Permatell story processes now advertise:

```text
Device=process@1.0
Scheduler-Device=<NEXT_PUBLIC_AO_MAINNET_SCHEDULER_DEVICE>
```

`scheduler@1.0` remains the default for today's Portal-compatible path.

When `arweave-scheduler@1.0` is available on the write node and the surrounding
AO client path supports it, use:

```env
NEXT_PUBLIC_AO_MAINNET_SCHEDULER_DEVICE=arweave-scheduler@1.0
```

Story state is published with `patch@1.0` from per-story Lua. Nested
`versions["N"]` linked maps are unreliable under HyperBEAM shallow merge
(scalars like `current_version` update, but new version keys / votes often
do not). Handlers therefore also patch a full `story_json` blob (same idea
as POMP campaign `json.encode`), and the browser reads that first via
`/{id}~process@1.0/now/story_json` before falling back to
`/now/story/versions/{n}`.
