/**
 * Spec §21 tests 7–8 (stories row, swipe deck) plus the F3 checks: viewing every card in a
 * story turns its ring gray, and swiping in the deck removes the item from the feed.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StoriesRow } from "@/components/feed/StoriesRow";
import { SwipeDeck } from "@/components/feed/SwipeDeck";
import { TabActiveContext } from "@/components/shell/shell-context";
import { FeedTab } from "@/components/tabs/FeedTab";
import { api } from "@/lib/api";
import { db } from "@/mocks/db";
import { server } from "@/mocks/node";

vi.mock("next/navigation", () => ({
  usePathname: () => "/feed",
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderWith(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TabActiveContext.Provider value={{ tab: "feed", active: true }}>{ui}</TabActiveContext.Provider>
    </QueryClientProvider>,
  );
}

const ring = (key: string) => screen.queryByTestId(`story-ring-${key}`);

describe("7. stories row", () => {
  it("shows a circle per story with items, gradient ring while unseen", async () => {
    renderWith(<StoriesRow />);
    await screen.findByRole("navigation", { name: "Stories" });
    expect(ring("closing")).toHaveAttribute("data-unseen", "true");
    expect(ring("closing")!.className).toContain("bg-accent-gradient");
    expect(ring("near")).not.toBeNull();
    expect(ring("friends")).not.toBeNull();
  });

  it("hides empty circles, and a fully viewed story gets a gray ring", async () => {
    server.use(
      http.get("*/api/stories", () =>
        HttpResponse.json([
          { key: "closing", count: 0, unseenCount: 0 },
          { key: "friends", count: 3, unseenCount: 0, avatars: [] },
        ]),
      ),
    );
    renderWith(<StoriesRow />);
    await screen.findByRole("navigation", { name: "Stories" });
    expect(ring("closing")).toBeNull();
    expect(ring("friends")).not.toHaveAttribute("data-unseen");
    expect(ring("friends")!.className).toContain("bg-border");
  });

  it('hides "Near you" when no zip is set', async () => {
    db().me.zip = null;
    renderWith(<StoriesRow />);
    await screen.findByRole("navigation", { name: "Stories" });
    expect(ring("near")).toBeNull();
    expect(ring("closing")).not.toBeNull();
  });
});

describe("8. swipe deck", () => {
  it("Save/Pass advance the counter and the end card follows the last card", { timeout: 20_000 }, async () => {
    const total = (await api.storyDeck("closing")).length;
    expect(total).toBeGreaterThan(2);
    renderWith(<SwipeDeck storyKey="closing" label="Closing soon" onClose={() => {}} />);

    const counter = await screen.findByTestId("deck-counter");
    expect(counter).toHaveTextContent(`1 / ${total}`);

    for (let i = 1; i <= total; i++) {
      const button = screen.getByRole("button", { name: i % 2 ? "Save" : "Pass" });
      fireEvent.click(button);
      if (i < total) await waitFor(() => expect(screen.getByTestId("deck-counter")).toHaveTextContent(`${i + 1} / ${total}`));
    }
    expect(await screen.findByText(/That's everything in Closing soon/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to feed" })).toBeInTheDocument();
  });

  it("Undo brings the last card back", async () => {
    renderWith(<SwipeDeck storyKey="closing" label="Closing soon" onClose={() => {}} />);
    const firstTitle = (await screen.findByTestId("deck-top")).getAttribute("data-title");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByTestId("deck-counter")).toHaveTextContent(/^2 \//));

    const undo = screen.getByRole("button", { name: "Undo" });
    await waitFor(() => expect(undo).toBeEnabled());
    fireEvent.click(undo);
    await waitFor(() => expect(screen.getByTestId("deck-counter")).toHaveTextContent(/^1 \//));
    expect(screen.getByTestId("deck-top").getAttribute("data-title")).toBe(firstTitle);
    await waitFor(async () => expect((await api.saved()).some((s) => s.listing.title === firstTitle)).toBe(false));
  });
});

describe("F3 checks", () => {
  it("viewing every card in a story turns its ring gray", { timeout: 20_000 }, async () => {
    renderWith(<FeedTab />);
    await screen.findByRole("navigation", { name: "Stories" });
    expect(ring("closing")).toHaveAttribute("data-unseen", "true");

    fireEvent.click(screen.getByRole("button", { name: /^Closing soon/ }));
    const total = Number((await screen.findByTestId("deck-counter")).textContent!.split("/")[1]);
    // View each card (it's "seen" once on top) by passing through them, then close.
    for (let i = 1; i < total; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Pass" }));
      await waitFor(() => expect(screen.getByTestId("deck-counter")).toHaveTextContent(`${i + 1} / ${total}`));
    }
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(ring("closing")?.hasAttribute("data-unseen") ?? true).toBe(false), { timeout: 4000 });
  });

  it("swiping in the deck removes the item from the feed", { timeout: 10_000 }, async () => {
    renderWith(<FeedTab />);
    await waitFor(() => expect(screen.getAllByRole("article").length).toBeGreaterThan(0));
    fireEvent.click(await screen.findByRole("button", { name: /^Closing soon/ }));
    const top = await screen.findByTestId("deck-top");
    const title = top.getAttribute("data-title")!;
    expect(screen.getAllByRole("article", { hidden: true }).some((a) => a.getAttribute("aria-label") === title)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryAllByRole("article", { hidden: true }).some((a) => a.getAttribute("aria-label") === title)).toBe(false),
    );
  });
});
