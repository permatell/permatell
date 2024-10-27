import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function CardContainer({
  children,
  className,
  delay = 0.4,
}: CardContainerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      className={cn(
        "bg-gradient-to-br from-black/50 to-[#0F0514]/50 backdrop-blur-md border border-gray-800/50 shadow-lg p-4 rounded-lg relative isolate",
        className || ""
      )}
    >
      {children}
    </motion.div>
  );
}
