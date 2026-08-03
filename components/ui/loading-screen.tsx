"use client";

import { useEffect, useState } from "react";
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
export function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { getStories } = useStoriesProcess();
  const router = useRouter();

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isLoading && progress < 90) {
      interval = setInterval(() => {
        setProgress((prev) => {
          const increment = Math.max(1, (90 - prev) / 10);
          return Math.min(90, prev + increment);
        });
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isLoading, progress]);

  useEffect(() => {
    const loadData = async () => {
      try {
        await getStories();
      } catch (error) {
        console.error("Error loading initial data:", error);
      } finally {
        setProgress(100);
        setIsLoading(false);
      }
    };

    loadData();

    // Safety timeout: navigate to dashboard after 12s even if fetch hangs
    const safetyTimeout = setTimeout(() => {
      setProgress(100);
      setIsLoading(false);
    }, 12000);

    return () => clearTimeout(safetyTimeout);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        router.push("/dashboard");
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isLoading, router]);

  return (
    <div className="relative z-50 flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-black via-gray-900 to-slate-900">
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <div className="absolute inset-0 opacity-50">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-r from-purple-500/30 to-cyan-500/30 blur-3xl animate-blob" />
          <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-r from-rose-500/30 to-orange-500/30 blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full bg-gradient-to-r from-blue-500/30 to-emerald-500/30 blur-3xl animate-blob animation-delay-4000" />
        </div>
      </div>

      <div className="relative w-64 h-64 md:w-80 md:h-80 mb-4">
        <Image
          src="/pt_logo.gif"
          alt="PermaTell Logo"
          fill
          className="object-contain"
          priority
        />
      </div>

      <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
