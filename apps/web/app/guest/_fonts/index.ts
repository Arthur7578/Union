import localFont from "next/font/local";

/**
 * The guest experience's two typefaces, from the couple's stationery:
 * Exmouth (a script) for titles, EB Garamond for subtitles and text.
 *
 * Self-hosted so a guest's phone never waits on a third-party font host. The
 * Exmouth folder ships unchanged, notes included: its free licence allows
 * passing the font on only as long as nothing in that folder is changed or
 * missing. EB Garamond is under the SIL Open Font License (OFL.txt); the
 * woff2 files are the 0.016 TTFs recompressed, glyphs untouched.
 */
export const guestScript = localFont({
  src: "./exmouth/exmouth_.ttf",
  variable: "--font-guest-script",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const guestSerif = localFont({
  src: [
    { path: "./eb-garamond/EBGaramond12-Regular.woff2", weight: "400", style: "normal" },
    { path: "./eb-garamond/EBGaramond12-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-guest-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

/** Both font variables, for the element that hosts the guest experience. */
export const guestFontVariables = `${guestScript.variable} ${guestSerif.variable}`;
