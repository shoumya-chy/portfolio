import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import directories from "@/lib/directory-submitter/directories";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = directories.filter((d) => d.active);
  const byType = {
    general: active.filter((d) => d.type === "general").length,
    niche: active.filter((d) => d.type === "niche").length,
    local: active.filter((d) => d.type === "local").length,
    blog: active.filter((d) => d.type === "blog").length,
    rss: active.filter((d) => d.type === "rss").length,
    "social-bookmark": active.filter((d) => d.type === "social-bookmark").length,
  };

  return NextResponse.json({
    directories: active,
    total: active.length,
    byType,
  });
}
