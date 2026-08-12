import { AppShell } from "@/components/layout/AppShell";
import { SessionRunView } from "@/features/library/components/SessionRunView";

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;

  return (
    <AppShell>
      <SessionRunView sessionId={id} />
    </AppShell>
  );
}
