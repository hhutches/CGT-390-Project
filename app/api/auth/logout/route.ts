import { clearAuthSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST() {
  await clearAuthSession();

  return NextResponse.json({
    loggedOut: true,
  });
}