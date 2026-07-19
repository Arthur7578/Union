import type { Metadata } from "next";
import "./globals.css";
import { UserJot } from "@/components/UserJot";
import { AuthErrorNotice } from "@/components/AuthErrorNotice";

export const metadata: Metadata = {
  title: "Union — Wedding planning",
  description:
    "Union plans the wedding with you — negotiates with vendors, tracks every deadline, and keeps you calm and in control.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Instrument+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <AuthErrorNotice />
        <UserJot />
      </body>
    </html>
  );
}
