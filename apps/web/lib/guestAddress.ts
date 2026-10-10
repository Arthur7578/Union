import type { Invitation } from "@union/shared";

/** The most precise place name a guest may read, and which kind it is. */
export interface GuestZone {
  kind: "area" | "city";
  name: string;
}

/**
 * The "zone" of the wedding for the faire-part ("En Provence"): the area, or
 * when there is none the city, and nothing when neither is disclosed. The
 * country alone is never enough, and the postal code and street are too
 * precise for a headline. Like `formatGuestAddress`, this follows the
 * visibility tier so a hidden address can never leak into the card.
 */
export function guestZone(
  wedding: Pick<Invitation["wedding"], "address" | "address_visibility">,
): GuestZone | null {
  const address = wedding.address;
  if (!address) return null;
  const tier = wedding.address_visibility;
  const area = tier === "area" ? address.area?.trim() : "";
  if (area) return { kind: "area", name: area };
  const city = tier === "partial" || tier === "full" ? address.city?.trim() : "";
  if (city) return { kind: "city", name: city };
  return null;
}

/**
 * The venue address as a guest may read it. The RPC removes every field the
 * couple has not chosen to disclose. This still switches on the visibility
 * tier so the guest UI cannot accidentally reintroduce area into precise
 * addresses later.
 */
export function formatGuestAddress(
  wedding: Pick<Invitation["wedding"], "address" | "address_visibility">,
): string {
  const address = wedding.address;
  if (!address) return "";
  const cityAndPostalCode = address.city
    ? `${address.city}${address.postal_code ? ` (${address.postal_code})` : ""}`
    : address.postal_code
      ? `(${address.postal_code})`
      : "";
  const parts =
    wedding.address_visibility === "area"
      ? [address.area, address.country]
      : wedding.address_visibility === "partial"
        ? [cityAndPostalCode, address.country]
        : wedding.address_visibility === "full"
          ? [address.line, cityAndPostalCode, address.country]
          : [];
  return parts.filter(Boolean).join(", ");
}
