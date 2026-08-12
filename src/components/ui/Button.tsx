"use client";

// Music App Button – fully replaced
import { cn } from "@/lib/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "surface" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md border font-medium",
          "transition-[background-color,border-color,color,transform] focus-visible:outline-none",
          "active:translate-y-px",
          "disabled:opacity-40 disabled:pointer-events-none",
          variant === "primary" &&
            "border-[var(--accent-700)] bg-[var(--accent-700)] text-[#fffdf9] hover:bg-[var(--accent-600)]",
          variant === "ghost" &&
            "border-transparent bg-transparent text-[var(--ink-soft)] hover:bg-[var(--surface-soft)]",
          variant === "danger" &&
            "border-[#a73028] bg-[#b9382f] text-[#fff8f6] hover:bg-[#a73028]",
          variant === "surface" &&
            "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-fg)] hover:bg-[var(--surface-soft)]",
          variant === "outline" &&
            "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-fg)] hover:bg-[var(--surface-soft)]",
          size === "sm" && "h-11 px-3 text-xs gap-1 md:h-8",
          size === "md" && "h-11 px-4 text-sm gap-1.5 md:h-9",
          size === "lg" && "h-11 px-5 text-base gap-2 md:h-10",
          size === "icon" && "h-11 w-11 text-sm md:h-9 md:w-9",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

