import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  return NextResponse.json({ isAdmin });
}
