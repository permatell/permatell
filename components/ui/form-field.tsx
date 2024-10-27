import { Label } from "./label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className || "")}>
      <Label htmlFor={htmlFor} className="text-gray-200 text-lg block">
        {label}
      </Label>
      {children}
    </div>
  );
}
