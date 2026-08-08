"use client";

import { getAddress, isAddress, recoverMessageAddress } from "viem";

/**
 * Proof that a user controls an EVM address, used to authorise POMP minting.
 *
 * Minting a POMP never needs an EVM transaction: POAP ownership is read with
 * `ownerOf` and the asset itself is signed by the Arweave wallet. That makes an
 * address alone enough to *look up* a collection, but not enough to *claim*
 * from it -- without a control check, anyone could type a stranger's address,
 * pass the on-chain ownership read, and mint that stranger's POAP as a POMP
 * (which is permanent, and first claim wins).
 *
 * There are two ways to prove control:
 *
 *  1. A live provider connection (`eth_requestAccounts`). This is the desktop
 *     path and needs no extra step.
 *  2. An EIP-191 signature over the message below, carried in from another
 *     browser. This is what makes minting possible from a mobile in-app
 *     browser that has no EVM provider: the user signs at `/pomp/sign` inside
 *     MetaMask's own in-app browser, where a provider does exist, and the
 *     signature travels back over the system clipboard.
 *
 * For (2) to work across two separate browser sessions, the signed message has
 * to be reproducible on both sides without any shared state, so it is derived
 * purely from the address and a UTC month. The month bucket also expires the
 * proof without needing a server-side nonce.
 *
 * Known limitation: because the message has no per-session nonce, a signature
 * that leaks could be replayed by someone else to claim POMPs for that
 * address's POAPs. The signature is never transmitted off the device by this
 * app, and the resulting asset still lands in the attacker's own Arweave
 * wallet, so this is a much smaller hole than accepting a bare typed address.
 */

export const EVM_PROOF_VERSION = "1";

/**
 * How many month buckets back a signature stays valid for.
 *
 * This was one month, which meant every mobile user had to redo the whole
 * cross-app signing trip every few weeks -- sometimes days after doing it,
 * if they happened to sign near a month boundary. Widening the window trades
 * a longer replay life for a proof that is taken roughly once a year.
 *
 * The trade is deliberately lopsided in favour of usability because the
 * damage a replayed proof can do is bounded and does not grow with time: it
 * lets someone mint a POMP for a POAP that address holds, into their own
 * Arweave wallet. It moves no funds and cannot touch the EVM account. A claim
 * is permanent whenever it happens, so a shorter window would not undo an
 * attack, only shift when it could start.
 */
const PROOF_VALIDITY_MONTHS = 12;

/**
 * Deliberately a constant rather than `window.location.host`: PermaTell is
 * served from several Arweave gateways and ArNS names, and the message has to
 * hash identically no matter which host the user signed on.
 */
const EVM_PROOF_DOMAIN = "permatell";

const PROOF_STORAGE_KEY = "permatell_evm_address_proofs";

/**
 * A stored signature proof. A live wallet connection is proof too, but it is
 * never written here: the connected address is checked directly, so closing the
 * session correctly withdraws the authorisation.
 */
export interface EvmAddressProof {
  address: string;
  message: string;
  signature: string;
  period: string;
  verifiedAt: number;
}

function periodKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function currentProofPeriod(now = new Date()): string {
  return periodKey(now);
}

export function acceptedProofPeriods(now = new Date()): string[] {
  const periods: string[] = [];
  for (let monthsBack = 0; monthsBack < PROOF_VALIDITY_MONTHS; monthsBack += 1) {
    periods.push(
      periodKey(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1))
      )
    );
  }
  return periods;
}

export function buildEvmOwnershipMessage(
  address: string,
  period = currentProofPeriod()
): string {
  const checksummed = getAddress(address);
  return [
    "PermaTell POMP — proof of EVM address control",
    "",
    "I control this Ethereum address and authorise PermaTell to mint POMP",
    "atomic assets for the POAPs it holds. This signature is a proof of",
    "ownership only. It does not approve any transaction, transfer or spend.",
    "",
    `Address: ${checksummed}`,
    `Domain: ${EVM_PROOF_DOMAIN}`,
    `Period: ${period}`,
    `Version: ${EVM_PROOF_VERSION}`,
  ].join("\n");
}

export interface VerifiedEvmProof {
  address: string;
  message: string;
  period: string;
  /** The pasted signature reduced to its canonical `0x…` form. */
  signature: string;
}

/**
 * Pulls a usable 65-byte signature out of whatever the user managed to paste.
 *
 * The signature makes its journey between two apps through the system
 * clipboard, so what arrives is regularly not a bare hex string: mobile
 * selection handles pick up surrounding label text, wallets and chat apps
 * insert line breaks into the 132-character run, and "smart" quotes get
 * wrapped around it. All of that is recoverable, and rejecting it just sends
 * the user back through the whole cross-app trip for no reason.
 *
 * Truncation is the one case that is *not* recoverable, so it is reported
 * separately -- a half-copied signature is by far the most common mistake and
 * "that is not a signature" is unhelpful advice when the real problem is that
 * the user needs to select all of it.
 */
export function normalizeEvmSignature(raw: string): string {
  const compact = (raw || "").replace(/\s+/g, "");
  if (!compact) {
    throw new Error("Paste the signature your wallet produced.");
  }

  const full = compact.match(/(?:0x)?([0-9a-fA-F]{130})(?![0-9a-fA-F])/);
  if (!full) {
    const longestRun = (compact.match(/[0-9a-fA-F]{8,}/g) || []).reduce(
      (longest, run) => (run.length > longest.length ? run : longest),
      ""
    );
    if (longestRun && longestRun.length < 130) {
      throw new Error(
        `That signature is incomplete — it has ${longestRun.length} of the 130 characters. Go back and use the Copy signature button so the whole value is selected.`
      );
    }
    throw new Error(
      "That does not look like a wallet signature. Paste the full 0x… value your wallet produced."
    );
  }

  const body = full[1].toLowerCase();
  // Some wallets report the recovery id as 0/1 rather than 27/28. viem only
  // accepts the latter, so normalise it rather than failing a valid proof.
  const recoveryId = parseInt(body.slice(128), 16);
  const normalizedRecoveryId =
    recoveryId === 0 || recoveryId === 1 ? recoveryId + 27 : recoveryId;

  return `0x${body.slice(0, 128)}${normalizedRecoveryId
    .toString(16)
    .padStart(2, "0")}`;
}

/**
 * Recovers the signer for each still-valid period and returns the first that
 * matches the claimed address. Recovery only covers externally owned accounts;
 * smart contract wallets have to use the live connection path instead.
 */
export async function verifyEvmOwnershipSignature(input: {
  address: string;
  signature: string;
  now?: Date;
}): Promise<VerifiedEvmProof> {
  const rawAddress = input.address.trim();
  if (!isAddress(rawAddress)) {
    throw new Error("Enter a valid EVM address before adding a signature.");
  }
  const address = getAddress(rawAddress);

  const signature = normalizeEvmSignature(input.signature);

  for (const period of acceptedProofPeriods(input.now)) {
    const message = buildEvmOwnershipMessage(address, period);
    let recovered: string;
    try {
      recovered = await recoverMessageAddress({
        message,
        signature: signature as `0x${string}`,
      });
    } catch {
      continue;
    }
    if (recovered.toLowerCase() === address.toLowerCase()) {
      return { address, message, period, signature };
    }
  }

  throw new Error(
    "That signature does not match this address. Make sure you signed with the same wallet you are claiming for, and that the proof was made in the last year."
  );
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function readEvmProofs(): Record<string, EvmAddressProof> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(
      localStorage.getItem(PROOF_STORAGE_KEY) || "{}"
    ) as Record<string, EvmAddressProof>;
    if (!parsed || typeof parsed !== "object") return {};
    const valid = acceptedProofPeriods();
    const out: Record<string, EvmAddressProof> = {};
    for (const [key, proof] of Object.entries(parsed)) {
      if (proof?.address && valid.includes(proof.period)) out[key] = proof;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeEvmProofs(proofs: Record<string, EvmAddressProof>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROOF_STORAGE_KEY, JSON.stringify(proofs));
  } catch {
    // Storage can be unavailable in private modes; proofs stay in memory.
  }
}

export function proofKey(address: string): string {
  return address.trim().toLowerCase();
}
