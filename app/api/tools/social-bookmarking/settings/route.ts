import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/social-bookmarking/storage";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = getSettings();
  const masked = settings.twoCaptchaApiKey
    ? `${"*".repeat(Math.max(0, settings.twoCaptchaApiKey.length - 4))}${settings.twoCaptchaApiKey.slice(-4)}`
    : "";

  return NextResponse.json({
    settings: {
      ...settings,
      twoCaptchaApiKey: masked,
      hasApiKey: !!settings.twoCaptchaApiKey,
    },
  });
}

export async function PUT(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const current = getSettings();

  if (body.twoCaptchaApiKey !== undefined && !body.twoCaptchaApiKey.includes("*")) {
    current.twoCaptchaApiKey = body.twoCaptchaApiKey;
  }
  if (body.solveCaptchas !== undefined) current.solveCaptchas = body.solveCaptchas;
  if (body.maxPerDay !== undefined) current.maxPerDay = body.maxPerDay;
  if (body.delayBetweenMs !== undefined) current.delayBetweenMs = body.delayBetweenMs;

  saveSettings(current);
  return NextResponse.json({ success: true });
}
