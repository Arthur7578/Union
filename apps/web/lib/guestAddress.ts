import type { Invitation } from "@union/shared";

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
