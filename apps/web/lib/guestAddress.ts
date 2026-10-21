import type { Invitation } from "@union/shared";
import type { GuestPlace } from "./fairePart";

/**
 * The parts of the address a faire-part may mention ({{venue}}, {{area}},
 * {{city}}, {{country}}). Like `formatGuestAddress`, this follows the
 * visibility tier, so a hidden address can never leak into the card and a
 * tier never shows more than the couple chose. The street and postal code are
 * too precise for a card and are not offered.
 */
export function guestPlaceFields(
  wedding: Pick<Invitation["wedding"], "address" | "address_visibility"> & { venue_name?: string | null },
): GuestPlace {
  const tier = wedding.address_visibility;
  const address = wedding.address;
  const text = (v: string | null | undefined) => v?.trim() ?? "";
  return {
    venue: tier === "full" ? text(wedding.venue_name) : "",
    area: address && tier === "area" ? text(address.area) : "",
    city: address && (tier === "partial" || tier === "full") ? text(address.city) : "",
    country: address && tier !== "hidden" ? text(address.country) : "",
  };
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
