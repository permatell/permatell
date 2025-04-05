"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check for console messages that indicate offline mode
    const originalConsoleWarn = console.warn;
    
    console.warn = function(...args) {
      // Check if any of the arguments contain offline mode messages
      const offlineMessages = [
        "Network error detected, switching to offline mode",
        "Operating in offline mode",
        "Failed to fetch",
        "Network Error",
        "Connection refused"
      ];
      
      const isOfflineMessage = args.some(arg => 
        typeof arg === 'string' && 
        offlineMessages.some(msg => arg.includes(msg))
      );
      
      if (isOfflineMessage) {
        setIsOffline(true);
        setIsVisible(true);
      }
      
      // Call the original console.warn
      originalConsoleWarn.apply(console, args);
    };
    
    // Also listen for online/offline events
    const handleOffline = () => {
      setIsOffline(true);
      setIsVisible(true);
    };
    
    const handleOnline = () => {
      // Don't immediately set offline to false
      // as our app might still be in offline mode
      // due to CORS or other issues
    };
    
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    
    // Check if already offline
    if (!navigator.onLine) {
      setIsOffline(true);
      setIsVisible(true);
    }
    
    return () => {
      console.warn = originalConsoleWarn;
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  
  if (!isVisible) return null;
  
  return (
    <div 
      className="fixed bottom-4 right-4 bg-amber-100 text-amber-800 px-4 py-2 rounded-md shadow-md flex items-center gap-2 z-50 cursor-pointer"
      onClick={() => setIsVisible(false)}
    >
      <WifiOff size={18} />
      <span>
        Offline Mode - Limited functionality available
      </span>
      <button 
        className="ml-2 text-xs text-amber-600 hover:text-amber-800"
        onClick={(e) => {
          e.stopPropagation();
          setIsVisible(false);
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
