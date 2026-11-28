import type { AnsweredRsvpStatus, RsvpStatus } from "./rsvpAnswers";

/**
 * The guest's answer in one line, as the hub's RSVP card shows it once they
 * have replied.
 *
 * A household names each person who has been answered for ("Arthur : Présent,
 * Guinevere : Absent"), so it is clear whose answer is whose. A guest invited
 * alone reads their own answer, without their name in front: the card is
 * theirs, and "Léa : Je ne pourrai pas venir" reads as someone else talking.
 *
 * "Alone" means no companions on the invitation, not "nobody else has
 * replied": a guest whose partner hasn't been answered for keeps their name,
 * which says the answer only covers them so far. So `companions` must be the
 * whole list, pending ones included.
 *
 * Labels come in already resolved (the couple's wording or Union's default),
 * so this never rewrites what the couple wrote. Only call it for a guest who
 * has replied.
 */
export function rsvpCardLine(opts: {
  guest: { name: string; status: AnsweredRsvpStatus };
  companions: Array<{ name: string; status: RsvpStatus }>;
  label: (status: AnsweredRsvpStatus) => string;
  locale: string;
}): string {
  const { guest, companions, label, locale } = opts;
  if (companions.length === 0) return label(guest.status);
  return [guest, ...companions]
    .filter((p): p is { name: string; status: AnsweredRsvpStatus } => p.status !== "pending")
    .map((p) => `${p.name}${locale === "fr" ? " :" : ":"} ${label(p.status)}`)
    .join(", ");
}
