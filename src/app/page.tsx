"use client";

import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import "./home.css";

const instruments = [
  { name: "Harmonium", detail: "Melody & sargam", href: "/harmonium" },
  { name: "Tabla", detail: "Taal & laya", href: "/tabla" },
  { name: "Tanpura", detail: "Drone & shruti", href: "/tanpura" },
  { name: "Bansuri", detail: "Breath & phrasing", href: "/flute" },
];

export default function RootPage() {
  return (
    <AppShell>
      <main className="home-page mx-auto w-full max-w-6xl py-5 md:py-10">
        <section className="home-hero fx-fade-up">
          <div className="home-hero-copy">
            <p className="home-eyebrow">Indian classical practice companion</p>
            <h1>Make space for <em>riyāz.</em></h1>
            <p className="home-intro">One calm workspace for Harmonium, Tabla, Tanpura, and Bansuri—built to help a daily practice become a lasting musical habit.</p>
            <div className="home-actions">
              <Link href="/sessions"><Button size="md">Begin a session</Button></Link>
              <Link href="/harmonium"><Button size="md" variant="outline">Explore instruments</Button></Link>
            </div>
            <div className="home-practice-note"><span aria-hidden="true" /> Start. Play. Record. Continue tomorrow.</div>
          </div>
          <div className="home-instrument-frame fx-fade-up-delay-1">
            <Image src="/instruments%20set.jpg" alt="Traditional Indian instruments: tanpura, tabla, harmonium, and bansuri" width={1200} height={800} priority className="home-instrument-image" />
            <div className="home-image-label"><span>Craft, laya, and listening</span><small>Riyaaz, every day</small></div>
          </div>
        </section>
        <section className="home-ritual fx-fade-up-delay-2" aria-label="Practice philosophy">
          <p className="home-eyebrow">A considered practice ritual</p>
          <div className="home-ritual-grid">
            <p>Begin from your instrument, not from settings.</p>
            <p>Keep your attention on sound, not on software.</p>
            <p>Return to saved takes and hear your progress clearly.</p>
          </div>
        </section>
        <section className="home-instrument-links fx-fade-up-delay-3" aria-label="Open an instrument">
          {instruments.map((instrument, index) => (
            <Link href={instrument.href} key={instrument.name} className="home-instrument-link">
              <span className="home-instrument-index">0{index + 1}</span>
              <span><strong>{instrument.name}</strong><small>{instrument.detail}</small></span>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
