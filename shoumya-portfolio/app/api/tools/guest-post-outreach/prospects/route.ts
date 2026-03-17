import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import {
  listProspects,
  saveProspect,
} from "@/lib/outreach/storage";
import { canTransition } from "@/lib/outreach/state-machine";

export async function GET(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const state = searchParams.get("state");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId query param required" },
        { status: 400 }
      );
    }

    const prospects = listProspects(projectId, state ? (state as any) : undefined);

    return NextResponse.json({ prospects });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to list prospects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, prospectId, state } = body;

    if (!projectId || !prospectId || !state) {
      return NextResponse.json(
        { error: "projectId, prospectId, and state required" },
        { status: 400 }
      );
    }

    const prospects = listProspects(projectId);
    const prospect = prospects.find((p) => p.id === prospectId);

    if (!prospect) {
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }

    if (!canTransition(prospect.state, state)) {
      return NextResponse.json(
        { error: "Invalid state transition" },
        { status: 400 }
      );
    }

    prospect.state = state;
    saveProspect(prospect);

    return NextResponse.json({ prospect });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update prospect" },
      { status: 500 }
    );
  }
}
