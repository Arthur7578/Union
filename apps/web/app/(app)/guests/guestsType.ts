import { Hanken_Grotesk } from "next/font/google";

/**
 * The Guests hub and list's one face: a calm, neutral grotesque that takes no
 * wedding style of its own (see PRODUCT.md, principle 5).
 */
const grotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-vc",
  display: "swap",
});

/** On the page's root element, with `gu-main`. */
export const guestsTypeClass = `gu-world ${grotesk.variable}`;
