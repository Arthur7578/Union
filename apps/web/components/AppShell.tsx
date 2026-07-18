"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import {
  TodayIcon,
  VendorsIcon,
  GuestsIcon,
  PlanIcon,
  Spark,
} from "./icons";

type NavKey = "today" | "vendors" | "union" | "guests" | "plan";

const ON = "#43353A";
const OFF = "#C1B4AD";

const TABS: {
  key: NavKey;
  label: string;
  href: string;
  match: string[];
  Icon?: (p: { size?: number; stroke?: string }) => React.ReactElement;
  center?: boolean;
}[] = [
  { key: "today", label: "Today", href: "/today", match: ["/today"], Icon: TodayIcon },
  { key: "vendors", label: "Vendors", href: "/vendors", match: ["/vendors"], Icon: VendorsIcon },
  { key: "union", label: "Union", href: "/vendors/search", match: ["/vendors/search"], center: true },
  { key: "guests", label: "Guests", href: "/guests", match: ["/guests"], Icon: GuestsIcon },
  { key: "plan", label: "Plan", href: "/plan", match: ["/plan"], Icon: PlanIcon },
];

function useActive(): NavKey {
  const path = usePathname() ?? "";
  if (path.startsWith("/vendors/search")) return "union";
  if (path.startsWith("/vendors")) return "vendors";
  if (path.startsWith("/guests")) return "guests";
  if (path.startsWith("/plan")) return "plan";
  return "today";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const active = useActive();
  const { signOut } = useAuth();
  const router = useRouter();

  const doSignOut = async () => {
    await signOut();
    router.replace("/sign-in");
  };

  return (
    <div className="u-app">
      {/* Desktop sidebar */}
      <aside className="u-sidebar">
        <Link
          href="/today"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 8px 4px",
            marginBottom: 26,
          }}
        >
          <Spark size={22} color={T.accent} />
          <span
            className="u-serif"
            style={{ fontSize: 26, fontWeight: 600, color: T.ink }}
          >
            Union
          </span>
        </Link>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {TABS.map((t) => {
            const isActive = active === t.key;
            return (
              <Link
                key={t.key}
                href={t.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 12px",
                  borderRadius: 13,
                  background: isActive ? T.accentSoft : "transparent",
                  color: isActive ? T.ink : T.muted2,
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                <span
                  style={{
                    width: 22,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  {t.center ? (
                    <Spark size={20} color={isActive ? T.accent : OFF} />
                  ) : t.Icon ? (
                    <t.Icon size={22} stroke={isActive ? ON : OFF} />
                  ) : null}
                </span>
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto" }}>
          <button
            onClick={doSignOut}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "11px 12px",
              borderRadius: 13,
              border: "none",
              background: "transparent",
              color: T.faint,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="u-shell">{children}</div>

      {/* Mobile bottom tab bar */}
      <nav className="u-tabbar">
        {TABS.map((t) => {
          const isActive = active === t.key;
          if (t.center) {
            return (
              <Link
                key={t.key}
                href={t.href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                  flex: 1,
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: "50%",
                    background: T.accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 7px 16px rgba(67,53,58,.24)",
                    marginTop: -9,
                  }}
                >
                  <Spark size={22} color="#fff" />
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 10,
                    color: isActive ? ON : "#BBACA5",
                  }}
                >
                  {t.label}
                </span>
              </Link>
            );
          }
          const Icon = t.Icon!;
          return (
            <Link
              key={t.key}
              href={t.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                flex: 1,
                textDecoration: "none",
              }}
            >
              <Icon size={24} stroke={isActive ? ON : OFF} />
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 10,
                  color: isActive ? ON : OFF,
                }}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
