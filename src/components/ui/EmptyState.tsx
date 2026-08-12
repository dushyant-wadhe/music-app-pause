import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  message: string;
  className?: string;
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <Card className={cn("p-4 text-sm text-[#5f6877]", className)}>
      {message}
    </Card>
  );
}
