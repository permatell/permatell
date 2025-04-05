"use client";

import React from "react";
import Link from "next/link";

export const Disclaimer: React.FC = () => {
  return (
    <div className="fixed bottom-0 left-0 w-full bg-black/80 backdrop-blur-sm border-t border-gray-800 py-2 px-4 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <p className="text-xs text-gray-300">
          <span className="font-semibold text-purple-400">Disclaimer:</span>{" "}
          PermaTell is in alpha and fully decentralized. Access requires $HOOD tokens (Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE). We are not responsible for user-generated content.{" "}
          <Link href="/disclaimer" className="text-purple-400 hover:text-purple-300 underline">
            Learn more
          </Link>
          {" | "}
          <Link href="/mint-guide" className="text-purple-400 hover:text-purple-300 underline">
            Mint $HOOD
          </Link>
        </p>
      </div>
    </div>
  );
};
