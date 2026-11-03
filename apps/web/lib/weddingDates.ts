import type { Locale } from "./i18n";

/**
 * The wedding's dates as the faire-part writes them: "11 — 13 juin 2027" on
 * the front, "du 11 au 13 juin 2027" in a sentence. A wedding has a start date
 * and, when it lasts more than a day, an end date. Without a usable end date
 * (missing, malformed, or not after the start) it is a single day.
 */
export interface WeddingDateText {
  /** "12 juin 2027" or "11 — 13 juin 2027". */
  short: string;
  /** "le 12 juin 2027" or "du 11 au 13 juin 2027". */
  spoken: string;
  /** Number of days the wedding lasts, counting both ends (at least 1). */
  days: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTHS = {
  fr: [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ],
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
} as const;

interface Ymd {
  y: number;
  m: number; // 0-based
  d: number;
}

function parse(iso: string | null | undefined): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const check = new Date(Date.UTC(y, m, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m && check.getUTCDate() === d
    ? { y, m, d }
    : null;
}

const utc = ({ y, m, d }: Ymd) => Date.UTC(y, m, d);

export function weddingDateText(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: Locale,
): WeddingDateText | null {
  const a = parse(start);
  if (!a) return null;
  const parsedEnd = parse(end);
  const b = parsedEnd && utc(parsedEnd) > utc(a) ? parsedEnd : null;

  const fr = locale === "fr";
  const months = MONTHS[fr ? "fr" : "en"];
  const day = (n: number) => (fr && n === 1 ? "1er" : String(n));
  // "12 juin 2027" / "June 12, 2027", with the parts a range shares left out.
  const date = (x: Ymd, o: { month?: boolean; year?: boolean } = {}) => {
    const { month = true, year = true } = o;
    if (fr) return [day(x.d), month && months[x.m], year && x.y].filter(Boolean).join(" ");
    return `${month ? `${months[x.m]} ` : ""}${x.d}${year ? `, ${x.y}` : ""}`;
  };

  if (!b) {
    const one = date(a);
    return { short: one, spoken: fr ? `le ${one}` : `on ${one}`, days: 1 };
  }

  const days = Math.round((utc(b) - utc(a)) / MS_PER_DAY) + 1;
  const sameYear = a.y === b.y;
  const sameMonth = sameYear && a.m === b.m;
  // French says the month once, after the last day ("11 — 13 juin 2027");
  // English says it before the first ("June 11 — 13, 2027").
  const first = date(a, { month: fr ? !sameMonth : true, year: !sameYear });
  const last = date(b, { month: fr || !sameMonth });
  return {
    short: `${first} — ${last}`,
    spoken: fr ? `du ${first} au ${last}` : `from ${first} to ${last}`,
    days,
  };
}
