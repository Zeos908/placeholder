import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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

// Applies the theme before first paint so there's no light/dark flash.
// "system" follows the OS; the saved preference is synced from profiles.theme after sign-in.
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <div className="mx-auto min-h-dvh w-full max-w-[470px]">{children}</div>
      </body>
    </html>
  );
}
