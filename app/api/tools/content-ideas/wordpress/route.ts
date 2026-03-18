import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { fetchWordPressData } from "@/lib/api-clients/wordpress-client";

export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteUrl } = (await req.json()) as { siteUrl?: string };

    if (!siteUrl) {
      return NextResponse.json({ error: "siteUrl required" }, { status: 400 });
    }

    const data = await fetchWordPressData(siteUrl);

    if (!data) {
      return NextResponse.json({
        data: null,
        message: "WordPress SEO Bridge not configured for this site. Install the plugin and add the API URL in Settings.",
      });
    }

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch WordPress data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
