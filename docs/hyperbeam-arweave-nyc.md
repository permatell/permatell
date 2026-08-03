# arweave.nyc HyperBEAM Notes

Permatell can write through any HyperBEAM node, but the write URL, scheduler,
and authority must belong to the same node/operator setup.

## Current Stable App Settings

These match the Portal production write path used by StreamVault:

```env
NEXT_PUBLIC_AO_WRITE_URL=https://hb.portalinto.com
NEXT_PUBLIC_AO_MAINNET_SCHEDULER=n_XZJhUnmldNFo4dhajoPZWhBXuJk-OcQr5JQ49c4Zo
NEXT_PUBLIC_AO_MAINNET_AUTHORITY=a5ZMUKbGClAsKzB4SHDYrwkOZZHIIfpbaxrmKwUHCe8
NEXT_PUBLIC_AO_MAINNET_SCHEDULER_DEVICE=scheduler@1.0
```

Do not mix Portal's scheduler or authority with `https://arweave.nyc`.

## arweave.nyc Switch-Over

Before pointing Permatell writes at `arweave.nyc`, the scheduler, authority,
and write URL must all belong to the node. The current observed node address is
usable as the first local scheduler/authority candidate because the node reports
`process-workers=true` and `scheduling-mode=local_confirmation`:

```env
NEXT_PUBLIC_AO_WRITE_URL=https://arweave.nyc
NEXT_PUBLIC_AO_MAINNET_SCHEDULER=8VtduyebKx2aJhlg5pIKzvB9Pb6gvTINcTXszCEtKKI
NEXT_PUBLIC_AO_MAINNET_AUTHORITY=8VtduyebKx2aJhlg5pIKzvB9Pb6gvTINcTXszCEtKKI
NEXT_PUBLIC_AO_MAINNET_SCHEDULER_DEVICE=scheduler@1.0
```

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

Story state is also published with `patch@1.0` from the Lua process so it can
be exposed through HyperBEAM HTTP state paths instead of old dry-run reads.
