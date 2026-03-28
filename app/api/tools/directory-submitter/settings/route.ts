import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/directory-submitter/storage";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = getSettings();
  // Mask the API key for security — only show last 4 chars
  const masked = settings.twoCaptchaApiKey
    ? `${"*".repeat(Math.max(0, settings.twoCaptchaApiKey.length - 4))}${settings.twoCaptchaApiKey.slice(-4)}`
    : "";

  return NextResponse.json({
    settings: {
      twoCaptchaApiKey: masked,
      solveCaptchas: settings.solveCaptchas,
      hasApiKey: !!settings.twoCaptchaApiKey,
    },
  });
}

export async function PUT(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const current = getSettings();

  // Only update API key if a new one is provided (not the masked version)
  if (body.twoCaptchaApiKey !== undefined && !body.twoCaptchaApiKey.includes("*")) {
    current.twoCaptchaApiKey = body.twoCaptchaApiKey;
  }
  if (body.solveCaptchas !== undefined) {
    current.solveCaptchas = body.solveCaptchas;
  }

  saveSettings(current);

  return NextResponse.json({ success: true });
}
