import { AppShell } from "@/components/layout/AppShell";
import { VocalPracticeView } from "@/features/vocal-practice/components/VocalPracticeView";

export const metadata = {
  title: "Vocal Practice — Riyaaz",
  description: "Live pitch detection, sargam exercises, and riyaaz session tracking for Indian classical vocal practice.",
};

export default function VocalPracticePage() {
  return (
    <AppShell>
      <VocalPracticeView />
    </AppShell>
  );
}
