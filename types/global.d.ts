/**
 * Global type augmentations for PermaTell
 */

// Extend Window to include Ethereum provider (MetaMask, etc.)
interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on: (event: string, handler: (...args: any[]) => void) => void;
    removeListener: (event: string, handler: (...args: any[]) => void) => void;
    selectedAddress?: string;
    chainId?: string;
  };
  arweaveWallet?: {
    connect: (
      permissions: string[],
      appInfo?: { name?: string; logo?: string },
      gateway?: { host: string; port: number; protocol: "http" | "https" }
    ) => Promise<void>;
    disconnect?: () => Promise<void>;
    getActiveAddress: () => Promise<string>;
    sign: (transaction: unknown) => Promise<void>;
    signDataItem?: (dataItem: {
      data: Uint8Array | string;
      target?: string;
      anchor?: string;
      tags?: { name: string; value: string }[];
    }) => Promise<Uint8Array>;
    dispatch?: (transaction: unknown) => Promise<{ id: string; type?: string }>;
  };
  wanderInstance?: any;
}

// Module declarations for packages without types
declare module "@permaweb/libs" {
  const libs: any;
  export default libs;
}
