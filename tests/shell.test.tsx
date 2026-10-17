/**
 * Spec §21 test 13: tab switching keeps each tab's scroll position; re-tapping the active tab
 * at the top triggers a refetch. Also covers the scrolled-down re-tap (scroll to top, no fetch).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TabsLayout from "@/app/(app)/(tabs)/layout";
import { AppShell } from "@/components/shell/AppShell";
import { useUi } from "@/lib/store";
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

function Harness() {
  return (
    <AppShell user={{ username: "alex", display_name: "Alex Rivera", avatar_url: null }}>
      <TabsLayout>{null}</TabsLayout>
    </AppShell>
  );
}

function renderShell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (ui: ReactNode) => <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
  const utils = render(wrap(<Harness />));
  return { ...utils, rerenderAt: (path: string) => ((pathname = path), utils.rerender(wrap(<Harness />))) };
}

/** jsdom has no layout, so give a container a real, settable scrollTop. */
function fakeScroll(el: HTMLElement) {
  let top = 0;
  const scrollTo = vi.fn((opts: ScrollToOptions) => {
    top = opts.top ?? 0;
  });
  Object.defineProperty(el, "scrollTop", { configurable: true, get: () => top, set: (v: number) => (top = v) });
  Object.defineProperty(el, "scrollTo", { configurable: true, value: scrollTo });
  return { scrollTo, set: (v: number) => ((top = v), fireEvent.scroll(el)) };
}

const container = (tab: string) => document.querySelector<HTMLElement>(`[data-tab="${tab}"]`)!;
const homeLink = () => screen.getAllByRole("link", { name: /^Home/ })[0];

beforeEach(() => {
  pathname = "/feed";
  useUi.setState({ scrollTops: { feed: 0, friends: 0, saved: 0 }, topBarVisible: true, refreshing: null });
});

describe("kept-alive tabs", () => {
  it("keeps each tab's scroll position across tab switches", async () => {
    const { rerenderAt } = renderShell();
    await screen.findAllByText(/Gearworks Makerspace|Orbital Youth Lab/);

    const feed = fakeScroll(container("feed"));
    feed.set(640);
    expect(useUi.getState().scrollTops.feed).toBe(640);

    rerenderAt("/friends");
    expect(container("feed").hidden).toBe(true);
    expect(container("friends").hidden).toBe(false);
    const friends = fakeScroll(container("friends"));
    friends.set(120);

    rerenderAt("/feed");
    expect(container("feed").scrollTop).toBe(640);
    expect(container("friends").hidden).toBe(true);

    rerenderAt("/friends");
    expect(container("friends").scrollTop).toBe(120);
  });

  it("re-tap while scrolled scrolls to top without refetching", async () => {
    renderShell();
    await screen.findAllByText(/Gearworks Makerspace|Orbital Youth Lab/);
    const feed = fakeScroll(container("feed"));
    feed.set(900);

    const requests: string[] = [];
    server.events.on("request:start", ({ request }) => void requests.push(new URL(request.url).pathname));
    fireEvent.click(homeLink());

    expect(feed.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(requests.filter((p) => p === "/api/feed")).toHaveLength(0);
    server.events.removeAllListeners();
  });

  it("re-tap at the top refetches the tab's queries and shows the spinner", async () => {
    renderShell();
    await screen.findAllByText(/Gearworks Makerspace|Orbital Youth Lab/);

    const requests: string[] = [];
    server.events.on("request:start", ({ request }) => void requests.push(new URL(request.url).pathname));
    act(() => {
      fireEvent.click(homeLink());
    });

    expect(screen.getByRole("status", { name: "Refreshing" })).toBeInTheDocument();
    await waitFor(() => expect(requests).toContain("/api/feed"));
    await waitFor(() => expect(screen.queryByRole("status", { name: "Refreshing" })).not.toBeInTheDocument());
    server.events.removeAllListeners();
  });

  it("hides the top bar on scroll down and shows it on scroll up", async () => {
    renderShell();
    await screen.findAllByText(/Gearworks Makerspace|Orbital Youth Lab/);
    const feed = fakeScroll(container("feed"));
    feed.set(100);
    feed.set(300);
    expect(useUi.getState().topBarVisible).toBe(false);
    feed.set(290);
    expect(useUi.getState().topBarVisible).toBe(true);
    feed.set(20);
    expect(useUi.getState().topBarVisible).toBe(true);
  });
});
