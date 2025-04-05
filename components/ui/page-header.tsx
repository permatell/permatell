import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface PageHeaderProps {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, className, children }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex justify-between items-center mb-4", className || "")}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">{title}</h1>
        {description && (
          <p className="mt-2 text-gray-400">{description}</p>
        )}
      </div>
      {children}
    </motion.div>
  );
}
