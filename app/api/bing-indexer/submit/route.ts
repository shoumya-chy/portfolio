import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url, key, host } = await req.json();

    if (!url || !key || !host) {
      return NextResponse.json(
        { error: "Missing required fields: url, key, host" },
        { status: 400 }
      );
    }

    const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const keyLocation = `https://${cleanHost}/${key}.txt`;

    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "Mozilla/5.0 (compatible; BingIndexer/1.0)",
      },
      body: JSON.stringify({
        host: cleanHost,
        key,
        keyLocation,
        urlList: [url],
      }),
    });

    // IndexNow returns 200 or 202 on success
    if (res.status === 200 || res.status === 202) {
      return NextResponse.json({ ok: true, status: res.status, message: `HTTP ${res.status} — accepted` });
    }

    const bodyText = await res.text().catch(() => "");

    const messages: Record<number, string> = {
      400: "Bad request — check URL format or key",
      403: "Forbidden — API key invalid or key file not found at " + keyLocation,
      422: "Unprocessable — URL host doesn't match the declared host",
      429: "Rate limited — too many requests, increase your delay",
    };

    return NextResponse.json({
      ok: false,
      status: res.status,
      message: messages[res.status] ?? `HTTP ${res.status}${bodyText ? ": " + bodyText : ""}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, status: 500, message }, { status: 500 });
  }
}
