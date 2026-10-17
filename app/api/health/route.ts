import { NextResponse } from "next/server";
import { checkModels } from "@/lib/ai";

// Public: lets you confirm the deployed app can see both models (Phase 0 check). No secrets returned.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const models = await checkModels();
    return NextResponse.json({ app: "placeholder", ok: models.chatModel.found, models });
  } catch (e) {
    return NextResponse.json(
      { app: "placeholder", ok: false, error: (e as Error).message },
      { status: 502 },
    );
  }
}
