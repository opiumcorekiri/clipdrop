import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClipDrop — Twitch Clip Downloader",
  description: "Download Twitch Clips directly from their media source."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
