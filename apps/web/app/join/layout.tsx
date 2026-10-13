import { guestFontVariables } from "@/components/guest/fonts";

/**
 * The wedding's typefaces for the group link too, which opens on the same
 * faire-part as a personal link. `display: contents` keeps this wrapper out
 * of the layout.
 */
export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={guestFontVariables} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
