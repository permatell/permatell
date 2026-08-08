"use client";

/**
 * Handing the proof-signing page to the MetaMask app on the same phone.
 *
 * Background: a phone browser has no wallet extension, and an in-app browser
 * like Wander's has no EVM provider at all. WalletConnect does not fix this
 * from inside a WebView -- Reown document that in-app browsers are sandboxed
 * and cannot launch a wallet app through the `metamask://` style custom
 * schemes their deep links rely on, and a QR code is useless when the code and
 * the wallet are on the same screen.
 *
 * What *is* available is the other direction: rather than pulling the wallet
 * into this page, push the page into the wallet. MetaMask publishes a deep
 * link that opens an arbitrary URL inside its own in-app browser, where
 * `window.ethereum` is injected normally and signing is an ordinary one-tap
 * approval:
 *
 *   https://link.metamask.io/dapp/{host}{path}
 *   https://docs.metamask.io/metamask-connect/evm/guides/metamask-exclusive/use-deeplinks/
 *
 * The important detail is that this is an `https` universal link, not a custom
 * scheme, and it must be reached by an actual user tap on an anchor. Apple's
 * rule for universal links is that iOS opens the associated app when the user
 * taps the link inside a WKWebView, but loads it as a web page when the page
 * navigates there programmatically -- so `window.location = …` is precisely
 * the thing that does not work here, and a plain `<a href>` is what does.
 *
 * Android WebViews do not honour app links at all, so the tap may just load
 * MetaMask's web landing page. That page offers its own "open the app" route,
 * and every caller here also exposes a copy-the-link fallback, so the flow
 * degrades to "paste this into MetaMask's browser" rather than dead-ending.
 */

export const PROOF_SIGNING_PATH = "/pomp/sign";

/**
 * Absolute URL of the signing page for one address.
 *
 * The address is carried so the signing page can build the exact message for
 * it and warn when MetaMask is unlocked on a different account, which is the
 * mistake that otherwise produces a valid signature that verifies against the
 * wrong address.
 */
export function proofSigningUrl(address: string, origin?: string): string {
  const base =
    origin || (typeof window === "undefined" ? "" : window.location.origin);
  const query = address ? `?address=${encodeURIComponent(address)}` : "";
  return `${base}${PROOF_SIGNING_PATH}${query}`;
}

/**
 * Wraps a URL in MetaMask's in-app browser deep link.
 *
 * The target is appended unencoded: MetaMask treats everything after `/dapp/`
 * as the destination URL, so percent-encoding it would break the path.
 */
export function metamaskDappLink(url: string): string {
  return `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//i, "")}`;
}
