import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function POST() {
  try {
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    await clearSession(response);

    return response;
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
