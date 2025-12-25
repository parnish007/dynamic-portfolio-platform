// C:\Users\AB\Desktop\portfolio-website\lib\validation\contact.ts

import {
  isNonEmptyString,
  isPlainObject,
  isValidEmail,
  isValidURL,
} from "@/lib/utils/validation";

export type ContactPayload = {
  name: string;
  email: string;
  subject?: string;
  message: string;
  phone?: string;
  company?: string;
  website?: string;
  budget?: string;
  timeline?: string;
  source?: string;
};

export type NormalizedContactPayload = {
  name: string;
  email: string;
  subject: string | null;
  message: string;
  phone: string | null;
  company: string | null;
  website: string | null;
  budget: string | null;
  timeline: string | null;
  source: string | null;
};

export type ContactValidationErrors = Partial<
  Record<keyof ContactPayload, string>
>;

export type ContactValidationResult =
  | { ok: true; data: NormalizedContactPayload }
  | { ok: false; errors: ContactValidationErrors };

export type ValidateContactOptions = {
  maxNameLength?: number;
  maxEmailLength?: number;
  maxSubjectLength?: number;
  maxMessageLength?: number;
  minMessageLength?: number;
  maxPhoneLength?: number;
  maxCompanyLength?: number;
  maxWebsiteLength?: number;
  maxBudgetLength?: number;
  maxTimelineLength?: number;
  maxSourceLength?: number;
  requireSubject?: boolean;
  requirePhone?: boolean;
  requireCompany?: boolean;
  requireWebsite?: boolean;
};

const DEFAULTS: Required<Omit<ValidateContactOptions, never>> = {
  maxNameLength: 80,
  maxEmailLength: 254,
  maxSubjectLength: 140,
  maxMessageLength: 4000,
  minMessageLength: 10,
  maxPhoneLength: 30,
  maxCompanyLength: 80,
  maxWebsiteLength: 2048,
  maxBudgetLength: 60,
  maxTimelineLength: 60,
  maxSourceLength: 80,
  requireSubject: false,
  requirePhone: false,
  requireCompany: false,
  requireWebsite: false,
};

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function safeString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value;
}

function toNullableTrimmed(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = normalizeWhitespace(value);

  if (!trimmed) {
    return null;
  }

  return trimmed;
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateContactPayload(
  input: unknown,
  options?: ValidateContactOptions
): ContactValidationResult {
  const opts: Required<ValidateContactOptions> = {
    ...DEFAULTS,
    ...(options ?? {}),
  };

  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: {
        name: "Invalid payload.",
        email: "Invalid payload.",
        message: "Invalid payload.",
      },
    };
  }

  const maybe = input as Partial<ContactPayload>;

  const name = normalizeWhitespace(safeString(maybe.name));
  const email = normalizeEmail(safeString(maybe.email));
  const subject = toNullableTrimmed(maybe.subject);
  const message = safeString(maybe.message).trim();

  const phone = toNullableTrimmed(maybe.phone);
  const company = toNullableTrimmed(maybe.company);
  const website = toNullableTrimmed(maybe.website);
  const budget = toNullableTrimmed(maybe.budget);
  const timeline = toNullableTrimmed(maybe.timeline);
  const source = toNullableTrimmed(maybe.source);

  const errors: ContactValidationErrors = {};

  if (!isNonEmptyString(name)) {
    errors.name = "Name is required.";
  } else if (name.length > opts.maxNameLength) {
    errors.name = `Name must be at most ${opts.maxNameLength} characters.`;
  }

  if (!isNonEmptyString(email)) {
    errors.email = "Email is required.";
  } else if (email.length > opts.maxEmailLength) {
    errors.email = `Email must be at most ${opts.maxEmailLength} characters.`;
  } else if (!isValidEmail(email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (opts.requireSubject && subject === null) {
    errors.subject = "Subject is required.";
  } else if (subject && subject.length > opts.maxSubjectLength) {
    errors.subject = `Subject must be at most ${opts.maxSubjectLength} characters.`;
  }

  if (!isNonEmptyString(message)) {
    errors.message = "Message is required.";
  } else if (message.length < opts.minMessageLength) {
    errors.message = `Message must be at least ${opts.minMessageLength} characters.`;
  } else if (message.length > opts.maxMessageLength) {
    errors.message = `Message must be at most ${opts.maxMessageLength} characters.`;
  }

  if (opts.requirePhone && phone === null) {
    errors.phone = "Phone is required.";
  } else if (phone && phone.length > opts.maxPhoneLength) {
    errors.phone = `Phone must be at most ${opts.maxPhoneLength} characters.`;
  }

  if (opts.requireCompany && company === null) {
    errors.company = "Company is required.";
  } else if (company && company.length > opts.maxCompanyLength) {
    errors.company = `Company must be at most ${opts.maxCompanyLength} characters.`;
  }

  if (opts.requireWebsite && website === null) {
    errors.website = "Website is required.";
  } else if (website) {
    if (website.length > opts.maxWebsiteLength) {
      errors.website = `Website must be at most ${opts.maxWebsiteLength} characters.`;
    } else if (!isValidURL(website)) {
      errors.website = "Website must be a valid URL (include https://).";
    }
  }

  if (budget && budget.length > opts.maxBudgetLength) {
    errors.budget = `Budget must be at most ${opts.maxBudgetLength} characters.`;
  }

  if (timeline && timeline.length > opts.maxTimelineLength) {
    errors.timeline = `Timeline must be at most ${opts.maxTimelineLength} characters.`;
  }

  if (source && source.length > opts.maxSourceLength) {
    errors.source = `Source must be at most ${opts.maxSourceLength} characters.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const normalized: NormalizedContactPayload = {
    name,
    email,
    subject,
    message,
    phone,
    company,
    website,
    budget,
    timeline,
    source,
  };

  return { ok: true, data: normalized };
}
