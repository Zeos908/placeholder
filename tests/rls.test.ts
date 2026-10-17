/**
 * Phase 1 RLS checks, run against the Supabase project in .env.local (needs the service role key
 * to create and delete throwaway users). Run with: npm run test:rls
 *
 * Proves: a user can't read another user's user_listings, chats, or reminders; friend_saves only
 * returns a friend's saves when the friendship is accepted, share_saves is on, and the item isn't
 * hidden; profiles' private columns stay private; blocked users disappear from public_profiles.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const run = Math.random().toString(36).slice(2, 8);
const password = `Rls-${crypto.randomUUID()}`;

interface TestUser {
  id: string;
  client: SupabaseClient;
}

async function makeUser(label: string): Promise<TestUser> {
  const email = `rls-${label}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `rls_${label}_${run}` },
  });
  if (error) throw error;
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

let a: TestUser, b: TestUser, c: TestUser;
let listingId: string;

beforeAll(async () => {
  [a, b, c] = await Promise.all([makeUser("a"), makeUser("b"), makeUser("c")]);

  const { data: listing, error } = await admin
    .from("listings")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .single();
  if (error) throw new Error(`Seed listings first (npm run db:push): ${error.message}`);
  listingId = listing.id;

  // A saves the listing, starts a chat, and sets a reminder, all as themself.
  await must(
    a.client.from("user_listings").insert({
      user_id: a.id,
      listing_id: listingId,
      state: "saved",
      app_status: "interested",
    }),
  );
  const thread = await must(
    a.client.from("chat_threads").insert({ user_id: a.id, listing_id: listingId }).select("id").single(),
  );
  await must(
    a.client.from("chat_messages").insert({ thread_id: thread.id, role: "user", content: "hi" }),
  );
  await must(
    a.client.from("reminders").insert({
      user_id: a.id,
      listing_id: listingId,
      remind_at: new Date(Date.now() + 86_400_000).toISOString(),
      title: "Apply",
      source: "user",
    }),
  );
  await must(a.client.from("profiles").update({ zip: "02139" }).eq("id", a.id));
});

afterAll(async () => {
  await Promise.all([a, b, c].filter(Boolean).map((u) => admin.auth.admin.deleteUser(u.id)));
});

async function must<T>(
  q: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<NonNullable<T>> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

async function friendSavesSeenBy(viewer: TestUser, owner: TestUser) {
  const data = await must(viewer.client.rpc("friend_saves", { friend_id: owner.id }));
  return (data as { listing_id: string }[]).map((r) => r.listing_id);
}

describe("owner-only tables", () => {
  it("B can't read A's user_listings", async () => {
    const rows = await must(b.client.from("user_listings").select("*").eq("user_id", a.id));
    expect(rows).toHaveLength(0);
  });

  it("B can't read A's chat threads or messages", async () => {
    expect(await must(b.client.from("chat_threads").select("*").eq("user_id", a.id))).toHaveLength(0);
    expect(await must(b.client.from("chat_messages").select("*"))).toHaveLength(0);
  });

  it("B can't read A's reminders", async () => {
    expect(await must(b.client.from("reminders").select("*").eq("user_id", a.id))).toHaveLength(0);
  });

  it("B can't write rows as A", async () => {
    const { error } = await b.client
      .from("user_listings")
      .insert({ user_id: a.id, listing_id: listingId, state: "passed" });
    expect(error).not.toBeNull();
  });

  it("A can read their own rows", async () => {
    expect(await must(a.client.from("user_listings").select("*"))).toHaveLength(1);
    expect(await must(a.client.from("reminders").select("*"))).toHaveLength(1);
  });
});

describe("profiles privacy", () => {
  it("B sees A's public card but not zip", async () => {
    const pub = await must(b.client.from("public_profiles").select("*").eq("id", a.id));
    expect(pub).toHaveLength(1);
    expect(pub[0]).not.toHaveProperty("zip");
    expect(await must(b.client.from("profiles").select("zip").eq("id", a.id))).toHaveLength(0);
  });

  it("B can't update A's profile", async () => {
    await b.client.from("profiles").update({ bio: "hacked" }).eq("id", a.id);
    const row = await must(admin.from("profiles").select("bio").eq("id", a.id).single());
    expect(row.bio).not.toBe("hacked");
  });
});

describe("friend_saves visibility", () => {
  it("not visible before friendship", async () => {
    expect(await friendSavesSeenBy(b, a)).toEqual([]);
  });

  it("not visible while the request is pending", async () => {
    await must(b.client.from("friendships").insert({ requester_id: b.id, addressee_id: a.id }));
    expect(await friendSavesSeenBy(b, a)).toEqual([]);
  });

  it("requester can't accept their own request", async () => {
    await b.client
      .from("friendships")
      .update({ status: "accepted" })
      .eq("requester_id", b.id)
      .eq("addressee_id", a.id);
    const row = await must(
      admin.from("friendships").select("status").eq("requester_id", b.id).eq("addressee_id", a.id).single(),
    );
    expect(row.status).toBe("pending");
  });

  it("visible once A accepts", async () => {
    await must(
      a.client
        .from("friendships")
        .update({ status: "accepted" })
        .eq("requester_id", b.id)
        .eq("addressee_id", a.id),
    );
    expect(await friendSavesSeenBy(b, a)).toEqual([listingId]);
  });

  it("A's activity shows up in B's friend_activity", async () => {
    const rows = (await must(b.client.rpc("friend_activity", {}))) as { actor_id: string }[];
    expect(rows.some((r) => r.actor_id === a.id)).toBe(true);
  });

  it("C (not a friend) sees nothing", async () => {
    expect(await friendSavesSeenBy(c, a)).toEqual([]);
  });

  it("hidden_from_friends hides the item", async () => {
    await must(
      a.client.from("user_listings").update({ hidden_from_friends: true }).eq("listing_id", listingId),
    );
    expect(await friendSavesSeenBy(b, a)).toEqual([]);
    await must(
      a.client.from("user_listings").update({ hidden_from_friends: false }).eq("listing_id", listingId),
    );
  });

  it("share_saves = false hides everything", async () => {
    await must(a.client.from("profiles").update({ share_saves: false }).eq("id", a.id));
    expect(await friendSavesSeenBy(b, a)).toEqual([]);
    const rows = (await must(b.client.rpc("friend_activity", {}))) as { actor_id: string }[];
    expect(rows.some((r) => r.actor_id === a.id)).toBe(false);
    await must(a.client.from("profiles").update({ share_saves: true }).eq("id", a.id));
  });
});

describe("stories (front-end spec §10)", () => {
  type Story = { key: string; count: number; unseen_count: number; avatars: string[] | null };

  it("closing story only has unswiped items due within 7 days", async () => {
    const deck = (await must(b.client.rpc("story_deck", { p_key: "closing" }))) as {
      id: string;
      deadline: string;
    }[];
    expect(deck.length).toBeGreaterThan(0);
    const week = Date.now() + 7 * 86_400_000;
    expect(deck.every((l) => new Date(l.deadline).getTime() <= week)).toBe(true);
  });

  it("friends story shows what an accepted friend saved, with their avatar", async () => {
    const stories = (await must(b.client.rpc("get_stories"))) as Story[];
    const friends = stories.find((s) => s.key === "friends");
    expect(friends?.count).toBeGreaterThan(0);
    const deck = (await must(b.client.rpc("story_deck", { p_key: "friends" }))) as { id: string }[];
    expect(deck.map((l) => l.id)).toContain(listingId);
  });

  it("C (no friends) has no friends story", async () => {
    const stories = (await must(c.client.rpc("get_stories"))) as Story[];
    expect(stories.find((s) => s.key === "friends")).toBeUndefined();
  });

  it("near story is left out without a location", async () => {
    const stories = (await must(c.client.rpc("get_stories"))) as Story[];
    expect(stories.find((s) => s.key === "near")).toBeUndefined();
  });

  it("mark_seen clears unseen counts but never touches saved items", async () => {
    const deck = (await must(b.client.rpc("story_deck", { p_key: "closing" }))) as { id: string }[];
    await must(b.client.rpc("mark_seen", { p_ids: [...deck.map((l) => l.id), listingId] }));
    const stories = (await must(b.client.rpc("get_stories"))) as Story[];
    expect(stories.find((s) => s.key === "closing")?.unseen_count).toBe(0);
    // A's saved row is A's; B's own rows for these listings are now 'seen'.
    const rows = await must(b.client.from("user_listings").select("state").in("listing_id", deck.map((l) => l.id)));
    expect((rows as { state: string }[]).every((r) => r.state === "seen")).toBe(true);
    const aRow = await must(admin.from("user_listings").select("state").eq("user_id", a.id).eq("listing_id", listingId).single());
    expect((aRow as { state: string }).state).toBe("saved");
  });
});

describe("blocking", () => {
  it("block removes the friendship and hides both profiles", async () => {
    await must(a.client.from("blocks").insert({ blocker_id: a.id, blocked_id: b.id }));
    expect(await friendSavesSeenBy(b, a)).toEqual([]);
    expect(await must(b.client.from("public_profiles").select("id").eq("id", a.id))).toHaveLength(0);
    expect(await must(a.client.from("public_profiles").select("id").eq("id", b.id))).toHaveLength(0);
    const { error } = await b.client.from("friendships").insert({ requester_id: b.id, addressee_id: a.id });
    expect(error).not.toBeNull();
  });
});
