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

export function resolveSmsTemplate(
  template: string,
  vars: Partial<SmsVars>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = (vars as Record<string, string | undefined>)[key];
    return typeof v === "string" ? v : "";
  });
}
