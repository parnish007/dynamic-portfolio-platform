import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);

    if (!session) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          email: session.email,
          role: session.role,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Auth me error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
