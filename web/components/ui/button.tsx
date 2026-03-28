import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--at-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--at-bg)] disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-[var(--at-text)] text-[var(--at-text-inverse)] hover:bg-[var(--at-text)]/90 active:scale-[0.98]",
        accent: "bg-[var(--at-accent)] text-white hover:bg-[var(--at-accent-hover)] active:scale-[0.98]",
        destructive: "bg-[var(--at-error)] text-white hover:bg-[var(--at-error)]/90",
        outline: "border border-[var(--at-border)] bg-transparent text-[var(--at-text)] hover:bg-[var(--at-surface-hover)] active:scale-[0.98]",
        secondary: "bg-[var(--at-surface-sunken)] text-[var(--at-text)] hover:bg-[var(--at-border)]",
        ghost: "text-[var(--at-text-secondary)] hover:bg-[var(--at-surface-hover)] hover:text-[var(--at-text)]",
        link: "text-[var(--at-accent)] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
