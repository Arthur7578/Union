"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LocaleToggle } from "@/components/guest/LocaleToggle";
import { useReplayWelcome } from "@/components/guest/WelcomeGate";
import { useLocale } from "@/lib/i18n/client";
import { getBrowserSupabase } from "@/lib/supabaseClient";

/**
 * The page's top bar: the couple's monogram, the language toggle, and a menu
 * to see the faire-part again or, for a signed-in guest, to sign out.
 */
export function PageTopBar({
  partnerOne,
  partnerTwo,
  isDemo,
}: {
  partnerOne: string | null | undefined;
  partnerTwo: string | null | undefined;
  isDemo: boolean;
}) {
  const replayWelcome = useReplayWelcome();
  const { t } = useLocale();
  const hub = t.guestHub;
  const router = useRouter();
  const coupleNames = `${partnerOne} & ${partnerTwo}`;
  const [hasAuthSession, setHasAuthSession] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = getBrowserSupabase();
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setHasAuthSession(Boolean(data.session));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setHasAuthSession(Boolean(session));
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // The menu closes on any tap outside it, and on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleGuestSignOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await getBrowserSupabase().auth.signOut({ scope: "local" });
      if (error) throw error;
      router.push("/");
    } catch (error) {
      console.error("Failed to sign out guest:", error);
      setSigningOut(false);
    }
  };

  return (
    <header className="gh-top">
      <span className="gh-mono" aria-label={coupleNames}>
        {partnerOne?.charAt(0)}
        <i aria-hidden="true" />
        {partnerTwo?.charAt(0)}
      </span>
      <div className="gh-top-actions">
        <LocaleToggle />
        {(replayWelcome || (hasAuthSession && !isDemo)) && (
          <div className="gh-menu" ref={menuRef}>
            <button
              type="button"
              className="gh-menu-btn"
              aria-label={hub.menu}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 9h14M5 15h14" />
              </svg>
            </button>
            {menuOpen && (
              <div className="gh-menu-pop" role="menu">
                {replayWelcome && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      replayWelcome();
                    }}
                  >
                    {t.welcome.seeAgain}
                  </button>
                )}
                {hasAuthSession && !isDemo && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={signingOut}
                    onClick={() => void handleGuestSignOut()}
                  >
                    {signingOut ? t.common.signingOut : t.common.signOut}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
