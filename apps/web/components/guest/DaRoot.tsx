import { GUEST_DA_VARS } from "@/lib/theme";

/** Hosts the stationery's colours (as CSS variables) for a guest screen. */
export function DaRoot({ children }: { children: React.ReactNode }) {
  return <div style={GUEST_DA_VARS as React.CSSProperties}>{children}</div>;
}
