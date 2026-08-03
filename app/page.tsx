"use client";

import dynamic from "next/dynamic";

// Disable SSR for the loading screen to avoid `self is not defined` from aoconnect
const LoadingScreen = dynamic(
  () => import("@/components/ui/loading-screen").then((m) => m.LoadingScreen),
  { ssr: false }
);

export default function Home() {
  return <LoadingScreen />;
}
