// app/api/auth/login/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { loginWithEmailPassword } from "@/lib/auth/login";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

type LoginOk = {
  ok: true;
};

type LoginErr = {
  ok: false;
  error: string;
};

function jsonError(status: number, error: string) {
  const payload: LoginErr = { ok: false, error };
  return NextResponse.json(payload, { status });
}

function readString(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  const s = value.trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  /**
   * Minimal email check (safe + practical).
   * You can swap with zod later if you want.
   */
  if (!email.includes("@")) return false;
  if (email.length < 5) return false;
  if (email.length > 200) return false;
  return true;
}

/**
 * Very small in-memory rate limiter (best-effort)
 * - Works in dev and single-node deployments
 * - In serverless, it becomes "best effort"
 * Replace with Redis / DB limiter later.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_ATTEMPTS_PER_IP = 12;

type RateEntry = {
  count: number;
  resetAt: number;
};

const ipRate: Map<string, RateEntry> = new Map();

function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

function rateLimitOk(ip: string) {
  const now = Date.now();
  const existing = ipRate.get(ip);

  if (!existing || existing.resetAt <= now) {
    ipRate.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (existing.count >= RATE_MAX_ATTEMPTS_PER_IP) {
    return false;
  }

  existing.count += 1;
  ipRate.set(ip, existing);

  return true;
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return jsonError(415, "Unsupported content type. Use application/json.");
  }

  const ip = getClientIp(req);
  if (!rateLimitOk(ip)) {
    return jsonError(429, "Too many attempts. Please wait and try again.");
  }

  try {
    const body = (await req.json()) as LoginBody;

    const emailRaw = readString(body.email, 220);
    const password = readString(body.password, 300);

    if (!emailRaw || !password) {
      return jsonError(400, "Email and password are required.");
    }

    const email = normalizeEmail(emailRaw);

    if (!isValidEmail(email)) {
      return jsonError(400, "Please provide a valid email.");
    }

    /**
     * Authenticate via Supabase (sets auth cookies on server)
     */
    const result = await loginWithEmailPassword(email, password);

    if (!result.ok) {
      // Keep behavior consistent: invalid credentials -> 401
      // Supabase may return messages like "Invalid login credentials"
      return jsonError(401, "Invalid credentials.");
    }

    return NextResponse.json({ ok: true } satisfies LoginOk, { status: 200 });
  } catch (error) {
    /**
     * Avoid leaking internals in production.
     */
    const isProd = (process.env.NODE_ENV ?? "").toLowerCase() === "production";

    if (!isProd) {
      const msg = error instanceof Error ? error.message : "Unknown error.";
      return jsonError(500, `Internal server error: ${msg}`);
    }

    return jsonError(500, "Internal server error.");
  }
}

/**
 * Method guard
 */
export async function GET() {
  return jsonError(405, "Method not allowed. Use POST.");
}
