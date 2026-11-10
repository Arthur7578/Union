import { Caprasimo, Nunito } from "next/font/google";

/**
 * The Garden marquee faces, loaded only by the Guests hub and list.
 * Caprasimo: soft, round, joyful display for titles and numbers.
 * Nunito: a rounded, legible interface face that carries French accents well.
 */
const display = Caprasimo({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mq-display",
  display: "swap",
});

const sans = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-mq-sans",
  display: "swap",
});

/** Put on the page's root element: sets both font variables and the world. */
export const marqueeClass = `mq ${display.variable} ${sans.variable}`;
