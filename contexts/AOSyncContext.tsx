"use client";

// Import the debug polyfill
import "@/lib/debug-polyfill";

import { AOSyncProvider } from "@vela-ventures/aosync-sdk-react";
import { getAOConfig } from "@/lib/ao-config";

export const AOSyncContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const config = getAOConfig();

  return (
    <AOSyncProvider
      gatewayConfig={{
        host: "arweave.net",
        port: 443,
        protocol: "https",
      }}
      appInfo={{ name: "PermaTell" }}
      muUrl={config.mu_url}
    >
      {children}
    </AOSyncProvider>
  );
};
