import { guestFontVariables } from "./_fonts";

/**
 * Makes the wedding's typefaces available to every guest page, as CSS
 * variables. `display: contents` keeps this wrapper out of the layout.
 */
export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={guestFontVariables} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
