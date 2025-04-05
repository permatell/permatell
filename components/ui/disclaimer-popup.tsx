"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export function DisclaimerPopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the user has already dismissed the popup
    const hasDismissed = localStorage.getItem("disclaimerDismissed");
    
    if (!hasDismissed) {
      // Show the popup after a short delay
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissPopup = () => {
    setIsVisible(false);
    localStorage.setItem("disclaimerDismissed", "true");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-t border-gray-800 shadow-lg"
        >
          <div className="container mx-auto py-3 px-4 flex items-center justify-between">
            <p className="text-sm text-gray-300">
              By using PermaTell, you acknowledge our <Link href="/disclaimer" className="text-purple-400 hover:text-purple-300 underline">disclaimer</Link>.
            </p>
            <button 
              onClick={dismissPopup}
              className="ml-4 text-gray-400 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 