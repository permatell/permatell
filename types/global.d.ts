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
  arweaveWallet: any;
  wanderInstance?: any;
}

// Module declarations for packages without types
declare module "@permaweb/libs" {
  const libs: any;
  export default libs;
}
