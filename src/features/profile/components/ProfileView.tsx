"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useProfileStore } from "@/store/useProfileStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { isFirebaseConfigured } from "@/services/firebase";
import { signInWithGoogle, signOut as signOutOfFirebase, onAuthChange } from "@/services/auth";
import type { UserSettings } from "@/types";

export function ProfileView() {
  const { user, settings, updateSettings, isLoading, setLoading } = useProfileStore();
  const recordings = useLibraryStore((s) => s.recordings);
  const sessions = useLibraryStore((s) => s.sessions);
  const [authError, setAuthError] = useState<string | null>(null);
  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    if (!firebaseReady) return;
    return onAuthChange((nextUser) => useProfileStore.getState().setUser(nextUser));
  }, [firebaseReady]);

  const totalMinutes = Math.floor(sessions.reduce((acc, session) => acc + (session.actualPracticeSeconds ?? 0), 0) / 60);

  const stats = [
    { label: "Practice Minutes", value: totalMinutes },
    { label: "Total Sessions",   value: sessions.length },
    { label: "Recordings",       value: recordings.length },
  ];

  function patchSetting<K extends keyof UserSettings>(key: K, val: UserSettings[K]) {
    updateSettings({ [key]: val } as Partial<UserSettings>);
  }

  async function handleSignIn() {
    setAuthError(null);
    setLoading(true);
    const profile = await signInWithGoogle();
    setLoading(false);
    if (!profile) setAuthError("Sign-in failed. Please try again.");
  }

  async function handleSignOut() {
    setAuthError(null);
    await signOutOfFirebase();
  }


  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1d232d]">Profile</h1>
        <p className="text-[11px] text-[#5f6877]">Your progress snapshot and default preferences.</p>
      </div>

      <Card className="p-4">
        {user ? (
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#e5e7eb]">
              {user.photoURL ? (
                <Image src={user.photoURL} alt={user.displayName} width={40} height={40} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl text-[#6b7280]">
                  {user.displayName?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-[#1d232d]">{user.displayName}</p>
              <p className="truncate text-[11px] text-[#5f6877]">{user.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        ) : firebaseReady ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[#5f6877]">Sign in to sync sessions and recordings.</p>
              <Button size="sm" variant="outline" onClick={handleSignIn} disabled={isLoading} className="gap-2">
                <GoogleIcon /> {isLoading ? "Signing in..." : "Sign in with Google"}
              </Button>
            </div>
            {authError && <p role="alert" className="text-[11px] text-[#b91c1c]">{authError}</p>}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 py-1">
            <p className="text-xs text-[#5f6877]">Sign-in coming soon</p>
            <Button size="sm" variant="outline" disabled className="gap-2">
              <GoogleIcon /> Sign in with Google
            </Button>
          </div>
        )}
      </Card>

      <div>
        <SectionHeader title="Practice Stats" />
        <div className="grid grid-cols-3 gap-2">
          {stats.map(({ label, value }) => (
            <Card key={label} className="flex flex-col gap-0.5 p-2.5">
              <p className="text-lg font-bold text-[#1d232d]">{value}</p>
              <p className="text-[11px] text-[#5f6877]">{label}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader title="Settings" subtitle="Essential defaults" />
        <Card className="flex flex-col gap-4 p-4">
          <Slider
            label="Default BPM"
            value={settings.defaultBPM}
            min={40}
            max={240}
            onChange={(v) => patchSetting("defaultBPM", v)}
            formatValue={(v) => `${v} BPM`}
          />
          <Slider
            label="Default Volume"
            value={Math.round(settings.defaultVolume * 100)}
            min={0}
            max={100}
            onChange={(v) => patchSetting("defaultVolume", v / 100)}
            formatValue={(v) => `${v}%`}
          />
          <details className="border-t border-[#e3d7c2] pt-3">
            <summary className="cursor-pointer text-xs font-medium text-[#5f6877]">More default settings</summary>
            <div className="mt-3">
              <Slider
                label="Default Octave"
                value={settings.defaultOctave}
                min={2}
                max={6}
                onChange={(v) => patchSetting("defaultOctave", v)}
                formatValue={(v) => `Oct ${v}`}
              />
            </div>
          </details>
        </Card>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
