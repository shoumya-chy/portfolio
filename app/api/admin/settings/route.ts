import { NextResponse } from "next/server";
import { getAuthFromCookies, hashPassword } from "@/lib/auth";
import { readConfig, writeConfig } from "@/lib/config";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = readConfig();
  // Never send the password hash or full API keys to the client
  return NextResponse.json({
    admin: { email: config.admin.email, hasPassword: !!config.admin.passwordHash },
    apiKeys: {
      anthropic: config.apiKeys.anthropic ? `...${config.apiKeys.anthropic.slice(-8)}` : "",
      bing: config.apiKeys.bing ? `...${config.apiKeys.bing.slice(-8)}` : "",
    },
    gsc: { hasCredentials: !!config.gsc.credentialsJson },
    sites: config.sites,
  });
}

export async function PUT(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const config = readConfig();

    // Update API keys (only if provided — empty string means "clear it")
    if (body.anthropicKey !== undefined) {
      config.apiKeys.anthropic = body.anthropicKey;
    }
    if (body.bingKey !== undefined) {
      config.apiKeys.bing = body.bingKey;
    }

    // Update GSC credentials
    if (body.gscCredentialsJson !== undefined) {
      config.gsc.credentialsJson = body.gscCredentialsJson;
    }

    // Update admin password
    if (body.newPassword && typeof body.newPassword === "string") {
      config.admin.passwordHash = await hashPassword(body.newPassword);
    }

    // Update admin email
    if (body.email && typeof body.email === "string") {
      config.admin.email = body.email;
    }

    writeConfig(config);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
