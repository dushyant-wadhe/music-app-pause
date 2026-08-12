import { AppShell } from "@/components/layout/AppShell";
import { HomeSessionsView } from "@/features/library/components/HomeSessionsView";

export default function SessionsPage() {
  return (
    <AppShell>
      <HomeSessionsView />
    </AppShell>
  );
}
