"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { getAddress, isAddress, toHex } from "viem";
import {
  ArrowLeft,
  Check,
  Copy,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEvmWallet } from "@/contexts/EvmWalletContext";
import { getInjectedEvmProvider } from "@/lib/evmProvider";
import {
  buildEvmOwnershipMessage,
  verifyEvmOwnershipSignature,
} from "@/lib/evmProof";
import { metamaskDappLink, proofSigningUrl } from "@/lib/metamaskHandoff";

/**
 * Standalone page for producing an EVM proof of address control.
 *
 * It exists so the signature can be made somewhere a wallet actually lives --
 * in practice MetaMask's own in-app browser, reached from the POMP pages by
 * deep link. Everything on this page is deliberately self-contained: it never
 * needs an Arweave wallet, a POAP lookup or any of the POMP state, because the
 * browser it runs in is usually not the browser the user will claim from.
 *
 * The output travels back over the system clipboard, so the page's real job
 * after signing is to make the value impossible to mis-copy.
 */

function shortAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function ProofSigner() {
  const searchParams = useSearchParams();
  const { addPastedOwnershipProof } = useEvmWallet();

  const [address, setAddress] = useState("");
  const [addressDraft, setAddressDraft] = useState("");
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const requested = (searchParams.get("address") || "").trim();
    if (requested && isAddress(requested)) {
      const checksummed = getAddress(requested);
      setAddress(checksummed);
      setAddressDraft(checksummed);
    }
  }, [searchParams]);

  useEffect(() => {
    const detect = () => setHasProvider(Boolean(getInjectedEvmProvider()));
    detect();
    // Some in-app browsers inject the provider a beat after first paint.
    const timer = window.setTimeout(detect, 800);
    window.addEventListener("ethereum#initialized", detect);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("ethereum#initialized", detect);
    };
  }, []);

  const message = useMemo(
    () => (address ? buildEvmOwnershipMessage(address) : ""),
    [address]
  );

  const copySignature = useCallback(async () => {
    if (!signature) return;
    try {
      await navigator.clipboard.writeText(signature);
      setCopied(true);
      toast.success("Signature copied.");
    } catch {
      toast.error(
        "Copying was blocked. Press and hold the signature above to select and copy it."
      );
    }
  }, [signature]);

  const handleSign = async () => {
    setError("");
    const provider = getInjectedEvmProvider();
    if (!provider?.request) {
      setHasProvider(false);
      return;
    }

    setSigning(true);
    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts?.length) {
        throw new Error("No account was shared by the wallet.");
      }

      // When the POMP page asked for a specific address, that is the only one
      // worth signing with: a proof from any other account verifies fine and
      // then silently fails to unlock the claim the user came here for.
      const wanted = address;
      const match = wanted
        ? accounts.find(
            (account) => account.toLowerCase() === wanted.toLowerCase()
          )
        : accounts[0];
      if (!match) {
        throw new Error(
          `This wallet is unlocked on ${shortAddress(
            getAddress(accounts[0])
          )}, but the proof is for ${shortAddress(
            wanted
          )}. Switch accounts in your wallet and try again.`
        );
      }

      const signer = getAddress(match);
      if (!wanted) setAddress(signer);
      const proofMessage = buildEvmOwnershipMessage(signer);

      const produced = (await provider.request({
        method: "personal_sign",
        params: [toHex(proofMessage), signer.toLowerCase()],
      })) as string;

      const verified = await verifyEvmOwnershipSignature({
        address: signer,
        signature: produced,
      });

      setSignature(verified.signature);
      // Harmless when this browser is not the one that will claim, and it
      // saves a round trip when it is (desktop signing for desktop claiming).
      await addPastedOwnershipProof(signer, verified.signature).catch(
        () => undefined
      );

      try {
        await navigator.clipboard.writeText(verified.signature);
        setCopied(true);
      } catch {
        setCopied(false);
      }
      toast.success("Proof signed.");
    } catch (caught: any) {
      const detail =
        caught?.code === 4001
          ? "You rejected the signature request."
          : caught?.message || "The wallet could not sign the proof.";
      setError(detail);
      toast.error(detail);
    } finally {
      setSigning(false);
    }
  };

  const applyAddressDraft = () => {
    const value = addressDraft.trim();
    if (!isAddress(value)) {
      setError("Enter a valid 0x… address.");
      return;
    }
    setError("");
    setSignature("");
    setAddress(getAddress(value));
  };

  const metamaskLink = metamaskDappLink(proofSigningUrl(address));

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Image
          src="/pomp-logo.png"
          alt="POMP logo"
          width={48}
          height={48}
          className="h-12 w-12"
        />
        <div>
          <h1 className="text-2xl font-bold text-white">Prove address control</h1>
          <p className="text-sm text-gray-400">
            One signature, so PermaTell knows the POAPs are yours to claim.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/5 p-4">
        <p className="text-sm text-gray-300">
          This signs a plain text message. It approves no transaction, moves no
          funds, and costs no gas.
        </p>

        {!address && (
          <div className="mt-4">
            <Input
              label="EVM address to prove"
              value={addressDraft}
              onChange={(event) => setAddressDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyAddressDraft();
                }
              }}
              placeholder="0x…"
              className="border-gray-800 bg-black/40 font-mono"
            />
            <Button
              type="button"
              onClick={applyAddressDraft}
              className="mt-3 h-10 border border-emerald-400/35 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20"
            >
              Use this address
            </Button>
            <p className="mt-3 text-xs text-gray-500">
              Leave it blank and connect instead if you would rather let the
              wallet choose the account.
            </p>
          </div>
        )}

        {address && (
          <p className="mt-3 font-mono text-sm text-emerald-100">{address}</p>
        )}
      </div>

      {hasProvider === false && (
        <div className="mt-5 rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-4">
          <div className="flex items-start gap-2">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-white">
                No Ethereum wallet in this browser
              </p>
              <p className="mt-1">
                Open this same page inside your wallet&apos;s browser, where it
                can sign for you.
              </p>
              <a
                href={metamaskLink}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-cyan-400/35 bg-cyan-500/15 px-4 text-sm font-medium text-cyan-100 hover:bg-cyan-500/25"
              >
                <Wallet className="h-4 w-4" />
                Open in MetaMask
              </a>
              <p className="mt-3 text-xs text-gray-500">
                Nothing happened? Copy this page&apos;s address from the URL
                bar, open MetaMask, and paste it into the Browser tab.
              </p>
            </div>
          </div>
        </div>
      )}

      {address && !signature && hasProvider !== false && (
        <Button
          type="button"
          onClick={handleSign}
          disabled={signing}
          className="mt-5 h-12 w-full gap-2 bg-emerald-500 text-base text-white hover:bg-emerald-600"
        >
          <ShieldCheck className="h-5 w-5" />
          {signing ? "Waiting for your wallet…" : "Sign the proof"}
        </Button>
      )}

      {error && (
        <p className="mt-4 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          {error}
        </p>
      )}

      {signature && (
        <div className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-300" />
            <p className="font-medium text-white">
              Signed for {shortAddress(address)}
            </p>
          </div>
          <p className="mt-2 text-sm text-emerald-100/80">
            {copied
              ? "The signature is already on your clipboard."
              : "Copy the signature below."}{" "}
            Switch back to the PermaTell tab in your Arweave wallet&apos;s
            browser and tap <strong>Paste signature</strong>.
          </p>
          <pre className="mt-3 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded border border-emerald-400/20 bg-black/50 p-2 font-mono text-[11px] text-emerald-100">
            {signature}
          </pre>
          <Button
            type="button"
            onClick={copySignature}
            className="mt-3 h-11 w-full gap-2 border border-emerald-400/35 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25"
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copy signature again" : "Copy signature"}
          </Button>
          <p className="mt-3 text-xs text-emerald-100/60">
            Valid for a year. Treat it like a password: anyone holding it could
            claim POMPs for this address&apos;s POAPs.
          </p>
        </div>
      )}

      {message && (
        <details className="mt-5 rounded-lg border border-gray-800 bg-black/30 p-3">
          <summary className="cursor-pointer text-sm text-gray-300">
            Show the exact message being signed
          </summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-gray-400">
            {message}
          </pre>
        </details>
      )}

      <Link
        href="/pomp"
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-cyan-300 hover:text-cyan-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to POMP
      </Link>
    </div>
  );
}

export default function ProofSigningPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto max-w-2xl px-4 py-8 text-gray-400">
          Loading the proof signer…
        </div>
      }
    >
      <ProofSigner />
    </Suspense>
  );
}
