// Runs once when the server starts. In dev, verify the configured NIM chat model exists (§3).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "development") return;
  const { checkModels } = await import("./lib/ai");
  try {
    await checkModels();
  } catch (e) {
    console.error("[ai] startup model check failed:", (e as Error).message);
  }
}
