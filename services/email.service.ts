// services/email.service.ts

import nodemailer from "nodemailer";

/**
 * ⚠️ STAGE 7 NOTE
 * Email service adapter.
 *
 * Responsibilities:
 * - Send transactional emails (contact form, alerts, admin notifications)
 * - Keep implementation minimal and replaceable
 *
 * Later upgrades:
 * - HTML templates
 * - Queueing / retries
 * - External providers (Resend, SendGrid, SES, etc.)
 *
 * ❗ This is an infrastructure adapter, not business logic
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type SendEmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

/* -------------------------------------------------------------------------- */
/* Transporter setup                                                          */
/* -------------------------------------------------------------------------- */

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT ?? 587),
  secure: Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function assertEnv(value: string | undefined, name: string): void {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

function getFromAddress(): string {
  assertEnv(process.env.EMAIL_USER, "EMAIL_USER");
  return `"Portfolio Platform" <${process.env.EMAIL_USER}>`;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Send an email.
 *
 * NOTE:
 * - Validation of payload should happen BEFORE calling this function
 * - This function focuses only on transport + delivery
 */
export async function sendEmail(payload: SendEmailPayload) {
  const { to, subject, text, html, replyTo } = payload;

  assertEnv(to, "to");
  assertEnv(subject, "subject");
  assertEnv(text, "text");

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject,
      text,
      html,
      replyTo,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("[email] sent:", info.messageId);
    }

    return info;
  } catch (error) {
    console.error("[email] failed:", error);
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* DEV / HEALTH CHECK                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Verify transporter configuration.
 * Useful during local setup and CI checks.
 */
export async function verifyEmailTransport(): Promise<void> {
  try {
    await transporter.verify();

    if (process.env.NODE_ENV !== "production") {
      console.log("[email] transporter verified");
    }
  } catch (error) {
    console.error("[email] transporter verification failed:", error);
    throw error;
  }
}
