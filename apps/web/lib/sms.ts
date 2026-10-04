import { isValidE164 } from "@union/shared";

// Small helpers shared by /guests/sms-template (editor + preview) and
// /guests/[id] (send-time preview modal). The API route intentionally
// keeps its own copy of resolveTemplate — client and server should
// agree on which placeholders exist, but neither depends on the other
// at runtime.

export const SMS_PLACEHOLDERS = [
  "guest_first_name",
  "guest_access_link",
  "partner_1_first_name",
  "partner_2_first_name",
] as const;

export type SmsPlaceholder = (typeof SMS_PLACEHOLDERS)[number];
export type SmsVars = Record<SmsPlaceholder, string>;

export const DEFAULT_SMS_TEMPLATE = `Salut {{guest_first_name}},

Ici toutes les informations concernant notre mariage : {{guest_access_link}}.
Avec toute notre affection, {{partner_1_first_name}} & {{partner_2_first_name}}`;

export type SmsBlocker =
  | "no-phone"
  | "no-country"
  | "invalid-phone"
  | "no-sender";

/**
 * What stops an SMS invite from being sent to a guest, in the order the
 * organiser would fix it.
 *
 * `phoneE164` is the database's canonical number, the one /api/send-sms
 * actually sends to. It is set only for a number that states its country,
 * so a number that is there but has no canonical form is a "no-country"
 * problem, not a missing number. One that has a canonical form but isn't a
 * real number in its country (the database only checks its shape) is
 * "invalid-phone"; the route refuses it too. Deciding from the same value and
 * the same rules as the server keeps what the page offers and what the route
 * accepts in step.
 */
export function smsBlockers(input: {
  phone: string | null | undefined;
  phoneE164: string | null | undefined;
  sender: string | null | undefined;
}): SmsBlocker[] {
  const blockers: SmsBlocker[] = [];
  if (!(input.phone ?? "").trim()) blockers.push("no-phone");
  else if (!input.phoneE164) blockers.push("no-country");
  else if (!isValidE164(input.phoneE164)) blockers.push("invalid-phone");
  if (!(input.sender ?? "").trim()) blockers.push("no-sender");
  return blockers;
}

export function resolveSmsTemplate(
  template: string,
  vars: Partial<SmsVars>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = (vars as Record<string, string | undefined>)[key];
    return typeof v === "string" ? v : "";
  });
}
