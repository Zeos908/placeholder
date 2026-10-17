/**
 * Spec §21 test 10 (chat): Thinking bubble, then the streamed answer; the remaining count goes
 * down; the input is disabled at 0. Plus tool chips, busy/retry, markdown safety, Enter-to-send.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { db } from "@/mocks/db";
import { listingId } from "@/mocks/fixtures/listings";
import { server } from "@/mocks/node";

const STEM = listingId(31); // saved, no chat history yet
const CLIMATE = listingId(4); // saved, has history

function renderChat(id = STEM, extra: Partial<{ onShowReminders: () => void }> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui: ReactNode = (
    <QueryClientProvider client={client}>
      <div style={{ height: 600 }}>
        <ChatPanel listingId={id} title="Future STEM Leaders Scholarship" active onShowReminders={extra.onShowReminders ?? (() => {})} />
      </div>
    </QueryClientProvider>
  );
  return render(ui);
}

const input = () => screen.getByRole("textbox", { name: "Message" });

async function ask(text: string) {
  const user = userEvent.setup();
  await waitFor(() => expect(input()).toBeEnabled()); // history loaded
  await user.type(input(), text);
  await user.click(screen.getByRole("button", { name: "Send" }));
  return user;
}

describe("10. chat", () => {
  it("shows Thinking, then the streamed answer, and counts the question", async () => {
    db().chatThinkMs = 250;
    renderChat();
    expect(await screen.findByText(/Ask anything about/)).toBeInTheDocument();
    expect(screen.getByText("24 questions left today")).toBeInTheDocument();

    await ask("When is this due?");
    expect(screen.getByText("When is this due?")).toBeInTheDocument();
    expect(await screen.findByRole("status", { name: "Thinking" })).toBeInTheDocument();

    expect(await screen.findByText(/Deadline:/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("status", { name: "Thinking" })).not.toBeInTheDocument());
    expect(await screen.findByText("23 questions left today")).toBeInTheDocument();
  });

  it("disables the input once the daily questions are used up", async () => {
    db().chatUsed = 29;
    renderChat();
    expect(await screen.findByText("1 question left today")).toBeInTheDocument();
    await ask("One more?");
    expect(await screen.findByText(/You've used today's 30 questions/)).toBeInTheDocument();
    expect(input()).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("starts disabled with the limit message when there are none left", async () => {
    db().chatUsed = 30;
    renderChat();
    expect(await screen.findByText(/They reset at midnight/)).toBeInTheDocument();
    expect(input()).toBeDisabled();
  });

  it("asking for a reminder shows a tool chip that jumps to Reminders", async () => {
    const onShowReminders = vi.fn();
    renderChat(STEM, { onShowReminders });
    const user = await ask("Can you remind me before the deadline?");
    const chip = await screen.findByRole("button", { name: /⏰ Reminder set/ });
    await user.click(chip);
    expect(onShowReminders).toHaveBeenCalled();
  });

  it("a busy assistant shows the notice; Tap to retry sends again", async () => {
    server.use(
      http.post("*/api/chat/:id", () =>
        HttpResponse.json({ error: "busy", code: "busy" }, { status: 429 }),
        { once: true },
      ),
    );
    renderChat();
    const user = await ask("Hello?");
    expect(await screen.findByText(/The assistant is busy right now/)).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /Tap to retry/ }));
    expect(await screen.findByText(/Deadline:/)).toBeInTheDocument();
    expect(screen.queryByText(/The assistant is busy right now/)).not.toBeInTheDocument();
  });

  it("renders markdown but never raw HTML", async () => {
    db().chats.set(STEM, [
      { id: "u1", role: "user", content: "test", created_at: new Date().toISOString() },
      {
        id: "a1",
        role: "assistant",
        content: "**Bold** and [a link](https://example.com) <img src=x onerror=alert(1)> <b>raw</b>",
        created_at: new Date().toISOString(),
      },
    ]);
    const { container } = renderChat();
    expect(await screen.findByText("Bold")).toHaveProperty("tagName", "STRONG");
    expect(screen.getByRole("link", { name: "a link" })).toHaveAttribute("target", "_blank");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("groups history and shows a timestamp before the first message", async () => {
    renderChat(CLIMATE);
    expect(await screen.findByText("Do I need to know Python for this?")).toBeInTheDocument();
    expect(screen.getAllByText(/^(Today|Mon|Tue|Wed|Thu|Fri|Sat|Sun|[A-Z][a-z]{2} \d)/).length).toBeGreaterThan(0);
  });

  it("Enter sends on desktop", async () => {
    const user = userEvent.setup();
    renderChat();
    await screen.findByText(/Ask anything about/);
    await user.type(input(), "Is this remote?{Enter}");
    const scroller = screen.getByTestId("chat-scroller");
    expect(await within(scroller).findByText("Is this remote?")).toBeInTheDocument();
  });
});
