"use client";
import { useRouter } from "next/navigation";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import { FaStar } from "react-icons/fa";
import { Check, ChevronDown, Menu, Server, Wifi, X } from "lucide-react";
import { WalletStatus } from "@/components/ui/wallet-status";
import { useStoryPointsProcess } from "@/contexts/StoryPointsProcessContext";
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";
import { useWallet } from "@/contexts/WalletContext";
import { useNetworkMode } from "@/contexts/NetworkModeContext";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

function formatNodeLabel(url: string | undefined): string {
  if (!url) return "Portal";
  try {
    return new URL(url).hostname.replace(/^hb\./, "").replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
}

export function Navbar() {
  const router = useRouter();
  const { userStoryPoints, getUserStoryPoints } = useStoryPointsProcess();
  const { getStories } = useStoriesProcess();
  const { address } = useWallet();
  const { networkMode, setNetworkMode, isLegacy } = useNetworkMode();
  const [networkOpen, setNetworkOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const networkMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const canSwitchNetwork = process.env.NEXT_PUBLIC_AO_LOCK_NETWORK !== "true";
  const writeNode =
    process.env.NEXT_PUBLIC_AO_WRITE_URL ||
    process.env.NEXT_PUBLIC_HYPERBEAM_WRITE_URL ||
    process.env.NEXT_PUBLIC_HYPERBEAM_URL ||
    "https://app-1.forward.computer";
  const nodeLabel = formatNodeLabel(writeNode);
  const scheduler = process.env.NEXT_PUBLIC_AO_MAINNET_SCHEDULER || "";
  const shortScheduler = scheduler
    ? `${scheduler.slice(0, 6)}...${scheduler.slice(-4)}`
    : "Not set";

  useEffect(() => {
    if (address) {
      getUserStoryPoints(address);
    }
  }, [address]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (
        networkMenuRef.current &&
        !networkMenuRef.current.contains(event.target as Node)
      ) {
        setNetworkOpen(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNetworkOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const switchNetwork = (next: "mainnet" | "legacy") => {
    setNetworkMode(next);
    setNetworkOpen(false);
    getStories().catch(() => {});
    if (address) getUserStoryPoints(address);
  };

  const mobileNavItems = [
    { href: "/dashboard", label: "Stories" },
    { href: "/arns", label: "ArNS" },
    { href: "/pomp", label: "POMP" },
    { href: "/author-board", label: "Leaderboard" },
  ];

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
              <div className="relative w-32 h-8">
                <Image
                  src="/logo.svg"
                  alt="PermaTell Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <nav className="hidden md:flex items-center space-x-1">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              >
                Stories
              </Link>
              <Link
                href="/arns"
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              >
                ArNS
              </Link>
              <Link
                href="/pomp"
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              >
                POMP
              </Link>
              <Link
                href="/author-board"
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              >
                Leaderboard
              </Link>
            </nav>
            <div className="relative md:hidden" ref={mobileMenuRef}>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-haspopup="menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>

              {mobileMenuOpen && (
                <nav
                  aria-label="Mobile navigation"
                  className="absolute right-0 top-11 z-30 w-52 rounded-lg border border-white/10 bg-gray-950/95 p-2 shadow-xl backdrop-blur-md"
                >
                  {mobileNavItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-md px-3 py-2.5 text-sm text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              )}
            </div>
            <div className="relative" ref={networkMenuRef}>
              <button
                type="button"
                onClick={() => setNetworkOpen((open) => !open)}
                className="inline-flex h-8 items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 text-xs font-medium text-emerald-100 transition-colors hover:border-emerald-300/40 hover:bg-emerald-400/15"
                aria-haspopup="menu"
                aria-expanded={networkOpen}
                title="AO network status"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]" />
                <span>{isLegacy ? "Legacy" : "Mainnet"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-emerald-200/80" />
              </button>

              {networkOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-72 rounded-lg border border-white/10 bg-gray-950/95 p-3 text-sm text-gray-200 shadow-xl backdrop-blur"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium text-white">
                      <Wifi className="h-4 w-4 text-emerald-300" />
                      AO Network
                    </div>
                    <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-200">
                      Active
                    </span>
                  </div>

                  <div className="space-y-2 border-y border-white/10 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-gray-400">Mode</span>
                      <span className="font-medium text-white">
                        {isLegacy ? "Legacy" : "Mainnet"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-gray-400">Write node</span>
                      <span className="max-w-40 truncate font-medium text-white">
                        {nodeLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-gray-400">Scheduler</span>
                      <span className="font-mono text-xs text-gray-300">
                        {shortScheduler}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3">
                    {canSwitchNetwork ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => switchNetwork("mainnet")}
                          className="flex items-center justify-center gap-1.5 rounded-md border border-white/10 px-2 py-1.5 text-xs text-gray-200 hover:bg-white/10"
                        >
                          {!isLegacy && <Check className="h-3.5 w-3.5" />}
                          Mainnet
                        </button>
                        <button
                          type="button"
                          onClick={() => switchNetwork("legacy")}
                          className="flex items-center justify-center gap-1.5 rounded-md border border-white/10 px-2 py-1.5 text-xs text-gray-200 hover:bg-white/10"
                        >
                          {isLegacy && <Check className="h-3.5 w-3.5" />}
                          Legacy
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 text-xs text-gray-400">
                        <Server className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          Network switching is locked by the current environment.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {address && (
              <>
                <div className="h-6 w-px bg-gray-600 hidden md:block"></div>
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
