/** F0 smoke tests: the mock API behaves like a back end within a session. */
import { describe, expect, it } from "vitest";
import { api } from "@/lib/api";
import type { ChatStreamEvent } from "@/lib/types";
import { db } from "@/mocks/db";
import { usePrefs } from "@/lib/store";

describe("mock feed", () => {
  it("pages through the feed 15 at a time without repeats", async () => {
    const p1 = await api.feed();
    expect(p1.posts).toHaveLength(15);
    expect(p1.nextCursor).toBe("15");
    const p2 = await api.feed(p1.nextCursor);
    const ids = new Set([...p1.posts, ...p2.posts].map((p) => p.id));
    expect(ids.size).toBe(p1.posts.length + p2.posts.length);
  });

  it("save → appears in Saved; undo → back in the feed", async () => {
    const [first] = (await api.feed()).posts;
    const { undoToken } = await api.swipe(first.id, "right");
    expect((await api.saved()).some((s) => s.listing.id === first.id)).toBe(true);
    expect((await api.feed()).posts.some((p) => p.id === first.id)).toBe(false);

    await api.undoSwipe(undoToken);
    expect((await api.saved()).some((s) => s.listing.id === first.id)).toBe(false);
    expect((await api.feed()).posts.some((p) => p.id === first.id)).toBe(true);
  });

  it("pass → Passed; restore → gone from Passed", async () => {
    const [first] = (await api.feed()).posts;
    await api.swipe(first.id, "left");
    expect((await api.passed()).some((p) => p.listing.id === first.id)).toBe(true);
    await api.restore(first.id);
    expect((await api.passed()).some((p) => p.listing.id === first.id)).toBe(false);
  });
});

describe("mock stories", () => {
  it("only returns stories with items, and no Near you without a zip", async () => {
    const withZip = await api.stories();
    expect(withZip.every((s) => s.count > 0)).toBe(true);
    expect(withZip.map((s) => s.key)).toContain("near");

    db().me.zip = null;
    expect((await api.stories()).map((s) => s.key)).not.toContain("near");
  });

  it("viewing every card in a story clears its unseen count", async () => {
    const closing = (await api.stories()).find((s) => s.key === "closing")!;
    expect(closing.unseenCount).toBeGreaterThan(0);
    const deck = await api.storyDeck("closing");
    await api.seen(deck.map((p) => p.id));
    expect((await api.stories()).find((s) => s.key === "closing")!.unseenCount).toBe(0);
  });
});

describe("mock chat", () => {
  it("streams an answer, creates a reminder tool chip, and counts the question", async () => {
    const listingId = (await api.saved())[0].listing.id;
    const before = (await api.chatHistory(listingId)).remaining;

    const events: ChatStreamEvent[] = [];
    for await (const e of api.chatSend(listingId, "When is this due and can you remind me?")) events.push(e);

    expect(events.some((e) => e.type === "tool")).toBe(true);
    expect(events.filter((e) => e.type === "token").length).toBeGreaterThan(5);
    const done = events.at(-1);
    expect(done?.type).toBe("done");
    expect(done?.type === "done" && done.remaining).toBe(before - 1);
    expect((await api.listing(listingId)).reminders.some((r) => r.source === "ai")).toBe(true);
  });

  it("refuses the 31st question of the day", async () => {
    db().chatUsed = 30;
    const listingId = (await api.saved())[0].listing.id;
    const events: ChatStreamEvent[] = [];
    for await (const e of api.chatSend(listingId, "hi")) events.push(e);
    expect(events).toEqual([expect.objectContaining({ type: "error", code: "limit" })]);
  });
});

describe("prefs store", () => {
  it("persists sound effects to localStorage", () => {
    usePrefs.getState().setSoundEnabled(false);
    expect(JSON.parse(localStorage.getItem("placeholder-prefs")!).state.soundEnabled).toBe(false);
  });
});
