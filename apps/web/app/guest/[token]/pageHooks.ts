"use client";

import { useEffect, useState } from "react";

/** Whole days until the wedding (0 on the day), refreshed every minute; null
 *  without a date and once the day has passed. */
export function useDaysLeft(eventDate: string | null | undefined) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    if (!eventDate) return;
    const target = new Date(`${eventDate}T00:00:00`).getTime();
    const update = () => {
      const left = Math.ceil((target - Date.now()) / 86_400_000);
      setDays(left >= 0 ? left : null);
    };
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [eventDate]);
  return days;
}

/** Whether an element is on screen, for the dock to step aside. */
export function useInView<E extends Element>() {
  const [el, setEl] = useState<E | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!el || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "0px 0px -15% 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, inView] as const;
}

/** Which section is on screen, for the section bar. */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    if (typeof IntersectionObserver !== "function") return;
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
        const first = key.split(",").find((id) => seen.get(id));
        setActive(first ?? null);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    key.split(",").forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [key]);
  return active;
}
