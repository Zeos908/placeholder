"use client";

/**
 * Web push (build spec §10). Registers /sw.js and subscribes with the VAPID public key, then
 * stores the subscription via /api/push/subscribe. In mock mode MSW owns the service worker
 * scope, so the subscription is simulated (permission is still really requested).
 */
import { api } from "@/lib/api";
import { MOCK_API } from "@/lib/mock";

export type PushState = "unsupported" | "unconfigured" | "denied" | "off" | "on";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const MOCK_KEY = "placeholder-mock-push";

function supported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

function mockOn() {
  try {
    return localStorage.getItem(MOCK_KEY) === "on";
  } catch {
    return false;
  }
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (MOCK_API) return mockOn() ? "on" : "off";
  if (!VAPID) return "unconfigured";
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return (await reg?.pushManager.getSubscription()) ? "on" : "off";
}

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function enablePush(): Promise<PushState> {
  if (!supported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  if (MOCK_API) {
    try {
      localStorage.setItem(MOCK_KEY, "on");
    } catch {
      // storage blocked: state just won't survive a reload
    }
    await api.pushSubscribe({ endpoint: "mock://push" });
    return "on";
  }
  if (!VAPID) return "unconfigured";

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }));
  await api.pushSubscribe(sub.toJSON());
  return "on";
}

export async function disablePush(): Promise<PushState> {
  if (MOCK_API) {
    try {
      localStorage.removeItem(MOCK_KEY);
    } catch {
      // ignore
    }
    await api.pushUnsubscribe();
    return "off";
  }
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  await (await reg?.pushManager.getSubscription())?.unsubscribe();
  await api.pushUnsubscribe();
  return "off";
}
