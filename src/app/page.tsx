import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function RootPage() {
  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-4 md:gap-8 md:py-8">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-[0_20px_44px_rgba(74,47,18,0.14)] fx-fade-up md:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(178,123,53,0.22)_0%,rgba(178,123,53,0)_70%)]" />
          <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(126,79,22,0.16)_0%,rgba(126,79,22,0)_72%)]" />

          <div className="relative grid gap-8 md:grid-cols-[1.08fr_0.92fr] md:items-center">
            <div className="fx-fade-up-delay-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent-700)]">Riyaaz</p>
              <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-[1.08] text-[var(--app-fg)] md:text-6xl">
                Practice that feels
                <span className="block text-[var(--accent-700)]"> intentional, daily, alive.</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm text-[var(--ink-soft)] md:text-base">
                One calm workspace for Harmonium, Tabla, and Tanpura. Start quickly, record only what matters, and keep your musical growth visible.
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <Link href="/sessions"><Button size="md">Start Session</Button></Link>
                <Link href="/harmonium"><Button size="md" variant="outline">Explore Tools</Button></Link>
              </div>
            </div>

            <Card className="relative overflow-hidden rounded-2xl border-[var(--surface-muted)] bg-[var(--surface-soft)] p-5 fx-fade-up-delay-2 md:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(178,123,53,0.16),transparent_62%)]" />
              <div className="relative">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)]">Live Practice Canvas</p>
                <div className="relative mt-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2.5">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_35%_55%,rgba(178,123,53,0.08),transparent_62%)] fx-breathe" />
                  <div className="relative flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-700)] fx-breathe" aria-hidden="true" />
                    <div className="relative h-8 flex-1 overflow-hidden rounded-md border border-[var(--surface-muted)] bg-[var(--surface-soft)]">
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(178,123,53,0.08),transparent_35%,rgba(178,123,53,0.08))]" />
                      <svg className="absolute inset-0 h-full w-full" viewBox="0 -12 300 56" preserveAspectRatio="none" aria-hidden="true">
                        <defs>
                          <linearGradient id="siriWave1" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#b27b35" />
                            <stop offset="50%" stopColor="#9b6524" />
                            <stop offset="100%" stopColor="#7e4f16" />
                          </linearGradient>
                          <linearGradient id="siriWave2" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#c9a06a" />
                            <stop offset="50%" stopColor="#b27b35" />
                            <stop offset="100%" stopColor="#9b6524" />
                          </linearGradient>
                        </defs>
                        <g className="fx-sine-wrap fx-sine-wrap-slow">
                          <path
                            d="M0 16 C 10 -10, 20 42, 30 16 C 40 -10, 50 42, 60 16 C 70 -10, 80 42, 90 16 C 100 -10, 110 42, 120 16 C 130 -10, 140 42, 150 16 C 160 -10, 170 42, 180 16 C 190 -10, 200 42, 210 16 C 220 -10, 230 42, 240 16 C 250 -10, 260 42, 270 16 C 280 -10, 290 42, 300 16 C 310 -10, 320 42, 330 16 C 340 -10, 350 42, 360 16"
                            className="fx-siri-wave fx-siri-wave-soft"
                            stroke="url(#siriWave2)"
                          />
                        </g>
                        <g className="fx-sine-wrap">
                          <path
                            d="M0 16 C 10 -10, 20 42, 30 16 C 40 -10, 50 42, 60 16 C 70 -10, 80 42, 90 16 C 100 -10, 110 42, 120 16 C 130 -10, 140 42, 150 16 C 160 -10, 170 42, 180 16 C 190 -10, 200 42, 210 16 C 220 -10, 230 42, 240 16 C 250 -10, 260 42, 270 16 C 280 -10, 290 42, 300 16 C 310 -10, 320 42, 330 16 C 340 -10, 350 42, 360 16"
                            className="fx-siri-wave"
                            stroke="url(#siriWave1)"
                          />
                        </g>
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">Flow</p>
                    <p className="mt-1 text-sm font-medium text-[var(--app-fg)]">Start. Play. Record. Continue tomorrow.</p>
                  </div>
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">Focus</p>
                    <p className="mt-1 text-sm font-medium text-[var(--app-fg)]">Minimal controls, maximum attention on sound.</p>
                  </div>
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">Library</p>
                    <p className="mt-1 text-sm font-medium text-[var(--app-fg)]">Revisit session recordings and hear progress clearly.</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="grid gap-3 fx-fade-up-delay-2 md:grid-cols-3">
          <Card className="rounded-2xl p-4 md:p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--accent-700)]">01</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--app-fg)]">Immediate Entry</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">No planning friction. Sessions open directly into playable tools.</p>
          </Card>
          <Card className="rounded-2xl p-4 md:p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--accent-700)]">02</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--app-fg)]">Session Recording</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">Pause, resume, stop, confirm, and save with a clear final action.</p>
          </Card>
          <Card className="rounded-2xl p-4 md:p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--accent-700)]">03</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--app-fg)]">Review Confidence</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">Your saved takes stay available locally for repeat listening.</p>
          </Card>
        </section>

        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface-soft)] p-5 fx-fade-up-delay-3 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-soft)]">Open A Tool</p>
              <p className="mt-1 text-base font-semibold text-[var(--app-fg)]">Begin from your instrument, not from settings.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/harmonium"><Button variant="surface" size="sm">Harmonium</Button></Link>
              <Link href="/tabla"><Button variant="surface" size="sm">Tabla</Button></Link>
              <Link href="/tanpura"><Button variant="surface" size="sm">Tanpura</Button></Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
