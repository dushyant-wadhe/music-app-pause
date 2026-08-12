"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const MAIN_TABS = [
  {
    href: "/sessions",
    label: "Sessions",
  },
  {
    href: "/profile",
    label: "Profile",
  },
];

const TOOL_TABS = [
  {
    href: "/harmonium",
    label: "Harmonium",
  },
  {
    href: "/tabla",
    label: "Tabla",
  },
  {
    href: "/tanpura",
    label: "Tanpura",
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const isToolRoute = TOOL_TABS.some(({ href }) => pathname.startsWith(href));
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  function openTools() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setToolsOpen(true);
  }

  function closeToolsWithDelay() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setToolsOpen(false);
      closeTimerRef.current = null;
    }, 160);
  }

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!toolsRef.current?.contains(event.target as Node)) {
        setToolsOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--card-border)] bg-[#fffcf7]/92 backdrop-blur-md" aria-label="Main navigation">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-3 py-3 md:px-5">
        <Link
          href="/"
          onClick={() => setToolsOpen(false)}
          className="group relative flex items-center gap-2.5 px-0.5 py-0.5 text-[var(--app-fg)]"
          aria-label="Riyaaz home"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--accent-700)] transition-colors group-hover:text-[var(--accent-600)]">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4.5 w-4.5">
              <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <line x1="8" y1="6" x2="8" y2="18" stroke="currentColor" strokeWidth="1.2" />
              <line x1="14" y1="6" x2="14" y2="18" stroke="currentColor" strokeWidth="1.2" />
              <rect x="6.6" y="6" width="2.2" height="7" rx="0.5" fill="currentColor" />
              <rect x="12.6" y="6" width="2.2" height="7" rx="0.5" fill="currentColor" />
            </svg>
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-semibold leading-none tracking-tight">Riyaaz</span>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)]">Practice Companion</span>
          </span>
        </Link>

        <nav className="relative flex items-center gap-4" aria-label="Primary">
          <Link
            href={MAIN_TABS[0].href}
            onClick={() => setToolsOpen(false)}
            aria-label={MAIN_TABS[0].label}
            aria-current={pathname === "/sessions" || pathname.startsWith("/session") ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors md:min-h-8",
              pathname === "/sessions" || pathname.startsWith("/session")
                ? "text-[var(--accent-700)]"
                : "text-[var(--ink-soft)] hover:text-[var(--app-fg)]"
            )}
          >
            {MAIN_TABS[0].label}
          </Link>

          <div
            className="relative z-50"
            ref={toolsRef}
            onMouseEnter={openTools}
            onMouseLeave={closeToolsWithDelay}
          >
            <button
              type="button"
              aria-label="Tools"
              aria-expanded={toolsOpen}
              onClick={() => setToolsOpen((current) => !current)}
              className={cn(
                "flex min-h-10 cursor-pointer list-none items-center rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors md:min-h-8",
                isToolRoute
                  ? "text-[var(--accent-700)]"
                  : "text-[var(--ink-soft)] hover:text-[var(--app-fg)]"
              )}
            >
              Tools
              <span className={cn("ml-1 text-[10px] transition-transform duration-200", toolsOpen && "rotate-180")}>▾</span>
            </button>

            {toolsOpen && (
            <>
            <div className="absolute right-0 top-full h-3 w-48" aria-hidden="true" />
            <div className="absolute right-0 top-[calc(100%+10px)] z-[100] w-48 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1.5 shadow-[0_18px_36px_rgba(74,47,18,0.18)]">
              {TOOL_TABS.map(({ href, label }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setToolsOpen(false)}
                    className={cn(
                      "block rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                      active
                        ? "bg-[var(--accent-700)] text-[#fffdf9]"
                        : "text-[var(--ink-soft)] hover:bg-[var(--surface-soft)]"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
            </>
            )}
          </div>

          <Link
            href={MAIN_TABS[1].href}
            onClick={() => setToolsOpen(false)}
            aria-label={MAIN_TABS[1].label}
            aria-current={pathname.startsWith(MAIN_TABS[1].href) ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors md:min-h-8",
              pathname.startsWith(MAIN_TABS[1].href)
                ? "text-[var(--accent-700)]"
                : "text-[var(--ink-soft)] hover:text-[var(--app-fg)]"
            )}
          >
            {MAIN_TABS[1].label}
          </Link>
        </nav>
      </div>
    </header>
  );
}
