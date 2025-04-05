"use client";

import { useEffect, useState } from "react";
import { useStoriesProcess } from "@/contexts/StoriesProcessContext";
import { useRouter } from "next/navigation";

export function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { getStories, stories } = useStoriesProcess();
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
    // Don't load any data during the loading screen
    // Just show a progress bar and redirect to dashboard
    
    // Set a maximum loading time of 3 seconds
    const maxLoadingTimeout = setTimeout(() => {
      console.log("Loading time complete, proceeding to dashboard");
      setProgress(100);
      setIsLoading(false);
    }, 3000);

    return () => clearTimeout(maxLoadingTimeout);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      // Redirect to dashboard regardless of whether stories were loaded
      const timer = setTimeout(() => {
        router.push("/dashboard");
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isLoading, router]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-black via-gray-900 to-slate-900">
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <div className="absolute inset-0 opacity-50">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-r from-purple-500/30 to-cyan-500/30 blur-3xl animate-blob" />
          <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-r from-rose-500/30 to-orange-500/30 blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full bg-gradient-to-r from-blue-500/30 to-emerald-500/30 blur-3xl animate-blob animation-delay-4000" />
        </div>
      </div>

      <div className="mb-8">
        <img 
          src="/PermaTell_Logo.gif" 
          alt="PermaTell Logo" 
          className="w-64 h-auto"
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
