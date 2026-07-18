import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Union — RSVP",
  description: "Respond to your wedding invitation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
