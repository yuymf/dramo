import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-[var(--at-border)] bg-transparent px-3 py-1 text-sm text-[var(--at-text)] placeholder:text-[var(--at-text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--at-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--at-bg)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
