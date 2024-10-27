"use client";
import { useRouter } from "next/navigation";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import { FaStar } from "react-icons/fa";
import { WalletStatus } from "@/components/ui/wallet-status";
import { useStoryPointsProcess } from "@/contexts/StoryPointsProcessContext";
import { useWallet } from "@/contexts/WalletContext";
import { useEffect } from "react";
import Link from "next/link";

export function Navbar() {
  const router = useRouter();
  const { userStoryPoints, getUserStoryPoints } = useStoryPointsProcess();
  const { address } = useWallet();

  useEffect(() => {
    if (address) {
      getUserStoryPoints(address);
    }
  }, [address]);

  return (
    <header className="relative z-10 bg-gradient-to-br from-black via-gray-900 to-slate-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-50">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-r from-purple-500/30 to-cyan-500/30 blur-3xl animate-blob" />
          <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-r from-rose-500/30 to-orange-500/30 blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full bg-gradient-to-r from-blue-500/30 to-emerald-500/30 blur-3xl animate-blob animation-delay-4000" />
        </div>
      </div>

      <div className="absolute inset-0 bg-black/40 backdrop-blur-md border-b border-gray-800" />
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="text-white/70 hover:text-white transition-colors border border-white/20 rounded p-1"
            >
              <IoIosArrowBack size={24} />
            </button>
            <button
              onClick={() => router.forward()}
              className="text-white/70 hover:text-white transition-colors border border-white/20 rounded p-1"
            >
              <IoIosArrowForward size={24} />
            </button>
            <Link href="/">
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent hover:opacity-80 transition-all">
                PermaTell
              </h1>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {address && (
              <>
                <div className="flex items-center space-x-1">
                  <FaStar size={20} className="text-yellow-500" />
                  <span className="font-semibold text-lg leading-none flex items-center mt-[2px] bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    {userStoryPoints}
                  </span>
                </div>
                <div className="h-6 w-px bg-gray-600"></div>
              </>
            )}
            <WalletStatus />
          </div>
        </div>
      </div>
    </header>
  );
}
