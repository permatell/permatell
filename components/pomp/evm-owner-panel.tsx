"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ClipboardPaste,
  Copy,
  Eye,
  Link2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEvmWallet } from "@/contexts/EvmWalletContext";
import { metamaskDappLink, proofSigningUrl } from "@/lib/metamaskHandoff";

function shortAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  } catch {
    toast.error(`Unable to copy the ${label.toLowerCase()}. Select it manually.`);
  }
}

/**
 * Owner-address controls shared by the POMP pages.
 *
 * There are two distinct capabilities here and the UI keeps them separate on
 * purpose:
 *
 *  - Browsing a collection only needs an address, so it works in any browser,
 *    including the Wander mobile in-app browser where no EVM provider exists.
 *  - Minting a POMP needs proof that the user controls that address, which is
 *    either a live wallet connection or a signature.
 *
 * On desktop the connection covers both and nothing extra is shown. On a phone
 * there is no wallet in this browser at all, so the panel walks the user out to
 * the MetaMask app and back: see `lib/metamaskHandoff.ts` for why that is the
 * shape of the flow rather than a WalletConnect modal.
 */
export function EvmOwnerPanel({ className = "" }: { className?: string }) {
  const {
    evmAddress,
    connectEvm,
    evmEnvironment,
    poapOwnerAddress,
    setPoapOwnerAddress,
    resolveOwnerAddress,
    isAddressProven,
    ownershipMessageFor,
    signOwnershipProof,
    addPastedOwnershipProof,
  } = useEvmWallet();

  const [draft, setDraft] = useState(poapOwnerAddress || "");
  const [resolving, setResolving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [signing, setSigning] = useState(false);
  const [verifyingProof, setVerifyingProof] = useState(false);
  const [signature, setSignature] = useState("");
  const [pastedSignature, setPastedSignature] = useState("");
  const [showManualProof, setShowManualProof] = useState(false);
  const [showPortablePanel, setShowPortablePanel] = useState(false);
  const [handoffStarted, setHandoffStarted] = useState(false);

  useEffect(() => {
    setDraft(poapOwnerAddress || "");
  }, [poapOwnerAddress]);

  const proven = isAddressProven(poapOwnerAddress);
  const noProvider =
    evmEnvironment.ready && evmEnvironment.capability === "unavailable";
  const canHandOffToApp = evmEnvironment.handoff === "metamask-app";
  const ownerIsConnectedWallet = Boolean(
    poapOwnerAddress &&
      evmAddress &&
      poapOwnerAddress.toLowerCase() === evmAddress.toLowerCase()
  );
  const proofMessage = useMemo(
    () => (poapOwnerAddress ? ownershipMessageFor(poapOwnerAddress) : ""),
    [ownershipMessageFor, poapOwnerAddress]
  );
  const signingUrl = useMemo(
    () => (poapOwnerAddress ? proofSigningUrl(poapOwnerAddress) : ""),
    [poapOwnerAddress]
  );

  const acceptSignature = useCallback(
    async (value: string) => {
      if (!poapOwnerAddress) {
        toast.error("Set the EVM address first.");
        return;
      }
      setVerifyingProof(true);
      try {
        await addPastedOwnershipProof(poapOwnerAddress, value);
        setPastedSignature("");
        setHandoffStarted(false);
        toast.success("Address control verified. You can now claim POMPs.");
      } catch (error: any) {
        toast.error(error?.message || "Unable to verify that signature.");
      } finally {
        setVerifyingProof(false);
      }
    },
    [addPastedOwnershipProof, poapOwnerAddress]
  );

  // Coming back from the wallet app is the moment the signature is sitting on
  // the clipboard, so nudge towards the one remaining tap instead of leaving
  // the user to find it. Reading the clipboard here would need a gesture the
  // page does not have, hence a prompt rather than an automatic paste.
  useEffect(() => {
    if (!handoffStarted || proven) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      toast.message("Back from your wallet? Tap “Paste signature” to finish.");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [handoffStarted, proven]);

  const applyDraft = async () => {
    const value = draft.trim();
    if (!value) {
      setPoapOwnerAddress(null);
      return;
    }
    setResolving(true);
    try {
      const resolved = await resolveOwnerAddress(value);
      setPoapOwnerAddress(resolved);
      toast.success(`Using ${shortAddress(resolved)} for POAP lookups.`);
    } catch (error: any) {
      toast.error(error?.message || "Unable to resolve that address.");
    } finally {
      setResolving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const connected = await connectEvm();
      if (connected) toast.success("EVM wallet connected.");
      else toast.error("Unable to connect EVM wallet.");
    } catch (error: any) {
      toast.error(error?.message || "Unable to connect EVM wallet.");
    } finally {
      setConnecting(false);
    }
  };

  const handleSignProof = async () => {
    if (!poapOwnerAddress) return;
    setSigning(true);
    try {
      const produced = await signOwnershipProof(poapOwnerAddress);
      setSignature(produced);
      toast.success("Ownership proof signed. Copy it to use on another device.");
    } catch (error: any) {
      toast.error(error?.message || "Unable to sign the ownership proof.");
    } finally {
      setSigning(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clipboard = await navigator.clipboard.readText();
      if (!clipboard.trim()) {
        toast.error("The clipboard is empty. Copy the signature first.");
        return;
      }
      await acceptSignature(clipboard);
    } catch {
      setShowManualProof(true);
      toast.error(
        "This browser will not let the page read the clipboard. Paste into the box below instead."
      );
    }
  };

  return (
    <div
      className={`rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="POAP owner address"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void applyDraft();
              }
            }}
            placeholder="0x… or yourname.eth"
            className="border-gray-800 bg-black/40"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={applyDraft}
            disabled={resolving || draft.trim() === (poapOwnerAddress || "")}
            className="h-10 border border-emerald-400/35 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20"
          >
            {resolving ? "Resolving..." : "Use address"}
          </Button>
          {!noProvider && (
            <Button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="h-10 gap-2 bg-emerald-500 text-white hover:bg-emerald-600"
            >
              <Wallet className="h-4 w-4" />
              {connecting ? "Connecting..." : evmAddress ? "Switch" : "Connect"}
            </Button>
          )}
        </div>
      </div>

      {poapOwnerAddress && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {proven ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1 text-emerald-100">
              <ShieldCheck className="h-4 w-4" />
              Control verified — you can claim POMPs
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-amber-100">
              <Eye className="h-4 w-4" />
              View only — proof needed before claiming
            </span>
          )}
          <span className="font-mono text-xs text-gray-400">
            {poapOwnerAddress}
          </span>
        </div>
      )}

      {noProvider && !proven && (
        <div className="mt-4 rounded-md border border-cyan-400/25 bg-cyan-400/5 p-3">
          <div className="flex items-start gap-2">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <div className="flex-1 text-sm text-gray-300">
              <p className="font-medium text-white">
                No Ethereum wallet in this browser
              </p>
              <p className="mt-1">{evmEnvironment.unavailableReason}</p>

              {!poapOwnerAddress ? (
                <p className="mt-2">
                  Enter your address above to browse your POAPs. Claiming one as
                  a POMP needs a one-time proof that the address is yours, and
                  this panel will walk you through it once an address is set.
                </p>
              ) : canHandOffToApp ? (
                <>
                  <p className="mt-2">
                    Your Arweave wallet still signs the POMP, so stay here for
                    the claim. You only need to step out once, to prove{" "}
                    {shortAddress(poapOwnerAddress)} is yours.
                  </p>
                  <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-gray-300">
                    <li>Tap the button below to open MetaMask.</li>
                    <li>Tap “Sign the proof” and approve it. Nothing is spent.</li>
                    <li>Switch back here and tap “Paste signature”.</li>
                  </ol>
                  <a
                    href={metamaskDappLink(signingUrl)}
                    onClick={() => setHandoffStarted(true)}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-medium text-white hover:bg-emerald-600"
                  >
                    <Wallet className="h-4 w-4" />
                    Sign with MetaMask on this phone
                  </a>
                  <Button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    disabled={verifyingProof}
                    className={`mt-2 h-11 w-full gap-2 border text-sm ${
                      handoffStarted
                        ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-50"
                        : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                    } hover:bg-emerald-400/25`}
                  >
                    <ClipboardPaste className="h-4 w-4" />
                    {verifyingProof ? "Verifying..." : "Paste signature"}
                  </Button>
                  <div className="mt-3 rounded border border-gray-800 bg-black/25 p-2.5">
                    <p className="text-xs font-medium text-gray-200">
                      MetaMask did not open?
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Some in-app browsers block app links. Copy the signing
                      link, open MetaMask yourself, and paste it into its
                      Browser tab.
                    </p>
                    <Button
                      type="button"
                      onClick={() => copyText(signingUrl, "Signing link")}
                      className="mt-2 h-8 gap-1.5 border border-gray-700 bg-gray-900 px-3 text-xs text-gray-100 hover:bg-gray-800"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Copy signing link
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-2">
                  Install a wallet extension and reload, or open the signing
                  page on a device where your wallet works and bring the
                  signature back with the manual option below.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {poapOwnerAddress && !proven && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowManualProof((current) => !current)}
            className="inline-flex items-center gap-1.5 text-sm text-cyan-300 hover:text-cyan-200"
          >
            <ShieldAlert className="h-4 w-4" />
            {showManualProof
              ? "Hide manual proof"
              : canHandOffToApp
              ? "Use a different wallet, or paste a signature by hand"
              : "Prove I control this address"}
          </button>

          {showManualProof && (
            <div className="mt-3 space-y-3 rounded-md border border-gray-800 bg-black/30 p-3">
              <p className="text-sm text-gray-300">
                Sign this exact message with {shortAddress(poapOwnerAddress)} in
                any browser where your EVM wallet works, then paste the
                signature here. Nothing is sent anywhere and no transaction is
                approved.
              </p>
              <div className="rounded border border-gray-800 bg-black/50 p-2">
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-gray-400">
                  {proofMessage}
                </pre>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => copyText(proofMessage, "Proof message")}
                  className="h-8 gap-1.5 border border-gray-700 bg-gray-900 px-3 text-xs text-gray-100 hover:bg-gray-800"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy message
                </Button>
                {signingUrl && (
                  <Button
                    type="button"
                    onClick={() => copyText(signingUrl, "Signing link")}
                    className="h-8 gap-1.5 border border-gray-700 bg-gray-900 px-3 text-xs text-gray-100 hover:bg-gray-800"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Copy signing link
                  </Button>
                )}
              </div>
              <Textarea
                label="Signature"
                value={pastedSignature}
                onChange={(event) => setPastedSignature(event.target.value)}
                placeholder="0x…"
                className="min-h-[80px] border-gray-800 bg-black/40 font-mono text-xs"
              />
              <Button
                type="button"
                onClick={() => acceptSignature(pastedSignature)}
                disabled={verifyingProof || !pastedSignature.trim()}
                className="h-9 w-full border border-emerald-400/35 bg-emerald-400/10 text-sm text-emerald-100 hover:bg-emerald-400/20"
              >
                {verifyingProof ? "Verifying..." : "Verify signature"}
              </Button>
            </div>
          )}
        </div>
      )}

      {ownerIsConnectedWallet && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowPortablePanel((current) => !current)}
            className="inline-flex items-center gap-1.5 text-sm text-cyan-300 hover:text-cyan-200"
          >
            <Smartphone className="h-4 w-4" />
            {showPortablePanel
              ? "Hide portable proof"
              : "Create a proof for the Wander mobile browser"}
          </button>

          {showPortablePanel && (
            <div className="mt-3 space-y-3 rounded-md border border-gray-800 bg-black/30 p-3">
              <p className="text-sm text-gray-300">
                The Wander app&apos;s browser has no Ethereum wallet, so claims
                started there need a signature made here. Sign once, copy the
                result, and paste it into the same panel inside Wander.
              </p>
              <Button
                type="button"
                onClick={handleSignProof}
                disabled={signing}
                className="h-9 w-full gap-1.5 border border-emerald-400/35 bg-emerald-400/10 text-sm text-emerald-100 hover:bg-emerald-400/20"
              >
                <Check className="h-4 w-4" />
                {signing ? "Signing..." : "Sign ownership proof"}
              </Button>
            </div>
          )}
        </div>
      )}

      {signature && (
        <div className="mt-4 rounded-md border border-emerald-400/25 bg-emerald-400/10 p-3">
          <p className="text-sm font-medium text-white">
            Portable ownership proof
          </p>
          <p className="mt-1 text-xs text-emerald-100/75">
            Copy this into the same field in the Wander app&apos;s browser to
            claim POMPs there. It stays valid for a year.
          </p>
          <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded border border-emerald-400/20 bg-black/40 p-2 font-mono text-[11px] text-emerald-100">
            {signature}
          </pre>
          <Button
            type="button"
            onClick={() => copyText(signature, "Signature")}
            className="mt-2 h-8 gap-1.5 border border-emerald-400/30 bg-emerald-400/10 px-3 text-xs text-emerald-100 hover:bg-emerald-400/20"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy signature
          </Button>
        </div>
      )}
    </div>
  );
}
