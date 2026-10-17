import type { Metadata, Viewport } from "next";
import { Grand_Hotel, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});
const grandHotel = Grand_Hotel({ subsets: ["latin"], weight: "400", variable: "--font-grand-hotel" });

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
