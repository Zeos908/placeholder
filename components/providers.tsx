"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Wordmark } from "@/components/common/Wordmark";
import { Toaster } from "@/components/ui/sonner";
import { MOCK_API } from "@/lib/mock";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Per-query staleTime is set in lib/queries.ts (spec §19); focus refetch only where asked.
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

/** Starts MSW before rendering anything in mock mode, so no request escapes to a real server. */
function MockGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!MOCK_API);

  useEffect(() => {
    if (!MOCK_API) return;
    let cancelled = false;
    import("@/mocks/browser")
      .then(({ startMockWorker }) => startMockWorker())
      .then(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    // The one allowed full-screen loading state (spec §8): centered wordmark, no animation.
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Wordmark size={52} />
      </div>
    );
  }
  return (
    <>
      {children}
      {MOCK_API && (
        <div
          aria-hidden
          // Sits above the mobile tab bar so it never covers the Home icon.
          className="pointer-events-none fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-2 z-[80] rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-black md:bottom-2"
        >
          MOCK
        </div>
      )}
    </>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <MockGate>{children}</MockGate>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
