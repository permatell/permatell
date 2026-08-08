"use client";

/**
 * Shared access to whatever EIP-1193 provider the current browser injects.
 *
 * This lives outside `EvmWalletContext` because the standalone proof signing
 * page (`/pomp/sign`) needs the same discovery without pulling in the whole
 * wallet context: that page is opened inside another wallet's in-app browser,
 * where the only thing available is the injected provider.
 */

export type Eip1193Provider = {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  providers?: Eip1193Provider[];
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isPhantom?: boolean;
  selectedAddress?: string;
  chainId?: string;
};

export function getInjectedEvmProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const injected = window.ethereum as Eip1193Provider | undefined;
  if (!injected) return null;

  const providers = Array.isArray(injected.providers)
    ? injected.providers
    : [injected];

  return (
    providers.find((provider) => provider.isMetaMask) ||
    providers.find((provider) => provider.isRabby) ||
    providers.find((provider) => provider.isCoinbaseWallet) ||
    providers.find((provider) => provider.isBraveWallet) ||
    providers.find(
      (provider) => provider.isPhantom && typeof provider.request === "function"
    ) ||
    providers.find((provider) => typeof provider.request === "function") ||
    null
  );
}
