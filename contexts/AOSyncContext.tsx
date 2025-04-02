"use client";

import { AOSyncProvider } from "@vela-ventures/aosync-sdk-react";

export const AOSyncContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <AOSyncProvider
      gatewayConfig={{
        host: "arweave.net",
        port: 443,
        protocol: "https",
      }}
      appInfo={{ name: "PermaTell" }}
      muUrl="https://mu.ao-testnet.xyz"
    >
      {children}
    </AOSyncProvider>
  );
};
