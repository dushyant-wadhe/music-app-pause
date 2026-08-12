import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface LoaderStateProps {
  label?: string;
  className?: string;
}

export function LoaderState({ label = "Loading...", className }: LoaderStateProps) {
  return (
    <Card className={cn("py-6 text-center text-sm text-[#5f6877]", className)}>
      <span className="inline-flex items-center gap-2">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#9ca3af]" aria-hidden="true" />
        {label}
      </span>
    </Card>
  );
}
