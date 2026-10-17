import { getResponse } from "msw";
import { setupWorker } from "msw/browser";
import { loadPreset, type MockPreset } from "./db";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

let started: Promise<"service-worker" | "in-page"> | null = null;

const SETTINGS_KEY = "placeholder-mock";

export interface MockSettings {
  preset: MockPreset;
  failRequests: boolean;
}

/** The MOCK menu's choices, kept for this browser tab so a reload doesn't undo them. */
export function readMockSettings(): MockSettings {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SETTINGS_KEY) ?? "{}");
    return { preset: raw.preset === "empty" ? "empty" : "demo", failRequests: raw.failRequests === true };
  } catch {
    return { preset: "demo", failRequests: false };
  }
}

export function applyMockSettings(s: MockSettings) {
  loadPreset(s.preset, s.failRequests);
  try {
    sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // storage blocked: the choice lasts until reload
  }
}

/**
 * Starts mock mode once (React dev mode runs effects twice). Uses MSW's service worker; if the
 * browser refuses to register it (some embedded browsers, e.g. the Claude desktop app's pane,
 * block service workers), falls back to answering /api/* in the page with the same handlers.
 */
export function startMockWorker() {
  started ??= (async () => {
    applyMockSettings(readMockSettings());
    try {
      await worker.start({ onUnhandledRequest: "bypass", quiet: true });
      return "service-worker" as const;
    } catch {
      try {
        worker.stop();
      } catch {
        // never fully started
      }
      installInPageFallback();
      return "in-page" as const;
    }
  })();
  return started;
}

function installInPageFallback() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (new URL(request.url).pathname.startsWith("/api/")) {
      const response = await getResponse(handlers, request);
      if (response) return response;
    }
    return realFetch(input, init);
  };
  console.info("[mock] Service worker unavailable; mocking /api/* in the page instead.");
}
