import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";
import "./globals.css";

// Self-hosted (Latin subsets from Google Fonts, SIL OFL) so builds never depend on reaching
// fonts.googleapis.com; when that request failed, the wordmark silently fell back to a plain font.
const inter = localFont({
  src: "./fonts/Inter-Variable-latin.woff2",
  weight: "400 700",
  variable: "--font-inter",
  display: "swap",
});
const grandHotel = localFont({
  src: "./fonts/GrandHotel-Regular.woff2",
  weight: "400",
  variable: "--font-grand-hotel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "placeholder",
  description: "Find internships, volunteering, events and scholarships.",
  applicationName: "placeholder",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "placeholder", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#DD2A7B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn(inter.variable, grandHotel.variable)} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
