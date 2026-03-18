import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { listQueries, getHaroStats } from "@/lib/haro/storage";

export async function GET(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as "new" | "responded" | "skipped" | "failed" | null;

    const queries = listQueries(status || undefined);
    const stats = getHaroStats();

    return NextResponse.json({ queries, stats });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
