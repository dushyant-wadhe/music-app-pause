"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useProfileStore } from "@/store/useProfileStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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

  const totalMinutes = Math.floor(
    sessions.reduce((acc, s) => acc + (s.actualPracticeSeconds ?? 0), 0) / 60
  );

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
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-2 py-3 md:py-6">
      
      {/* ── Header Title ── */}
      <div className="px-1">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a683b]">
          Account & Preferences
        </p>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#2f2119]">
          User Profile
        </h1>
      </div>

      {/* ── Single Clean Card Container ── */}
      <Card className="flex flex-col gap-4 p-4 border border-[#d7b58d] rounded-xl shadow-md bg-[#fffaf3]">
        
        {/* User Account Bar */}
        {user ? (
          <div className="flex items-center justify-between gap-3 border-b border-[#ead9c1] pb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#f4e5cf] ring-1 ring-[#cfa675]">
                {user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName}
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[#8a5a2b]">
                    {user.displayName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#1d232d]">{user.displayName}</p>
                <p className="truncate text-xs text-[#75685b]">{user.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="h-8 text-xs shrink-0">
              Sign out
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 border-b border-[#ead9c1] pb-3">
            <div>
              <p className="text-sm font-bold text-[#1d232d]">Sign in</p>
              <p className="text-xs text-[#75685b]">Sync practice & recordings</p>
            </div>
            {firebaseReady ? (
              <Button size="sm" variant="outline" onClick={handleSignIn} disabled={isLoading} className="gap-2 h-8 text-xs shrink-0">
                <GoogleIcon /> {isLoading ? "Signing in…" : "Google"}
              </Button>
            ) : (
              <span className="text-xs text-[#8a7a6b]">Offline mode</span>
            )}
          </div>
        )}
        {authError && <p role="alert" className="text-xs text-[#dc2626]">{authError}</p>}

        {/* Practice Stats Row */}
        <div className="grid grid-cols-3 gap-2 py-1 text-center border-b border-[#ead9c1] pb-3">
          <div className="bg-[#f5e8d5] p-2 rounded-lg border border-[#e3d7c2]">
            <p className="text-lg font-mono font-bold text-[#2f2119] leading-tight">{totalMinutes}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a5a2b]">Minutes</p>
          </div>
          <div className="bg-[#f5e8d5] p-2 rounded-lg border border-[#e3d7c2]">
            <p className="text-lg font-mono font-bold text-[#2f2119] leading-tight">{sessions.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a5a2b]">Sessions</p>
          </div>
          <div className="bg-[#f5e8d5] p-2 rounded-lg border border-[#e3d7c2]">
            <p className="text-lg font-mono font-bold text-[#2f2119] leading-tight">{recordings.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a5a2b]">Recordings</p>
          </div>
        </div>

        {/* Practice Preferences Form */}
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7b512b]">
            Default Riyaaz Preferences
          </p>

          {/* Default BPM */}
          <div className="flex items-center justify-between gap-3 bg-[#fbf6ef] p-2.5 rounded-lg border border-[#e3d7c2]">
            <label htmlFor="default-bpm" className="text-xs font-semibold text-[#2f2119] shrink-0">
              Default BPM
            </label>
            <div className="flex items-center gap-2">
              <input
                id="default-bpm"
                type="number"
                min={40}
                max={240}
                value={settings.defaultBPM}
                onChange={(e) => patchSetting("defaultBPM", Math.max(40, Math.min(240, Number(e.target.value))))}
                className="w-16 h-7 rounded border border-[#d1d5db] bg-white text-center font-mono text-xs font-bold text-[#111827] focus:outline-none"
              />
              <span className="text-[10px] font-bold text-[#75685b]">BPM</span>
            </div>
          </div>

          {/* Default Volume */}
          <div className="flex items-center justify-between gap-3 bg-[#fbf6ef] p-2.5 rounded-lg border border-[#e3d7c2]">
            <label htmlFor="default-vol" className="text-xs font-semibold text-[#2f2119] shrink-0">
              Default Master Volume
            </label>
            <div className="flex items-center gap-2">
              <input
                id="default-vol"
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.defaultVolume * 100)}
                onChange={(e) => patchSetting("defaultVolume", Number(e.target.value) / 100)}
                className="w-24 h-1.5 accent-[#9b6524] cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-[#8a5a2b] w-8 text-right">
                {Math.round(settings.defaultVolume * 100)}%
              </span>
            </div>
          </div>
        </div>

      </Card>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
