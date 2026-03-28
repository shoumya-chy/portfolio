import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { listSubmissions, getStats } from "@/lib/directory-submitter/storage";

export async function GET(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId") || undefined;

  const submissions = listSubmissions(siteId);
  const stats = getStats(siteId);

  return NextResponse.json({ submissions, stats });
}
