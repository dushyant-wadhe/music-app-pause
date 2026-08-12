import { cn } from "@/lib/cn";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export function Card({ children, className, glow }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3",
        glow && "shadow-[0_8px_20px_rgba(74,47,18,0.14)]",
        className
      )}
    >
      {children}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-center justify-between", className)}>
      <div>
        <h2 className="text-lg font-semibold text-[#1d232d]">{title}</h2>
        {subtitle && <p className="text-xs text-[#5f6877]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

interface TabChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function TabChip({ label, active, onClick }: TabChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-xs font-medium",
        active
          ? "border-[var(--accent-700)] bg-[var(--accent-700)] text-[#fffdf9]"
          : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--ink-soft)] hover:bg-[var(--surface-soft)]"
      )}
    >
      {label}
    </button>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "success" | "muted" | "danger";
}

export function Badge({ children, variant = "muted" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        variant === "primary" && "bg-[var(--accent-700)] text-[#fffdf9]",
        variant === "success" && "bg-[var(--surface-muted)] text-[var(--app-fg)]",
        variant === "danger" && "bg-[#fcecec] text-[#a73028]",
        variant === "muted" && "bg-[var(--surface-soft)] text-[var(--ink-soft)]"
      )}
    >
      {children}
    </span>
  );
}
