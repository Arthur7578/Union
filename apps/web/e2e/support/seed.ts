import { randomUUID } from "node:crypto";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { e2eEnv } from "./env";

type Question = {
  id: string;
  kind: "short" | "comment" | "single" | "multi";
  title: Record<string, string>;
  required: boolean;
  options?: Array<{ id: string; label: Record<string, string> }>;
};

export type SeedGuest = {
  key: string;
  firstName: string;
  /** Relationship from the invited guest: their partner or their child. */
  relation?: "partner_of" | "parent_of";
  /** An RSVP already on record for them. */
  rsvp?: "attending" | "declined";
  /** Leave the invitation welcome (the faire-part card) unseen, so their link opens on it. */
  welcomeSeen?: boolean;
};

export type Seeded = {
  weddingId: string;
  /** Signed in as the wedding's owner: seeds, and reads back what guests
   *  wrote, with exactly the access the organiser has in the app. */
  owner: SupabaseClient;
  ownerSession: Session;
  forms: Record<string, string>;
  guests: Record<string, { id: string; token: string }>;
};

/** Only used to create the organiser's login: this project grants the
 *  service role no rights on the app's own tables. */
function authAdmin() {
  const { url, serviceRoleKey } = e2eEnv();
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } }).auth.admin;
}

function must<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

/**
 * A wedding of its own for one test: an organiser who owns it, its RSVP form
 * and any custom forms, and one invited guest with their household. Every
 * guest has an email and has already seen the welcome, so their link opens
 * straight on the hub.
 */
export async function seedWedding(opts: {
  rsvpQuestions?: Question[];
  /** The couple's own RSVP wording (forms.rsvp_copy), e.g.
   *  `{ label_declined: { en: "Can't make it" } }`. */
  rsvpCopy?: Record<string, Record<string, string>>;
  customForms?: Array<{ key: string; title: string; perPerson: boolean; questions: Question[] }>;
  /** More columns for the wedding row, e.g. its date or the address it discloses. */
  wedding?: Record<string, unknown>;
  household: SeedGuest[];
}): Promise<Seeded> {
  const { url, anonKey } = e2eEnv();
  const run = randomUUID().slice(0, 8);
  const ownerEmail = `owner-${run}@e2e.test`;
  const ownerPassword = `pw-${randomUUID()}`;

  const created = await authAdmin().createUser({ email: ownerEmail, password: ownerPassword, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("No user created");
  const user = created.data.user;
  const db = createClient(url, anonKey, { auth: { persistSession: false } });
  const signedIn = await db.auth.signInWithPassword({ email: ownerEmail, password: ownerPassword });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("No session");

  const weddingId = randomUUID();
  must(
    await db.from("weddings").insert({
      id: weddingId,
      owner_id: user.id,
      partner_one: "Maya",
      partner_two: "Daniel",
      ...opts.wedding,
    }),
  );

  const forms: Record<string, string> = { rsvp: randomUUID() };
  must(
    await db.from("forms").insert({
      id: forms.rsvp,
      wedding_id: weddingId,
      kind: "rsvp",
      purpose: "primary",
      title: "RSVP",
      published: true,
      questions: opts.rsvpQuestions ?? [],
      ...(opts.rsvpCopy ? { rsvp_copy: opts.rsvpCopy } : {}),
    }),
  );
  for (const f of opts.customForms ?? []) {
    forms[f.key] = randomUUID();
    must(
      await db.from("forms").insert({
        id: forms[f.key],
        wedding_id: weddingId,
        kind: "custom",
        title: f.title,
        published: true,
        per_person: f.perPerson,
        questions: f.questions,
      }),
    );
  }

  const guests: Seeded["guests"] = {};
  for (const g of opts.household) {
    guests[g.key] = { id: randomUUID(), token: randomUUID() };
    must(
      await db.from("guests").insert({
        id: guests[g.key].id,
        wedding_id: weddingId,
        invite_token: guests[g.key].token,
        first_name: g.firstName,
        email: `${g.key}-${run}@e2e.test`,
      }),
    );
    // As the guest's own link does once they've opened the welcome.
    if (g.welcomeSeen !== false) {
      must(await db.rpc("mark_welcome_seen", { p_token: guests[g.key].token }));
    }
    if (g.rsvp) {
      must(await db.from("rsvps").insert({ guest_id: guests[g.key].id, status: g.rsvp }));
    }
  }
  const [invited] = opts.household;
  for (const g of opts.household.slice(1)) {
    if (!g.relation) continue;
    must(
      await db.from("guest_relationships").insert({
        wedding_id: weddingId,
        from_guest: guests[invited.key].id,
        to_guest: guests[g.key].id,
        kind: g.relation,
      }),
    );
  }

  return { weddingId, owner: db, ownerSession: signedIn.data.session, forms, guests };
}

/** Hands the organiser's session to the app the way supabase-js stores it,
 *  before any page script runs. */
export async function signInAsOwner(page: Page, seeded: Seeded) {
  const storageKey = `sb-${new URL(e2eEnv().url).hostname.split(".")[0]}-auth-token`;
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, JSON.stringify(seeded.ownerSession)] as const,
  );
}

/** The couple's own wording of the faire-part as stored on the wedding. */
export async function fairePartCopy(seeded: Seeded) {
  const { data, error } = await seeded.owner.from("weddings").select("faire_part_copy").eq("id", seeded.weddingId).single();
  if (error) throw error;
  return data.faire_part_copy as Record<string, unknown>;
}

/** The answers on record for one guest of one form, or null. */
export async function answersOf(seeded: Seeded, formId: string, guestId: string) {
  const { data, error } = await seeded.owner
    .from("form_responses")
    .select("answers")
    .eq("form_id", formId)
    .eq("guest_id", guestId)
    .maybeSingle();
  if (error) throw error;
  return (data?.answers ?? null) as Record<string, unknown> | null;
}

export async function formQuestions(seeded: Seeded, formId: string) {
  const { data, error } = await seeded.owner.from("forms").select("questions").eq("id", formId).single();
  if (error) throw error;
  return data.questions as Question[];
}
