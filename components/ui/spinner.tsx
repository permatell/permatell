"use client";

import { cn } from "@/lib/utils";
import * as React from "react";
import { ImSpinner8 } from "react-icons/im";

const Spinner = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div className={cn("flex justify-center items-center", className || "")}>
    <ImSpinner8 className="animate-spin text-4xl text-gray-900" />
  </div>
));

export { Spinner };
