import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function CardContainer({
  children,
  className,
  ...props
}: CardContainerProps) {
  return (
    <div className={cn("rounded-lg", className || "")} {...props}>
      {children}
    </div>
  );
}
