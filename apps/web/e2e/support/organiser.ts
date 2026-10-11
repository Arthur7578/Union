import { test as base, expect } from "@playwright/test";
import {
  fakeUser,
  installFakeSupabase,
  type FakeSupabase,
  type Row,
  type Tables,
} from "./fakeSupabase";

const USER = fakeUser("user-organiser", "maya@example.com");
const WEDDING_ID = "wedding-1";
const CREATED = "2026-01-01T00:00:00Z";

const guest = (id: string, first: string, last: string, extra: Row = {}): Row => ({
  id,
  wedding_id: WEDDING_ID,
  first_name: first,
  last_name: last,
  email: null,
  phone: null,
  phone_e164: null,
  age_years: 30,
  guest_group: null,
  invite_token: `token-${id}`,
  seating_table_id: null,
  room_block_id: null,
  ceremony_row: null,
  ceremony_side: null,
  role: null,
  notes: null,
  locale: null,
  chosen_locale: null,
  profile_id: null,
  added_by_guest_id: null,
  can_add_kids: null,
  can_add_partner: null,
  email_source: null,
  email_confirmed_at: null,
  welcome_seen_at: null,
  rsvp_reminder_sent_at: null,
  created_at: CREATED,
  ...extra,
});

const table = (id: string, name: string, sort: number, extra: Row = {}): Row => ({
  id,
  wedding_id: WEDDING_ID,
  name,
  capacity: 4,
  x_pct: 30 + sort * 20,
  y_pct: 50,
  tone: "accent",
  is_head: false,
  shape: "round",
  sort_order: sort,
  created_at: CREATED,
  ...extra,
});

/** One wedding with a few tables, groups and guests in different states:
 *  seated, unseated, declined, and in one or two groups. */
export const WEDDING_FIXTURE: Tables = {
  profiles: [{ id: USER.id, full_name: "Maya", phone: null, created_at: CREATED }],
  weddings: [
    {
      id: WEDDING_ID,
      owner_id: USER.id,
      partner_one: "Maya",
      partner_two: "Daniel",
      event_date: "2027-06-19",
      venue_name: "Wildflower Barn",
      venue_address: null,
      address_line: null,
      address_postal_code: null,
      address_city: null,
      address_area: null,
      address_country: null,
      address_visibility: "full",
      allow_guests_add_children: false,
      allow_guests_add_partner: false,
      max_children_per_guest: null,
      guest_count_target: null,
      autonomy: "ask",
      ceremony_rows: 8,
      ceremony_reserved_rows: 2,
      default_locale: "en",
      guest_join_auth_mode: "light",
      guest_modules: {},
      join_code: "JOINME",
      rsvp_form_questions: null,
      sms_brevo_api_key: null,
      sms_sender: null,
      sms_template: null,
      style_vibe: null,
      created_at: CREATED,
    },
  ],
  guest_groups: [
    { id: "group-family", wedding_id: WEDDING_ID, name: "Family", color: null, sort_order: 0, created_at: CREATED },
    { id: "group-friends", wedding_id: WEDDING_ID, name: "Friends", color: null, sort_order: 1, created_at: CREATED },
  ],
  guests: [
    guest("g-ana", "Ana", "Costa", { guest_group: "Family", seating_table_id: "t-1" }),
    guest("g-ben", "Ben", "Martin", { guest_group: "Family", seating_table_id: "t-1" }),
    guest("g-chloe", "Chloé", "Dubois", { guest_group: "Friends" }),
    guest("g-david", "David", "Okafor", { guest_group: "Friends" }),
    guest("g-eva", "Eva", "Lindqvist"),
    guest("g-farid", "Farid", "Haddad", { guest_group: "Friends" }),
  ],
  guest_group_members: [
    { id: "m-1", guest_id: "g-ana", group_id: "group-family" },
    { id: "m-2", guest_id: "g-ben", group_id: "group-family" },
    { id: "m-3", guest_id: "g-chloe", group_id: "group-friends" },
    { id: "m-4", guest_id: "g-david", group_id: "group-friends" },
    { id: "m-5", guest_id: "g-farid", group_id: "group-friends" },
    // Chloé is also family, so multi-group membership is exercised.
    { id: "m-6", guest_id: "g-chloe", group_id: "group-family" },
  ],
  rsvps: [
    { id: "r-1", guest_id: "g-ana", status: "attending", dietary_notes: null, message: null, responded_at: CREATED },
    { id: "r-2", guest_id: "g-ben", status: "attending", dietary_notes: "Vegetarian", message: null, responded_at: CREATED },
    { id: "r-3", guest_id: "g-farid", status: "declined", dietary_notes: null, message: null, responded_at: CREATED },
  ],
  seating_tables: [
    table("t-1", "Table Lavender", 0),
    table("t-2", "Table Olive", 1),
    table("t-head", "Head table", 2, { is_head: true, shape: "rect", capacity: 6 }),
  ],
  room_blocks: [],
  guest_relationships: [],
  forms: [],
  wedding_collaborators: [],
  activity_log: [],
};

type Fixtures = {
  /** Signs the browser in as the organiser of {@link WEDDING_FIXTURE} and
   *  returns the in-memory database behind it. */
  supabase: FakeSupabase;
};

export const test = base.extend<Fixtures>({
  // Automatic: every spec in this suite is an organiser, signed in, whether or
  // not it also wants to inspect the database.
  supabase: [async ({ context }, use) => {
    const fake = await installFakeSupabase(context, {
      tables: WEDDING_FIXTURE,
      user: USER,
    });
    await use(fake);
    // A request the fake could not answer means the page asked for something
    // these specs don't model: surface it rather than test an empty screen.
    expect(fake.unhandled, "requests the fake Supabase did not handle").toEqual([]);
  }, { auto: true }],
});

export { expect };
