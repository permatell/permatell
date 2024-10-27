"use client";
import { useRouter } from "next/navigation";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import { WalletStatus } from "@/components/ui/wallet-status";

export function Navbar() {
  const router = useRouter();

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
        <WalletStatus />
      </div>
    </header>
  );
}
