interface Window {
  arweaveWallet: any;
  ao?: {
    send: (params: {
      Target: string;
      Tags: Record<string, string>;
      [key: string]: any;
    }) => Promise<{
      Tags?: Record<string, string>;
      [key: string]: any;
    }>;
  };
}
