"use client";

import { cn } from "@/lib/cn";
import { BottomNav } from "./BottomNav";

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className="min-h-screen text-[#1d232d]">
      <BottomNav />
      <main className={cn("mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6", className)}>
        {children}
      </main>
    </div>
  );
}





