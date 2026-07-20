import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { UserJot } from "@/components/UserJot";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

// Self-hosted fonts — no render-blocking <link>, zero layout shift.
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const SITE_URL = "https://union-silk.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Union",
  title: {
    default: "Union — Wedding planning",
    template: "%s · Union",
  },
  description:
    "Union plans the wedding with you — negotiates with vendors, tracks every deadline, and keeps you calm and in control.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Union",
    // Translucent bar lets our cream background flow under the status bar.
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Union",
    title: "Union — Wedding planning",
    description:
      "The AI that doesn't just help you plan the wedding — it negotiates with vendors, closes the deals, and keeps everything calmly under control.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Union — Wedding planning",
    description:
      "The AI that negotiates with vendors, tracks every deadline, and keeps you calm and in control.",
  },
};

export const viewport: Viewport = {
  themeColor: "#F2ECE5",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  // Draw under the notch / home indicator so safe-area insets work edge-to-edge.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        {children}
        <UserJot />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
