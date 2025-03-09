"use client";
import { useEffect } from "react";
import AoSyncStrategy from "@vela-ventures/aosync-strategy";

export function AoSyncWrapper() {
  useEffect(() => {
    console.log("AoSyncStrategy loaded on client.");
  }, []);

  return null; // No UI needed, just initialization
}
