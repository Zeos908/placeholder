/**
 * F6: spec §21 test 11 (accepting a request moves the person into the friends list), the F6
 * checks (a share from the feed lands in the mock inbox; EyeOff only on your own grid), plus
 * activity/overlap, search, invite QR, and the Friends dot rule.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ShareSheet } from "@/components/common/ShareSheet";
import { ProfileView } from "@/components/profile/ProfileView";
import { ShellUserContext, TabActiveContext } from "@/components/shell/shell-context";
import { FriendsTab } from "@/components/tabs/FriendsTab";
import { Toaster } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import { db } from "@/mocks/db";
import { listingId } from "@/mocks/fixtures/listings";

let params: Record<string, string> = {};
vi.mock("next/navigation", () => ({
  usePathname: () => "/friends",
  useParams: () => params,
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }));

function renderWith(ui: ReactNode, active = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ShellUserContext.Provider value={{ username: "alex", display_name: "Alex Rivera", avatar_url: null }}>
        <TabActiveContext.Provider value={{ tab: "friends", active }}>{ui}</TabActiveContext.Provider>
      </ShellUserContext.Provider>
      <Toaster />
    </QueryClientProvider>,
  );
}

async function openSegment(name: "Activity" | "Inbox" | "Friends") {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("tab", { name: new RegExp(`^${name}`) }));
  return user;
}

describe("11. friend requests", () => {
  it("accepting a request moves that person into the friends list", async () => {
    renderWith(<FriendsTab />);
    await openSegment("Friends");
    const requests = await screen.findByRole("heading", { name: "Requests" });
    const section = requests.closest("section")!;
    expect(within(section).getByText("Ava Thompson")).toBeInTheDocument();

    fireEvent.click(within(section).getByRole("button", { name: "Accept" }));

    const list = await screen.findByRole("list", { name: "Your friends" });
    await waitFor(() => expect(within(list).getByText("Ava Thompson")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Requests" })).not.toBeInTheDocument();
  });

  it("declining removes the request without adding a friend", async () => {
    renderWith(<FriendsTab />);
    await openSegment("Friends");
    const section = (await screen.findByRole("heading", { name: "Requests" })).closest("section")!;
    fireEvent.click(within(section).getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Requests" })).not.toBeInTheDocument());
    expect(within(screen.getByRole("list", { name: "Your friends" })).queryByText("Ava Thompson")).toBeNull();
  });
});

describe("Friends tab", () => {
  it("opens on Inbox when shares are unread, and clears the dot once seen", async () => {
    expect((await api.me()).badges.unreadInbox).toBeGreaterThan(0);
    renderWith(<FriendsTab />);
    expect(await screen.findByRole("tab", { name: /^Inbox/, selected: true })).toBeInTheDocument();
    expect(await screen.findByRole("list", { name: "Shares" })).toBeInTheDocument();
    await waitFor(async () => expect((await api.me()).badges.unreadInbox).toBe(0), { timeout: 3000 });
  });

  it("activity interleaves overlap cards", async () => {
    db().inbox.forEach((s) => (s.read_at ??= new Date().toISOString())); // stay on Activity
    renderWith(<FriendsTab />);
    const list = await screen.findByRole("list", { name: "Friend activity" });
    expect(within(list).getAllByText(/saved/).length).toBeGreaterThan(5);
    expect(within(list).getAllByText(/^You and/).length).toBeGreaterThan(0);
  });

  it("username search finds people and can send a request", async () => {
    renderWith(<FriendsTab />);
    const user = await openSegment("Friends");
    await user.type(screen.getByRole("textbox", { name: "Search usernames" }), "max");
    const results = await screen.findByRole("region", { name: "Search results" });
    await within(results).findByText("Max Wells");
    await user.click(within(results).getByRole("button", { name: "Add" }));
    await waitFor(async () => expect((await api.friends()).outgoing.some((p) => p.username === "maxwell")).toBe(true));
  });

  it("the invite sheet shows a QR code for the invite link", async () => {
    renderWith(<FriendsTab />);
    const user = await openSegment("Friends");
    await user.click(screen.getByRole("button", { name: "Invite friends" }));
    expect(await screen.findByTitle("Invite QR code")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("invite-url")).toHaveTextContent(/\/invite\/alex-7k2p$/));
  });
});

describe("F6 checks", () => {
  it("sharing a post lands in the (mock) inbox", async () => {
    const user = userEvent.setup();
    const listing = { id: listingId(1), title: "Summer Rocketry Lab Intern" };
    const before = (await api.inbox()).length;
    renderWith(<ShareSheet listing={listing} open onOpenChange={() => {}} />);

    await user.click(await screen.findByRole("checkbox", { name: /Maya Chen/ }));
    await user.click(screen.getByRole("checkbox", { name: /Leo Martinez/ }));
    expect(screen.getByRole("button", { name: "Send to 2" })).toBeEnabled();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "let's apply");
    await user.click(screen.getByRole("button", { name: "Send to 2" }));

    await waitFor(async () => {
      const inbox = await api.inbox();
      expect(inbox.length).toBe(before + 1);
      expect(inbox.some((s) => s.listing.id === listing.id)).toBe(true);
    });
    expect(db().outbox.map((s) => s.message)).toEqual(["let's apply", "let's apply"]);
  });

  it("your own grid marks items hidden from friends with EyeOff", async () => {
    params = { username: "alex" };
    renderWith(<ProfileView />);
    // The header renders a phone and a desktop layout (CSS shows one); jsdom sees both.
    expect((await screen.findAllByRole("link", { name: "Edit profile" })).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("hidden-from-friends").length).toBe(1);
    expect(screen.getByRole("button", { name: /City Youth Hackathon \(hidden from friends\)/ })).toBeInTheDocument();
  });

  it("a friend's grid never shows EyeOff, and offers Friends / Share", async () => {
    params = { username: "maya" };
    renderWith(<ProfileView />);
    expect((await screen.findAllByRole("button", { name: /^Friends/ })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Share" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Rocketry|Hackathon|Women in Engineering|Robotics|Coding Mentor/ }).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("hidden-from-friends")).toBeNull();
  });

  it("someone who isn't a friend shows Add friend and no saves", async () => {
    params = { username: "maxwell" };
    renderWith(<ProfileView />);
    expect((await screen.findAllByRole("button", { name: "Add friend" })).length).toBeGreaterThan(0);
    expect(screen.getByText(/Add @maxwell as a friend/)).toBeInTheDocument();
  });
});
