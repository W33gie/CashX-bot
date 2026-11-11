import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Untapped — Creator Intelligence", template: "%s · Untapped" },
  description: "Find promising, overlooked creators and the commercial opportunities around them.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans text-[14px] leading-relaxed">{children}</body>
    </html>
  );
}
