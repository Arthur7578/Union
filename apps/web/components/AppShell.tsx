"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { T } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { useWedding } from "@/lib/wedding";
import { useT } from "@/lib/i18n/client";
import { initial } from "@/lib/format";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Avatar } from "./ui";
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

type Tab = {
  key: NavKey;
  href: string;
  match: string[];
  Icon?: (p: { size?: number; stroke?: string }) => React.ReactElement;
  center?: boolean;
};

const TABS: Tab[] = [
  { key: "today", href: "/today", match: ["/today"], Icon: TodayIcon },
  { key: "vendors", href: "/vendors", match: ["/vendors"], Icon: VendorsIcon },
  { key: "union", href: "/vendors/search", match: ["/vendors/search"], center: true },
  { key: "guests", href: "/guests", match: ["/guests"], Icon: GuestsIcon },
  { key: "plan", href: "/plan", match: ["/plan"], Icon: PlanIcon },
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
  const path = usePathname() ?? "";
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const { wedding } = useWedding();
  const router = useRouter();
  const dict = useT();

  const doSignOut = async () => {
    await signOut();
    router.replace("/sign-in");
  };

  const displayName = profile?.full_name || wedding?.partner_one || dict.account.title;
  const accountActive = path.startsWith("/account");

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
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
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
                  {tab.center ? (
                    <Spark size={20} color={isActive ? T.accent : OFF} />
                  ) : tab.Icon ? (
                    <tab.Icon size={22} stroke={isActive ? ON : OFF} />
                  ) : null}
                </span>
                {dict.nav[tab.key]}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <Link
            href="/account"
            title={dict.account.title}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px",
              borderRadius: 13,
              background: accountActive ? T.accentSoft : "transparent",
              textDecoration: "none",
            }}
          >
            <Avatar letter={initial(displayName)} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: T.ink,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {displayName}
              </div>
              <div style={{ fontSize: 11, color: T.faint }}>{dict.account.title}</div>
            </div>
          </Link>
          <div style={{ padding: "0 6px" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: T.faint,
                marginBottom: 8,
              }}
            >
              {dict.lang.switchTo}
            </div>
            <LanguageSwitcher />
          </div>
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
              cursor: "pointer",
            }}
          >
            {dict.common.signOut}
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="u-shell">{children}</div>

      {/* Mobile bottom tab bar */}
      <nav className="u-tabbar">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          if (tab.center) {
            return (
              <Link
                key={tab.key}
                href={tab.href}
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
                  {dict.nav[tab.key]}
                </span>
              </Link>
            );
          }
          const Icon = tab.Icon!;
          return (
            <Link
              key={tab.key}
              href={tab.href}
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
                {dict.nav[tab.key]}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
