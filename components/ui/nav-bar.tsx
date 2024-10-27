"use client";
import { useRouter } from "next/navigation";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import { FaStar } from "react-icons/fa";
import { WalletStatus } from "@/components/ui/wallet-status";
import { useStoryPointsProcess } from "@/contexts/StoryPointsProcessContext";
import { useWallet } from "@/contexts/WalletContext";
import { useEffect } from "react";

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
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <IoIosArrowBack size={24} />
          </button>
          <button
            onClick={() => router.forward()}
            className="text-gray-600 hover:text-gray-900"
          >
            <IoIosArrowForward size={24} />
          </button>
          <h1 className="text-xl font-semibold">PermaTell</h1>
        </div>
        <div className="flex items-center space-x-4">
          {address && (
            <>
              <div className="flex items-center space-x-1 text-yellow-500">
                <FaStar size={20} className="flex-shrink-0" />
                <span className="font-semibold text-lg leading-none flex items-center mt-[2px]">
                  {userStoryPoints}
                </span>
              </div>
              <div className="h-6 w-px bg-gray-300"></div>
            </>
          )}
          <WalletStatus />
        </div>
      </div>
    </header>
  );
}
