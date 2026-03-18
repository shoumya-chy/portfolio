import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getHaroConfig, saveHaroConfig } from "@/lib/haro/storage";
import type { HaroConfig } from "@/lib/haro/types";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = getHaroConfig();
  // Don't send passwords to frontend
  if (config) {
    return NextResponse.json({
      config: {
        ...config,
        imapConfig: { ...config.imapConfig, password: config.imapConfig.password ? "••••••" : "" },
        smtpConfig: { ...config.smtpConfig, password: config.smtpConfig.password ? "••••••" : "" },
      },
    });
  }
  return NextResponse.json({ config: null });
}

export async function POST(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();

    const existing = getHaroConfig();

    const config: HaroConfig = {
      id: existing?.id || Date.now().toString(36),
      siteUrl: body.siteUrl || "",
      siteName: body.siteName || "",
      emailAddress: body.emailAddress || "",
      imapConfig: {
        host: body.imapHost || "imap.hostinger.com",
        port: body.imapPort || 993,
        secure: body.imapSecure !== false,
        username: body.emailAddress || "",
        password: body.imapPassword === "••••••" ? (existing?.imapConfig.password || "") : (body.imapPassword || ""),
      },
      smtpConfig: {
        host: body.smtpHost || "smtp.hostinger.com",
        port: body.smtpPort || 587,
        secure: body.smtpSecure || false,
        username: body.emailAddress || "",
        password: body.smtpPassword === "••••••" ? (existing?.smtpConfig.password || "") : (body.smtpPassword || ""),
      },
      respondAsName: body.respondAsName || "",
      respondAsTitle: body.respondAsTitle || "",
      bio: body.bio || "",
      expertiseAreas: body.expertiseAreas || [],
      multiNiche: body.multiNiche || false,
      active: body.active !== false,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    if (!config.siteUrl || !config.emailAddress || !config.respondAsName) {
      return NextResponse.json(
        { error: "Site URL, email address, and name are required" },
        { status: 400 }
      );
    }

    saveHaroConfig(config);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
