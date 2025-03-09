"use client";

import dynamic from "next/dynamic";

// Lazy-load LoadingScreen and disable SSR to prevent server-side rendering issues
const LoadingScreen = dynamic(() => import("@/components/ui/loading-screen").then(mod => mod.LoadingScreen), {
  ssr: false, // Ensures it runs only on the client
});

export default function Page() {
  return <LoadingScreen />;
}
