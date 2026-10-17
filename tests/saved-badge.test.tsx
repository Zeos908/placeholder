/**
 * The Saved tab's red number clears once Saved is opened, and comes back (counting only the
 * new ones) when more saves become due soon.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "@/components/shell/TabBar";
import { usePrefs } from "@/lib/store";
import { meResponse } from "@/mocks/db";
import { server } from "@/mocks/node";

let pathname = "/feed";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

let dueSoon = 2;
function setup() {
  server.use(http.get("*/api/me", () => HttpResponse.json({ ...meResponse(), badges: { dueSoon, unreadInbox: 0, unreadNotifications: 0 } })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (ui: ReactNode) => <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
  const utils = render(wrap(<TabBar />));
  return {
    at: (path: string) => ((pathname = path), utils.rerender(wrap(<TabBar />))),
    refetchMe: () => client.invalidateQueries({ queryKey: ["me"] }),
  };
}
const savedLink = () => screen.getByRole("link", { name: /^Saved/ });

beforeEach(() => {
  pathname = "/feed";
  dueSoon = 2;
  usePrefs.setState({ dueSoonSeen: {} });
});

describe("Saved tab badge", () => {
  it("shows the due-soon count, clears after opening Saved, and stays cleared", async () => {
    const { at } = setup();
    await waitFor(() => expect(savedLink()).toHaveAccessibleName("Saved, 2 due soon"));

    at("/saved");
    await waitFor(() => expect(savedLink()).toHaveAccessibleName("Saved"));
    at("/feed");
    expect(savedLink()).toHaveAccessibleName("Saved");
  });

  it("comes back with only the newly due items", async () => {
    const { at, refetchMe } = setup();
    await waitFor(() => expect(savedLink()).toHaveAccessibleName("Saved, 2 due soon"));
    at("/saved");
    await waitFor(() => expect(savedLink()).toHaveAccessibleName("Saved"));
    at("/feed");

    dueSoon = 3;
    await refetchMe();
    await waitFor(() => expect(savedLink()).toHaveAccessibleName("Saved, 1 due soon"));
  });
});
