/** Search page: suggestions before typing, keyword + type filter results, and the empty state. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { SearchView } from "@/components/search/SearchView";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/search",
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SearchView />
    </QueryClientProvider>,
  );
  return screen.getByRole("searchbox", { name: "Search opportunities" });
}

const results = () => screen.findByRole("list", { name: "Search results" });

describe("search", () => {
  it("shows suggestions until at least 2 characters are typed", () => {
    const input = setup();
    expect(screen.getByRole("button", { name: "coding" })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "h" } });
    expect(screen.queryByRole("list", { name: "Search results" })).not.toBeInTheDocument();
  });

  it("finds listings by title words and links to them", async () => {
    const input = setup();
    fireEvent.change(input, { target: { value: "rocketry lab" } });
    const list = await results();
    const link = within(list).getByRole("link", { name: /Summer Rocketry Lab Intern/ });
    expect(link.getAttribute("href")).toMatch(/^\/l\//);
  });

  it("matches tags and narrows by type", async () => {
    const input = setup();
    fireEvent.change(input, { target: { value: "coding" } });
    expect(within(await results()).getByText("City Youth Hackathon")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Internship" }));
    // The hackathon is an event, so it drops out under Internship (old results stay, dimmed,
    // until the new ones arrive).
    await waitFor(() => expect(screen.queryByText("City Youth Hackathon")).not.toBeInTheDocument());
    expect(within(await results()).getByText("Junior Web Developer Intern")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    const input = setup();
    fireEvent.change(input, { target: { value: "zzqqxx" } });
    expect(await screen.findByText("No matches")).toBeInTheDocument();
  });

  it("a suggestion chip runs that search", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "coding" }));
    expect(within(await results()).getByText("City Youth Hackathon")).toBeInTheDocument();
  });
});
