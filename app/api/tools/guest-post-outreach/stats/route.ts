import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { recalculateStats } from "@/lib/outreach/storage";

export async function GET(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId query param required" },
        { status: 400 }
      );
    }

    const stats = recalculateStats(projectId);

    return NextResponse.json({ stats });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
