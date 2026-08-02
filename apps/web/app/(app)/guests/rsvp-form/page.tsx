"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWedding } from "@/lib/wedding";
import { fetchForms } from "@/lib/data";
import { BackHeader } from "@/components/BackHeader";
import { Loading } from "@/components/ui";

/**
 * The RSVP form now lives under the Forms hub, as one form among several.
 * This route stays as a redirect so old links and bookmarks keep working.
 */
export default function RsvpFormRedirectPage() {
  const { wedding } = useWedding();
  const router = useRouter();

  useEffect(() => {
    if (!wedding) return;
    let ok = true;
    fetchForms(wedding.id)
      .then((forms) => {
        if (!ok) return;
        const rsvp = forms.find((f) => f.kind === "rsvp");
        router.replace(rsvp ? `/guests/forms/${rsvp.id}` : "/guests/forms");
      })
      .catch(() => ok && router.replace("/guests/forms"));
    return () => {
      ok = false;
    };
  }, [wedding, router]);

  return (
    <main className="u-main">
      <BackHeader title="RSVP form" fallback="/guests" />
      <Loading />
    </main>
  );
}
