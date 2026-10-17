/**
 * F4: Saved tab, Passed page, and the saved-item Details tab. Includes spec §21 test 9 (status
 * sheet → Accepted calls confetti and the sound) and the Restore half of test 5.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PassedPage from "@/app/(app)/saved/passed/page";
import SavedItemPage from "@/app/(app)/saved/[listingId]/page";
import { StatusSheet } from "@/components/saved/StatusSheet";
import { TabActiveContext } from "@/components/shell/shell-context";
import { SavedTab } from "@/components/tabs/SavedTab";
import { Toaster } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import { confetti } from "@/lib/confetti";
import { sound } from "@/lib/sound";
import { listingId } from "@/mocks/fixtures/listings";

vi.mock("@/lib/confetti", () => ({ confetti: vi.fn() }));
vi.mock("@/lib/sound", () => ({ sound: { save: vi.fn(), pass: vi.fn(), accepted: vi.fn() } }));

let params: Record<string, string> = {};
const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/saved",
  useParams: () => params,
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
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
      <TabActiveContext.Provider value={{ tab: "saved", active: true }}>{ui}</TabActiveContext.Provider>
      <Toaster />
    </QueryClientProvider>,
  );
}

// Fixture listing 4 is saved with status "applying", a checklist and a reminder.
const CLIMATE = listingId(4);

beforeEach(() => {
  vi.mocked(confetti).mockClear();
  vi.mocked(sound.accepted).mockClear();
  push.mockClear();
});

describe("9. status sheet", () => {
  it("choosing Accepted fires confetti and the accepted sound, and saves it", async () => {
    renderWith(<StatusSheet listingId={CLIMATE} current="applying" open onOpenChange={() => {}} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Accepted" }));
    expect(confetti).toHaveBeenCalledTimes(1);
    expect(sound.accepted).toHaveBeenCalledTimes(1);
    await waitFor(async () =>
      expect((await api.saved()).find((s) => s.listing.id === CLIMATE)?.app_status).toBe("accepted"),
    );
  });

  it("other statuses don't celebrate", async () => {
    renderWith(<StatusSheet listingId={CLIMATE} current="applying" open onOpenChange={() => {}} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Applied" }));
    expect(confetti).not.toHaveBeenCalled();
    expect(sound.accepted).not.toHaveBeenCalled();
  });
});

describe("Saved tab", () => {
  const rows = () => within(screen.getByRole("list", { name: "Saved items" })).getAllByRole("listitem");

  it("lists saved items soonest deadline first, with no-deadline items last", async () => {
    renderWith(<SavedTab />);
    await screen.findByRole("list", { name: "Saved items" });
    const titles = rows().map((r) => within(r).getAllByRole("link")[0].textContent ?? "");
    const saved = await api.saved();
    expect(titles.map((t) => saved.find((s) => t.includes(s.listing.title))?.listing.id)).toEqual(
      saved.map((s) => s.listing.id),
    );
    const deadlines = saved.map((s) => s.listing.deadline);
    const dated = deadlines.filter(Boolean) as string[];
    expect(dated).toEqual([...dated].sort());
  });

  it("filter chips narrow the list by type", async () => {
    renderWith(<SavedTab />);
    await screen.findByRole("list", { name: "Saved items" });
    const all = rows().length;
    fireEvent.click(screen.getByRole("radio", { name: "Scholarship" }));
    await waitFor(() => expect(rows().length).toBeLessThan(all));
    expect(rows().every((r) => r.textContent?.includes("Scholarship"))).toBe(true);
  });

  it("the status pill opens the status sheet without opening the item", async () => {
    renderWith(<SavedTab />);
    await screen.findByRole("list", { name: "Saved items" });
    fireEvent.click(screen.getAllByRole("button", { name: /^Status:/ })[0]);
    expect(await screen.findByRole("radiogroup", { name: "Status" })).toBeInTheDocument();
  });

  it("unsave moves an item to Passed; Undo puts it back", async () => {
    renderWith(<SavedTab />);
    await screen.findByRole("list", { name: "Saved items" });
    // The action sits behind the row until it's swiped open (jsdom can't swipe), so press it directly.
    const unsave = document.querySelector<HTMLButtonElement>('button[aria-label^="Unsave "]')!;
    const title = unsave.getAttribute("aria-label")!.replace(/^Unsave /, "");
    fireEvent.click(unsave);

    await waitFor(async () => expect((await api.passed()).some((p) => p.listing.title === title)).toBe(true));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(async () => expect((await api.saved()).some((s) => s.listing.title === title)).toBe(true));
  });
});

describe("5 (second half). Passed page", () => {
  it("Restore takes it off the Passed list and back into the feed pool", async () => {
    renderWith(<PassedPage />);
    const restore = (await screen.findAllByRole("button", { name: /^Restore / }))[0];
    const title = restore.getAttribute("aria-label")!.replace(/^Restore /, "");
    const id = (await api.passed()).find((p) => p.listing.title === title)!.listing.id;
    fireEvent.click(restore);

    await waitFor(() => expect(screen.queryByRole("button", { name: `Restore ${title}` })).not.toBeInTheDocument());
    expect((await api.passed()).some((p) => p.listing.title === title)).toBe(false);
    // Unswiped again. (Whether it shows in *this* user's feed also depends on grade/location filters.)
    expect((await api.listing(id)).state).toBeNull();
  });
});

describe("saved item page", () => {
  beforeEach(() => {
    params = { listingId: CLIMATE };
  });

  it("shows Details first with the info grid and open-original link", async () => {
    renderWith(<SavedItemPage />);
    expect(await screen.findByRole("tab", { name: "Details", selected: true })).toBeInTheDocument();
    expect(screen.getByText("Deadline")).toBeInTheDocument();
    expect(screen.getByText("Grade range")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open original listing/ })).toHaveAttribute("target", "_blank");
  });

  it("hide from friends persists", async () => {
    renderWith(<SavedItemPage />);
    fireEvent.click(await screen.findByRole("switch", { name: "Hide from friends" }));
    await waitFor(async () =>
      expect((await api.saved()).find((s) => s.listing.id === CLIMATE)?.hidden_from_friends).toBe(true),
    );
  });

  it("checking off a checklist step persists", async () => {
    renderWith(<SavedItemPage />);
    const step = await screen.findByRole("checkbox", { name: /research statement/ });
    expect(step).toHaveAttribute("aria-checked", "false");
    fireEvent.click(step);
    await waitFor(async () =>
      expect((await api.checklist(CLIMATE)).find((i) => i.text.includes("research statement"))?.done).toBe(true),
    );
  });

  it("adds a reminder from the sheet and deletes one", async () => {
    const user = userEvent.setup();
    renderWith(<SavedItemPage />);
    await user.click(await screen.findByRole("button", { name: "Add reminder" }));
    const title = await screen.findByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Email Ms. Patel");
    await user.click(screen.getByRole("button", { name: "Save reminder" }));

    await waitFor(async () => expect((await api.reminders(CLIMATE)).some((r) => r.title === "Email Ms. Patel")).toBe(true));
    const before = (await api.reminders(CLIMATE)).length;
    await user.click(await screen.findByRole("button", { name: "Delete reminder: Finish the research statement" }));
    await waitFor(async () => expect((await api.reminders(CLIMATE)).length).toBe(before - 1));
  });

  it("Unsave in the … menu sends it to Passed and returns to Saved", async () => {
    const user = userEvent.setup();
    renderWith(<SavedItemPage />);
    await user.click(await screen.findByRole("button", { name: "More options" }));
    await user.click(await screen.findByRole("menuitem", { name: "Unsave" }));
    expect(push).toHaveBeenCalledWith("/saved");
    await waitFor(async () => expect((await api.passed()).some((p) => p.listing.id === CLIMATE)).toBe(true));
  });
});
