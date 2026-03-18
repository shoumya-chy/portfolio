import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { runHaroPipeline } from "@/lib/haro/pipeline";

export async function POST() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runHaroPipeline();
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log("[HARO] Pipeline error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
