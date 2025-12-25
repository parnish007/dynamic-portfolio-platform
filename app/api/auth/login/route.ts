import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LoginBody;

    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    /**
     * NOTE:
     * For now, credentials are validated via helpers.
     * Later this will connect to DB / Supabase.
     */
    const isValid = await verifyPassword(email, password);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    /**
     * Create secure session cookie
     */
    await createSession(response, {
      email,
      role: "admin",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
