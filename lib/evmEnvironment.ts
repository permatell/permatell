"use client";

/**
 * Detects whether the current browser can realistically complete an EVM wallet
 * connection.
 *
 * The motivating case is the Wander mobile app, whose in-app browser is a React
 * Native WebView. Wander is an Arweave/AO wallet: it injects
 * `window.arweaveWallet` but never `window.ethereum`, so there is no injected
 * EVM provider to fall back on. WalletConnect cannot rescue that either --
 * mobile operating systems block WebViews from navigating to the custom URL
 * schemes and intent URLs that wallet deep links rely on, unless the host app
 * explicitly intercepts them, and the QR flow is useless when the code and the
 * wallet live on the same screen.
 *
 * Detection is only used to reorder and annotate the UI. Connecting is never
 * hard-blocked on it, because user agent sniffing is inherently unreliable and
 * a wrong guess must not leave a user without a working button.
 */

export type EvmConnectCapability = "injected" | "walletconnect" | "unavailable";

export interface EvmBrowserEnvironment {
  /** False until the first client-side detection runs, so SSR stays stable. */
  ready: boolean;
  isMobile: boolean;
  isInAppBrowser: boolean;
  isWanderInApp: boolean;
  hasInjectedProvider: boolean;
  hasWalletConnectProjectId: boolean;
  capability: EvmConnectCapability;
  /** Short explanation shown to the user when `capability` is "unavailable". */
  unavailableReason: string;
}

export const INITIAL_EVM_ENVIRONMENT: EvmBrowserEnvironment = {
  ready: false,
  isMobile: false,
  isInAppBrowser: false,
  isWanderInApp: false,
  hasInjectedProvider: false,
  hasWalletConnectProjectId: false,
  capability: "unavailable",
  unavailableReason: "",
};

function hasWalletConnectProjectId(): boolean {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  return Boolean(projectId && projectId !== "YOUR_PROJECT_ID");
}

export function detectEvmEnvironment(): EvmBrowserEnvironment {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return INITIAL_EVM_ENVIRONMENT;
  }

  const anyWindow = window as any;
  const userAgent = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isMobile = isIos || isAndroid || /Mobile|Silk/i.test(userAgent);

  // React Native WebView injects this bridge object into every page it loads,
  // which makes it the most reliable in-app browser signal for Wander mobile.
  const isReactNativeWebView =
    typeof anyWindow.ReactNativeWebView !== "undefined";
  // Android System WebView appends the "; wv)" token to its user agent.
  const isAndroidWebView = isAndroid && /;\s*wv\)/i.test(userAgent);
  // Mobile Safari always sends a "Safari/" token; WKWebView omits it.
  const isIosWebView = isIos && !/Safari\//i.test(userAgent);
  const advertisesWander = /\bWander\b/i.test(userAgent);

  const isInAppBrowser =
    isReactNativeWebView ||
    isAndroidWebView ||
    isIosWebView ||
    (isMobile && advertisesWander);

  const arweaveWallet = anyWindow.arweaveWallet;
  const walletName = String(arweaveWallet?.walletName || "");
  const looksLikeWander =
    advertisesWander || /wander|arconnect/i.test(walletName);
  const isWanderInApp =
    isInAppBrowser && isMobile && (Boolean(arweaveWallet) || looksLikeWander);

  const hasInjectedProvider = Boolean(anyWindow.ethereum);
  const projectIdConfigured = hasWalletConnectProjectId();

  let capability: EvmConnectCapability = "unavailable";
  let unavailableReason = "";

  if (hasInjectedProvider) {
    capability = "injected";
  } else if (projectIdConfigured && !isInAppBrowser) {
    capability = "walletconnect";
  } else if (isInAppBrowser) {
    unavailableReason = isWanderInApp
      ? "The Wander app's built-in browser is an Arweave wallet, so it does not provide an Ethereum wallet, and mobile in-app browsers are not allowed to hand off to wallet apps."
      : "This in-app browser does not provide an Ethereum wallet, and mobile in-app browsers are not allowed to hand off to wallet apps.";
  } else if (!projectIdConfigured) {
    unavailableReason =
      "No Ethereum wallet was detected in this browser, and WalletConnect is not configured for this deployment.";
  } else {
    unavailableReason = "No Ethereum wallet was detected in this browser.";
  }

  return {
    ready: true,
    isMobile,
    isInAppBrowser,
    isWanderInApp,
    hasInjectedProvider,
    hasWalletConnectProjectId: projectIdConfigured,
    capability,
    unavailableReason,
  };
}
