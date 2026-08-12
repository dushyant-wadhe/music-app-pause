import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { PlaybackBridge } from "@/components/layout/PlaybackBridge";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cormorant",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Riyaaz — Indian Music Practice Companion",
  description: "The best daily practice companion for Indian classical, devotional, and light music learners.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${cormorant.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-screen flex flex-col bg-[#f3f4f6] text-[#111111]">
        <PlaybackBridge />
        {children}
      </body>
    </html>
  );
}






