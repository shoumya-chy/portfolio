import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getIndexNowConfig } from "@/lib/config";

/**
 * Returns the saved IndexNow config so the Bing Indexer dashboard can
 * pre-fill the form. Admin-only.
 *
 * The actual API key is returned in full (not masked) because the
 * dashboard needs to send it back with each submission. This endpoint
 * is gated by the admin JWT cookie, matching every other admin route.
 */
export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key, host } = getIndexNowConfig();
  return NextResponse.json({ key, host });
}
