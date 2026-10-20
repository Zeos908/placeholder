/** "Continue as guest": guests see a sign-up prompt instead of Friends, and a note in Settings. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SettingsView } from "@/components/settings/SettingsView";
import { ShellUserContext, TabActiveContext } from "@/components/shell/shell-context";
import { FriendsTab } from "@/components/tabs/FriendsTab";
import { meResponse } from "@/mocks/db";
import { server } from "@/mocks/node";

vi.mock("next/navigation", () => ({
  usePathname: () => "/friends",
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "system", setTheme: vi.fn() }) }));
vi.mock("@/app/(auth)/actions", () => ({ signOut: vi.fn(), continueAsGuest: vi.fn() }));
vi.mock("@/app/actions/profile", () => ({ deleteAccount: vi.fn(async () => ({})), checkUsername: vi.fn() }));

function renderAs(guest: boolean, ui: ReactNode) {
  server.use(http.get("*/api/me", () => HttpResponse.json({ ...meResponse(), is_guest: guest })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ShellUserContext.Provider value={{ id: "me", username: "alex", display_name: "Alex", avatar_url: null }}>
        <TabActiveContext.Provider value={{ tab: "friends", active: true }}>{ui}</TabActiveContext.Provider>
      </ShellUserContext.Provider>
    </QueryClientProvider>,
  );
}

describe("guest accounts", () => {
  it("Friends shows a create-account prompt instead of activity, inbox and friends", async () => {
    renderAs(true, <FriendsTab />);
    expect(await screen.findByText("Friends need an account")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
    expect(screen.queryByRole("tab", { name: /^Inbox/ })).not.toBeInTheDocument();
  });

  it("Friends works as before for a real account", async () => {
    renderAs(false, <FriendsTab />);
    expect(await screen.findByRole("tab", { name: /^Inbox/ })).toBeInTheDocument();
    expect(screen.queryByText("Friends need an account")).not.toBeInTheDocument();
  });

  it("Settings explains the guest account and links to sign-up", async () => {
    renderAs(true, <SettingsView />);
    expect(await screen.findByText("You're using a guest account")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
  });

  it("Settings has no guest note for a real account", async () => {
    renderAs(false, <SettingsView />);
    expect(await screen.findByText("Edit profile")).toBeInTheDocument();
    expect(screen.queryByText("You're using a guest account")).not.toBeInTheDocument();
  });
});
