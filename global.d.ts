declare global {
  interface Window {
    arweaveWallet: {
      connect: (permissions: string[]) => Promise<void>;
      getActiveAddress: () => Promise<string>;
      disconnect: () => Promise<void>;
      getPermissions: () => Promise<string[]>;
    };
  }

  var arweaveWallet: {
    connect: (permissions: string[]) => Promise<void>;
    getActiveAddress: () => Promise<string>;
    disconnect: () => Promise<void>;
    getPermissions: () => Promise<string[]>;
  };
}

export {};
