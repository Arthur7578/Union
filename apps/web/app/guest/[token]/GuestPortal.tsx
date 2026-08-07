"use client";

import React, { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getSupabase } from "@/lib/supabase";
import type { FormAnswers, RsvpQuestion } from "@union/shared";
import type { DBInvitation } from "./page";

interface GuestPortalProps {
  token: string;
  invitation: DBInvitation;
  isDemo: boolean;
}

// Beautiful simulated database for guest connections (carsharing/travel buddy matches)
const SAMPLE_CONNECTIONS = [
  {
    id: "match-1",
    name: "John & Sarah",
    from: "NYC / Brooklyn",
    date: "Sept 18",
    method: "Driving (SUV)",
    hasSeats: true,
    seatsAvailable: 3,
    notes: "Leaving late afternoon. Happy to pick up along I-84/I-90!",
    sharedContact: false,
    requested: false,
  },
  {
    id: "match-2",
    name: "Emma Watson",
    from: "Portland Airport (PDX)",
    date: "Sept 19",
    method: "Carsharing / Car Rental",
    hasSeats: true,
    seatsAvailable: 2,
    notes: "Arriving around 2 PM. Looking to split a rental car to Hood River.",
    sharedContact: false,
    requested: false,
  },
  {
    id: "match-3",
    name: "Michael Chen",
    from: "Boston, MA",
    date: "Sept 19",
    method: "Flight / Carpool",
    hasSeats: false,
    seatsAvailable: 0,
    notes: "Landing PDX at 11 AM. Looking for a ride to the venue/stays.",
    sharedContact: false,
    requested: false,
  }
];

// High-end curated stays recommendation list
const STAYS = [
  {
    name: "Hood River Hood Hotel",
    type: "Boutique Hotel",
    distance: "12 min from venue",
    price: "$$$",
    rating: "4.8 ★",
    desc: "A gorgeous, historic brick boutique hotel in the heart of downtown Hood River with modern amenities.",
    url: "https://www.hoodriverhotel.com",
    badge: "Recommended Stay"
  },
  {
    name: "Columbia Gorge Hotel & Spa",
    type: "Luxury Resort & Spa",
    distance: "15 min from venue",
    price: "$$$$",
    rating: "4.9 ★",
    desc: "A beautiful, premium resort perched on a cliff overlooking the mighty Columbia River.",
    url: "https://www.columbiagorgehotel.com",
    badge: "Premium Choice"
  },
  {
    name: "Westcliff Lodge",
    type: "Cabins & Lodge",
    distance: "14 min from venue",
    price: "$$",
    rating: "4.6 ★",
    desc: "Secluded forest cabins and lodge rooms with spectacular views of the gorge. Ideal for families.",
    url: "https://www.westclifflodge.com",
    badge: "Great Views"
  }
];

export function GuestPortal({ token, invitation, isDemo }: GuestPortalProps) {
  const { t, locale } = useLocale();

  const [activeTab, setActiveTab] = useState<"forms" | "travel" | "logistics" | "faq">("forms");

  // Multi-Form Expose and Modal states
  const [activeFormModal, setActiveFormModal] = useState<"rsvp" | "preferences" | "recheck" | null>(null);
  // Which wording the RSVP modal shows — the primary ask, or the later
  // reconfirmation nudge. Same state, same submit, only the framing differs.
  const [rsvpModalContext, setRsvpModalContext] = useState<"primary" | "reconfirmation">("primary");

  // Separate forms submission & state storage
  // Form 1: RSVP state
  const [primaryRsvp, setPrimaryRsvp] = useState<"pending" | "attending" | "declined">(invitation.guest.rsvp_status);
  const [primaryDietary, setPrimaryDietary] = useState<string>(invitation.guest.dietary_notes || "");
  const [primaryMessage, setPrimaryMessage] = useState<string>(invitation.guest.message || "");

  // Companions — local state (not just the invitation prop) so a guest who
  // adds a partner/child mid-RSVP sees them appear immediately.
  const [companions, setCompanions] = useState(invitation.companions);

  // Companions RSVP state
  const [companionsRsvp, setCompanionsRsvp] = useState<Record<string, { rsvp_status: "pending" | "attending" | "declined"; dietary_notes: string }>>(
    companions.reduce((acc, companion) => {
      acc[companion.id] = {
        rsvp_status: companion.rsvp_status,
        dietary_notes: companion.dietary_notes || "",
      };
      return acc;
    }, {} as Record<string, { rsvp_status: "pending" | "attending" | "declined"; dietary_notes: string }>)
  );

  // Add-a-relative flow (partner/child), backed by the existing
  // rsvp_register_companion RPC — permissions + dedup already enforced
  // server-side, this just wires a UI onto a contract that already exists.
  const [addCompanionKind, setAddCompanionKind] = useState<"partner" | "child" | null>(null);
  const [addCompanionFirst, setAddCompanionFirst] = useState("");
  const [addCompanionLast, setAddCompanionLast] = useState("");
  const [addCompanionBusy, setAddCompanionBusy] = useState(false);
  const [addCompanionError, setAddCompanionError] = useState<string | null>(null);
  const [addCompanionCandidates, setAddCompanionCandidates] = useState<DBInvitation["self_merge_candidates"] | null>(null);
  const [kidsRemaining, setKidsRemaining] = useState<number | null>(invitation.permissions.kids_remaining);

  // Custom forms (organiser-authored, free-form questions) — one guest
  // response per form, kept local so a fresh submit updates the card
  // immediately without a full page reload.
  const [customForms, setCustomForms] = useState(invitation.custom_forms ?? []);
  const [activeCustomFormId, setActiveCustomFormId] = useState<string | null>(null);
  const [customDraft, setCustomDraft] = useState<FormAnswers>({});
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Form 2: Preferences state
  const [prefSong, setPrefSong] = useState<string>("");
  const [prefMeal, setPrefMeal] = useState<string>("");
  const [preferencesSaved, setPreferencesSaved] = useState<boolean>(false);

  // Form 3: Re-check state
  const [recheckArrival, setRecheckArrival] = useState<string>("");
  const [recheckHotel, setRecheckHotel] = useState<string>("");
  const [recheckSaved, setRecheckSaved] = useState<boolean>(false);

  // Loading/submitting states
  const [submittingRsvp, setSubmittingRsvp] = useState<boolean>(false);
  const [submittingPrefs, setSubmittingPrefs] = useState<boolean>(false);
  const [submittingRecheck, setSubmittingRecheck] = useState<boolean>(false);

  // Travel matching state
  const [connections, setConnections] = useState(SAMPLE_CONNECTIONS);
  const [guestFrom, setGuestFrom] = useState("");
  const [guestSeats, setGuestSeats] = useState("0");
  const [guestMethod, setGuestMethod] = useState("Driving");
  const [guestNotes, setGuestNotes] = useState("");
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0 });

  // Update Countdown timer
  useEffect(() => {
    const targetDate = invitation.wedding.event_date ? new Date(`${invitation.wedding.event_date}T00:00:00`) : new Date("2026-09-20T16:00:00");

    const updateCountdown = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, mins: 0 });
        return;
      }

      const d = Math.floor(difference / (1000 * 60 * 60 * 24));
      const h = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const m = Math.floor((difference / 1000 / 60) % 60);

      setTimeLeft({ days: d, hours: h, mins: m });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [invitation.wedding.event_date]);

  // Submissions
  const handleSaveRsvp = async () => {
    setSubmittingRsvp(true);
    try {
      if (!isDemo) {
        const supabase = getSupabase();

        // 1. Submit RSVP for primary guest
        const { error: primaryError } = await supabase.rpc("submit_rsvp", {
          p_token: token,
          p_status: primaryRsvp,
          p_dietary_notes: primaryDietary.trim() || undefined,
          p_message: primaryMessage.trim() || undefined,
        });
        if (primaryError) throw primaryError;

        // 2. Submit RSVPs for all companions (only if they made a choice!)
        for (const companion of companions) {
          const companionState = companionsRsvp[companion.id];
          if (companionState && companionState.rsvp_status !== "pending") {
            const { error: companionError } = await supabase.rpc("submit_companion_rsvp", {
              p_token: token,
              p_companion_guest_id: companion.id,
              p_status: companionState.rsvp_status,
              p_dietary_notes: companionState.dietary_notes.trim() || undefined,
            });
            if (companionError) throw companionError;
          }
        }
      }

      // RSVP submitted successfully.

      // Update companions' statuses in invitation object
      companions.forEach(c => {
        if (companionsRsvp[c.id]) {
          c.rsvp_status = companionsRsvp[c.id].rsvp_status;
          c.dietary_notes = companionsRsvp[c.id].dietary_notes;
        }
      });

      setActiveFormModal(null);
    } catch (e) {
      console.error("Failed to submit RSVP:", e);
      alert("Error saving RSVP. Please try again.");
    } finally {
      setSubmittingRsvp(false);
    }
  };

  const handleSavePrefs = async () => {
    setSubmittingPrefs(true);
    // Simulate remote server saving
    await new Promise((resolve) => setTimeout(resolve, 800));
    setPreferencesSaved(true);
    setActiveFormModal(null);
    setSubmittingPrefs(false);
  };

  const handleSaveRecheck = async () => {
    setSubmittingRecheck(true);
    // Simulate remote server saving
    await new Promise((resolve) => setTimeout(resolve, 800));
    setRecheckSaved(true);
    setActiveFormModal(null);
    setSubmittingRecheck(false);
  };

  const handleContactRequest = (matchId: string) => {
    setConnections(prev =>
      prev.map(item =>
        item.id === matchId ? { ...item, requested: true } : item
      )
    );
    setActiveModal(matchId);
  };

  const handleAddMyTravel = () => {
    if (!guestFrom.trim()) return;

    const newConnection = {
      id: `match-custom-${Date.now()}`,
      name: `${invitation.guest.first_name} ${invitation.guest.last_name || ""}`.trim(),
      from: guestFrom,
      date: "Sept 19",
      method: guestMethod,
      hasSeats: Number(guestSeats) > 0,
      seatsAvailable: Number(guestSeats),
      notes: guestNotes || "Happy to pool travel/share a ride!",
      sharedContact: true,
      requested: false,
    };

    setConnections([newConnection, ...connections]);
    setGuestFrom("");
    setGuestSeats("0");
    setGuestNotes("");
  };

  const coupleNames = `${invitation.wedding.partner_one} & ${invitation.wedding.partner_two}`;
  const displayDate = invitation.wedding.event_date ? new Date(`${invitation.wedding.event_date}T00:00:00`).toLocaleDateString(
    locale === "fr" ? "fr-FR" : "en-US",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  ) : "Saturday, September 20, 2026";

  // The RPC removes every field the couple has not chosen to disclose. The
  // formatter still switches on the visibility tier so the guest UI cannot
  // accidentally reintroduce area into precise addresses later.
  const address = invitation.wedding.address;
  const cityAndPostalCode = address?.city
    ? `${address.city}${address.postal_code ? ` (${address.postal_code})` : ""}`
    : address?.postal_code
      ? `(${address.postal_code})`
      : "";
  const addressParts = address
    ? invitation.wedding.address_visibility === "area"
      ? [address.area, address.country]
      : invitation.wedding.address_visibility === "partial"
        ? [cityAndPostalCode, address.country]
        : invitation.wedding.address_visibility === "full"
          ? [address.line, cityAndPostalCode, address.country]
          : []
    : [];
  const addressText = addressParts.filter(Boolean).join(", ");
  const guestLocationSummary = invitation.wedding.venue_name || addressText;
  const addressPending = locale === "fr"
    ? "L'adresse complète sera communiquée prochainement."
    : "The full address will be shared closer to the date.";

  // Form Locking Logic helper
  const isDeclined = primaryRsvp === "declined";
  const isPending = primaryRsvp === "pending";

  // RSVP block wording — an organiser override if they've set one, else the
  // system default copy. This is the *only* thing an override can change:
  // which rsvp_status a button submits is fixed in code, never in wording.
  const rsvpTitle = invitation.rsvp_form?.title
    || (locale === "fr" ? "RSVP de Présence" : "Attendance RSVP");
  const rsvpSubtitle = invitation.rsvp_form?.subtitle
    || (locale === "fr" ? "Confirmez votre venue et celle de vos proches." : "Let us know if you and your companions will join us.");
  const labelAttending = invitation.rsvp_form?.label_attending
    || (locale === "fr" ? "Présent" : "Attending");
  const labelDeclined = invitation.rsvp_form?.label_declined
    || (locale === "fr" ? "Absent" : "Declined");

  // The optional late "still coming?" touchpoint — same RSVP block, shown
  // only when the organiser has published it and it's within its window.
  const reconfirmation = invitation.rsvp_reconfirmation ?? null;
  const now = new Date();
  const reconfirmationLive = !!reconfirmation?.published
    && (!reconfirmation.opens_at || new Date(reconfirmation.opens_at) <= now)
    && (!reconfirmation.closes_at || new Date(reconfirmation.closes_at) >= now);
  const reconfirmTitle = reconfirmation?.title
    || (locale === "fr" ? "Tu viens toujours ?" : "Still coming?");
  const reconfirmSubtitle = reconfirmation?.subtitle
    || (locale === "fr" ? "Un point rapide avant le grand jour — confirme ou ajuste ta réponse." : "A quick check-in before the big day — confirm or update your RSVP.");

  const openRsvpModal = (context: "primary" | "reconfirmation") => {
    setRsvpModalContext(context);
    setActiveFormModal("rsvp");
  };

  // A custom form's live/scheduled/closed state is the same published +
  // opens_at/closes_at window logic the admin's formStatus() uses — only
  // published forms ever reach the guest, so there's no "draft" case here.
  const customFormState = (f: NonNullable<DBInvitation["custom_forms"]>[number]): "scheduled" | "live" | "closed" => {
    if (f.opens_at && new Date(f.opens_at) > now) return "scheduled";
    if (f.closes_at && new Date(f.closes_at) < now) return "closed";
    return "live";
  };

  const activeCustomForm = customForms.find((f) => f.id === activeCustomFormId) ?? null;

  const openCustomForm = (formId: string) => {
    const f = customForms.find((cf) => cf.id === formId);
    setCustomDraft(f?.answers ?? {});
    setCustomError(null);
    setActiveCustomFormId(formId);
  };

  const handleSubmitCustomForm = async () => {
    if (!activeCustomForm) return;
    const questions = activeCustomForm.questions;
    const missing = questions.some((q) => {
      if (!q.required) return false;
      const v = customDraft[q.id];
      return Array.isArray(v) ? v.length === 0 : !v || !v.trim();
    });
    if (missing) {
      setCustomError(locale === "fr" ? "Merci de répondre aux questions obligatoires." : "Please answer the required questions.");
      return;
    }
    setCustomSubmitting(true);
    setCustomError(null);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.rpc("submit_form_response", {
        p_token: token,
        p_form_id: activeCustomForm.id,
        p_answers: customDraft,
      });
      if (error) throw error;
      setCustomForms((prev) => prev.map((f) => (f.id === activeCustomForm.id ? { ...f, answers: customDraft } : f)));
      setActiveCustomFormId(null);
    } catch (e) {
      setCustomError(e instanceof Error ? e.message : (locale === "fr" ? "Erreur lors de l'enregistrement." : "Couldn't save your answers."));
    } finally {
      setCustomSubmitting(false);
    }
  };

  // A guest may add at most one partner (hide the option once they have
  // one); children have no such cap here, only the wedding's kids budget.
  const canAddPartner = invitation.permissions.can_add_partner && !companions.some((c) => c.relationship === "partner_of");
  const canAddKids = invitation.permissions.can_add_kids && (kidsRemaining === null || kidsRemaining > 0);

  const cancelAddCompanion = () => {
    setAddCompanionKind(null);
    setAddCompanionFirst("");
    setAddCompanionLast("");
    setAddCompanionCandidates(null);
    setAddCompanionError(null);
  };

  const submitAddCompanion = async (resolve: "auto" | "force_create" = "auto") => {
    if (!addCompanionKind) return;
    const first = addCompanionFirst.trim();
    if (!first) {
      setAddCompanionError(locale === "fr" ? "Le prénom est requis." : "First name is required.");
      return;
    }
    setAddCompanionBusy(true);
    setAddCompanionError(null);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("rsvp_register_companion", {
        p_token: token,
        p_kind: addCompanionKind,
        p_first_name: first,
        p_last_name: addCompanionLast.trim() || undefined,
        p_resolve: resolve,
      });
      if (error) throw error;
      const result = data as {
        status: "candidates" | "created";
        candidates?: DBInvitation["self_merge_candidates"];
        guest_id?: string;
      };
      if (result.status === "candidates") {
        setAddCompanionCandidates(result.candidates ?? []);
        return;
      }
      const newCompanion = {
        id: result.guest_id as string,
        first_name: first,
        last_name: addCompanionLast.trim() || null,
        age_years: null,
        relationship: (addCompanionKind === "partner" ? "partner_of" : "parent_of") as "partner_of" | "parent_of",
        rsvp_status: "pending" as const,
        dietary_notes: null,
      };
      setCompanions((prev) => [...prev, newCompanion]);
      setCompanionsRsvp((prev) => ({ ...prev, [newCompanion.id]: { rsvp_status: "pending", dietary_notes: "" } }));
      if (addCompanionKind === "child") {
        setKidsRemaining((k) => (k !== null ? Math.max(k - 1, 0) : k));
      }
      cancelAddCompanion();
    } catch (e) {
      setAddCompanionError(e instanceof Error ? e.message : (locale === "fr" ? "Une erreur est survenue." : "Something went wrong."));
    } finally {
      setAddCompanionBusy(false);
    }
  };

  return (
    <div className="premium-portal-theme">
      {/* Dynamic styling to deliver pure editorial feel */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Instrument+Sans:wght@300;400;600;700&display=swap');

        .premium-portal-theme {
          --primary: #43353a;
          --accent: #b07c82;
          --accent-light: #f7e6e8;
          --bg: #f4f1ea;
          --card-bg: #ffffff;
          --text: #2b2724;
          --muted: #8a817c;
          --success: #6e8a72;
          --border: #e3dec3;
          --font-serif: 'Cormorant Garamond', serif;
          --font-sans: 'Instrument Sans', sans-serif;

          background: var(--bg);
          color: var(--text);
          font-family: var(--font-sans);
          min-height: 100vh;
          padding-bottom: 80px;
        }

        .u-serif {
          font-family: var(--font-serif);
        }

        .hero-banner {
          text-align: center;
          padding: 60px 24px 40px;
          position: relative;
        }

        .hero-banner h1 {
          font-family: var(--font-serif);
          font-size: 56px;
          font-weight: 300;
          letter-spacing: -1px;
          margin-bottom: 8px;
          color: var(--primary);
        }

        .countdown-pill {
          display: inline-flex;
          gap: 16px;
          background: rgba(176, 124, 130, 0.08);
          border: 1px solid rgba(176, 124, 130, 0.2);
          padding: 8px 24px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 600;
          color: var(--accent);
          margin-top: 16px;
        }

        .nav-tabs {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin: 32px auto 40px;
          padding: 4px;
          background: rgba(67, 53, 58, 0.04);
          border-radius: 16px;
          max-width: 600px;
        }

        .tab-btn {
          flex: 1;
          background: none;
          border: none;
          padding: 12px 16px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .tab-btn.active {
          background: var(--card-bg);
          color: var(--primary);
          box-shadow: 0 4px 12px rgba(43, 39, 36, 0.06);
        }

        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 0 20px;
        }

        .card {
          background: var(--card-bg);
          border-radius: 24px;
          padding: 32px;
          margin-bottom: 24px;
          box-shadow: 0 10px 30px rgba(43, 39, 36, 0.03);
          border: 1px solid rgba(227, 222, 195, 0.5);
          position: relative;
          overflow: hidden;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }

        .form-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: white;
          padding: 24px;
          border-radius: 20px;
          border: 1px solid rgba(67, 53, 58, 0.08);
          transition: all 0.2s ease;
        }

        .form-card:hover {
          border-color: var(--accent);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(176, 124, 130, 0.06);
        }

        .badge-status {
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 100px;
          letter-spacing: 0.5px;
          display: inline-block;
        }

        .badge-status.pending {
          background: #fdf5e6;
          color: #b8860b;
        }

        .badge-status.completed {
          background: #eaf5ec;
          color: var(--success);
        }

        .badge-status.locked {
          background: #f2f2f2;
          color: #999999;
        }

        .drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(43, 39, 36, 0.4);
          z-index: 1000;
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: flex-end;
          animation: fadeIn 0.2s ease;
        }

        .drawer-container {
          width: 100%;
          max-width: 520px;
          background: white;
          height: 100%;
          padding: 40px 32px;
          display: flex;
          flex-direction: column;
          box-shadow: -10px 0 40px rgba(43, 39, 36, 0.15);
          overflow-y: auto;
          animation: slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .field {
          margin-bottom: 20px;
        }

        .field label {
          display: block;
          font-weight: 600;
          font-size: 14px;
          color: var(--primary);
          margin-bottom: 8px;
        }

        .field input, .field textarea, .field select {
          width: 100%;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid #e1dec3;
          font-family: var(--font-sans);
          font-size: 15px;
          background: #fbfbf8;
          color: var(--text);
          transition: border-color 0.2s;
        }

        .field input:focus, .field textarea:focus {
          border-color: var(--accent);
          outline: none;
          background: white;
        }

        .choice-row {
          display: flex;
          gap: 12px;
        }

        .choice-btn {
          flex: 1;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid #e1dec3;
          background: #fbfbf8;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .choice-btn.selected-yes {
          border-color: var(--success);
          background: #eaf5ec;
          color: var(--success);
        }

        .choice-btn.selected-no {
          border-color: var(--accent);
          background: #fdf2f4;
          color: var(--accent);
        }

        .btn-submit {
          background: var(--primary);
          color: white;
          border: none;
          padding: 16px;
          border-radius: 14px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          width: 100%;
          transition: opacity 0.2s;
          margin-top: auto;
        }

        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .companion-box {
          background: #fcfbfa;
          border: 1px solid #e1dec3;
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .responsive-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
        }

        /* Travel page specific grid for connections */
        .travel-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }

        /* Logistics page specific grid */
        .logistics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        /* FAQ grid for desktop */
        .faq-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        /* Connection card styling */
        .connection-card {
          border: 1px solid #e1dec3;
          padding: 16px;
          border-radius: 16px;
          margin-bottom: 16px;
          background: white;
          transition: all 0.2s ease;
        }

        .connection-card:hover {
          box-shadow: 0 4px 12px rgba(43, 39, 36, 0.08);
          transform: translateY(-2px);
        }

        /* Hotel card styling */
        .hotel-card {
          border: 1px solid #e1dec3;
          padding: 20px;
          border-radius: 16px;
          margin-bottom: 16px;
          background: white;
          transition: all 0.2s ease;
        }

        .hotel-card:hover {
          box-shadow: 0 4px 12px rgba(43, 39, 36, 0.08);
          transform: translateY(-2px);
        }

        /* FAQ item styling */
        .faq-item {
          background: #fcfbfa;
          padding: 20px;
          border-radius: 16px;
          border: 1px solid #e1dec3;
          transition: all 0.2s ease;
        }

        .faq-item:hover {
          background: #f8f5f2;
          border-color: var(--accent);
        }

        /* Timeline styling */
        .timeline {
          border-left: 2px solid var(--accent);
          padding-left: 20px;
          margin-left: 10px;
        }

        .timeline-item {
          margin-bottom: 20px;
          position: relative;
        }

        .timeline-dot {
          position: absolute;
          left: -22px;
          top: 3px;
          width: 12px;
          height: 12px;
          background: var(--accent);
          border-radius: 50%;
        }

        @media (max-width: 1024px) {
          .travel-grid,
          .logistics-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }

        @media (max-width: 768px) {
          .responsive-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .hero-banner {
            padding: 40px 16px 24px;
          }
          .hero-banner h1 {
            font-size: 38px;
          }
          .nav-tabs {
            flex-wrap: wrap;
            gap: 6px;
            margin: 20px auto 28px;
          }
          .tab-btn {
            padding: 10px 12px;
            font-size: 13px;
          }
          .drawer-container {
            max-width: 100%;
            padding: 24px 16px;
          }
          .card {
            padding: 20px;
            border-radius: 16px;
          }
          .timeline {
            padding-left: 16px;
            margin-left: 0;
          }
          .timeline-dot {
            left: -18px;
          }
        }

        /* PWA compatibility - ensure proper touch targets */
        @media (hover: hover) {
          .connection-card,
          .hotel-card,
          .faq-item {
            cursor: pointer;
          }
        }

        /* Desktop-specific enhancements */
        @media (min-width: 1025px) {
          .card {
            padding: 40px;
            border-radius: 28px;
          }
          .hero-banner {
            padding: 80px 24px 60px;
          }
          .hero-banner h1 {
            font-size: 64px;
          }
          .countdown-pill {
            font-size: 14px;
            padding: 10px 32px;
          }
          .nav-tabs {
            max-width: 800px;
            gap: 12px;
          }
          .tab-btn {
            padding: 14px 20px;
            font-size: 15px;
          }
          .form-grid {
            gap: 28px;
          }
        }
      ` }} />

      {/* Floating Demo Notice */}
      {isDemo && (
        <div style={{
          background: "var(--accent)",
          color: "white",
          padding: "8px 16px",
          textAlign: "center",
          fontSize: "13px",
          fontWeight: "600",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
        }}>
          {locale === "fr" ? "✨ Mode Démo - Vos modifications sont simulées." : "✨ Live Preview / Demo Mode - Submissions simulated."}
        </div>
      )}

      {/* Hero Header */}
      <header className="hero-banner">
        <div style={{ position: "absolute", top: "20px", right: "24px" }}>
          <LanguageSwitcher compact />
        </div>
        <p className="u-serif" style={{ fontSize: "14px", textTransform: "uppercase", letterSpacing: "2px", color: "var(--accent)", fontWeight: "600" }}>
          {locale === "fr" ? "Invitation de Mariage" : "Wedding Invitation"}
        </p>
        <h1>{coupleNames}</h1>
        <p className="u-serif" style={{ fontSize: "20px", color: "var(--muted)", fontStyle: "italic" }}>
          {displayDate}
          {guestLocationSummary ? ` • ${guestLocationSummary}` : ""}
        </p>

        {timeLeft.days > 0 && (
          <div className="countdown-pill">
            <span>⏳ {timeLeft.days} {locale === "fr" ? "jours restants" : "days to go"}</span>
          </div>
        )}
      </header>

      {/* Tab Navigation */}
      <div className="container">
        <nav className="nav-tabs">
          <button onClick={() => setActiveTab("forms")} className={`tab-btn ${activeTab === "forms" ? "active" : ""}`}>
            📋 {locale === "fr" ? "Mes Formulaires" : "My Forms"}
          </button>
          <button onClick={() => setActiveTab("travel")} className={`tab-btn ${activeTab === "travel" ? "active" : ""}`}>
            🚗 {locale === "fr" ? "Voyage & Covoit" : "Travel & Board"}
          </button>
          <button onClick={() => setActiveTab("logistics")} className={`tab-btn ${activeTab === "logistics" ? "active" : ""}`}>
            📍 {locale === "fr" ? "Infos & Lieux" : "Logistics"}
          </button>
          <button onClick={() => setActiveTab("faq")} className={`tab-btn ${activeTab === "faq" ? "active" : ""}`}>
            ❓ {locale === "fr" ? "FAQ" : "FAQs"}
          </button>
        </nav>
      </div>

      {/* Main Area */}
      <main className="container">
        {/* Tab 1: Separate Forms */}
        {activeTab === "forms" && (
          <div>
            <div style={{ marginBottom: "28px" }}>
              <h2 className="u-serif" style={{ fontSize: "28px", fontWeight: "600", marginBottom: "8px" }}>
                {locale === "fr" ? "Formulaires d'Organisation" : "Your Wedding Forms"}
              </h2>
              <p style={{ color: "var(--muted)", fontSize: "15px" }}>
                {locale === "fr"
                  ? `Bonjour ${invitation.guest.first_name}, l'organisateur vous soumet des formulaires distincts selon l'avancement des préparatifs.`
                  : `Hello ${invitation.guest.first_name}, the wedding organiser shares separate forms with you as different planning phases arrive.`}
              </p>
            </div>

            <div className="form-grid">
              {/* Form 1: Main RSVP */}
              <div className="form-card">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span className={`badge-status ${primaryRsvp}`}>
                      {primaryRsvp === "pending" ? (locale === "fr" ? "À Remplir" : "Pending") : (primaryRsvp === "attending" ? labelAttending : labelDeclined)}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: "600" }}>Phase 1</span>
                  </div>
                  <h3 className="u-serif" style={{ fontSize: "20px", fontWeight: "600", margin: "0 0 6px" }}>
                    {rsvpTitle}
                  </h3>
                  <p style={{ color: "var(--muted)", fontSize: "13px", margin: 0, maxWidth: "400px" }}>
                    {rsvpSubtitle}
                  </p>
                </div>
                <button
                  onClick={() => openRsvpModal("primary")}
                  style={{
                    background: primaryRsvp === "pending" ? "var(--primary)" : "rgba(67, 53, 58, 0.05)",
                    color: primaryRsvp === "pending" ? "white" : "var(--primary)",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "10px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  {primaryRsvp === "pending" ? (locale === "fr" ? "Répondre" : "Start") : (locale === "fr" ? "Modifier" : "Update")}
                </button>
              </div>

              {/* Form 1b: RSVP reconfirmation — same block, later nudge, only when open */}
              {reconfirmationLive && (
                <div className="form-card">
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <span className={`badge-status ${primaryRsvp}`}>
                        {primaryRsvp === "pending" ? (locale === "fr" ? "À Remplir" : "Pending") : (primaryRsvp === "attending" ? labelAttending : labelDeclined)}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: "600" }}>
                        {locale === "fr" ? "Dernier point" : "Final check-in"}
                      </span>
                    </div>
                    <h3 className="u-serif" style={{ fontSize: "20px", fontWeight: "600", margin: "0 0 6px" }}>
                      {reconfirmTitle}
                    </h3>
                    <p style={{ color: "var(--muted)", fontSize: "13px", margin: 0, maxWidth: "400px" }}>
                      {reconfirmSubtitle}
                    </p>
                  </div>
                  <button
                    onClick={() => openRsvpModal("reconfirmation")}
                    style={{
                      background: "var(--primary)",
                      color: "white",
                      border: "none",
                      padding: "10px 20px",
                      borderRadius: "10px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    {locale === "fr" ? "Confirmer" : "Confirm"}
                  </button>
                </div>
              )}

              {/* Custom forms — organiser-authored, shown once published */}
              {customForms.map((f) => {
                const state = customFormState(f);
                const answered = !!f.answers;
                return (
                  <div key={f.id} className="form-card" style={{ opacity: state === "scheduled" ? 0.6 : 1 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                        <span className={`badge-status ${state === "scheduled" ? "locked" : answered ? "completed" : "pending"}`}>
                          {state === "scheduled"
                            ? (locale === "fr" ? "Bientôt" : "Coming soon")
                            : state === "closed"
                              ? (locale === "fr" ? "Fermé" : "Closed")
                              : answered
                                ? (locale === "fr" ? "Complété" : "Completed")
                                : (locale === "fr" ? "À Remplir" : "Action Needed")}
                        </span>
                      </div>
                      <h3 className="u-serif" style={{ fontSize: "20px", fontWeight: "600", margin: "0 0 6px" }}>
                        {f.title}
                      </h3>
                      <p style={{ color: "var(--muted)", fontSize: "13px", margin: 0, maxWidth: "400px" }}>
                        {f.questions.length} {locale === "fr" ? "question(s)" : `question${f.questions.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    <button
                      disabled={state !== "live"}
                      onClick={() => openCustomForm(f.id)}
                      style={{
                        background: state !== "live" ? "#f5f5f5" : (answered ? "rgba(67, 53, 58, 0.05)" : "var(--primary)"),
                        color: state !== "live" ? "#999" : (answered ? "var(--primary)" : "white"),
                        border: "none",
                        padding: "10px 20px",
                        borderRadius: "10px",
                        fontWeight: "600",
                        cursor: state !== "live" ? "not-allowed" : "pointer",
                      }}
                    >
                      {state !== "live" ? "🔒" : (answered ? (locale === "fr" ? "Modifier" : "Update") : (locale === "fr" ? "Répondre" : "Start"))}
                    </button>
                  </div>
                );
              })}

              {/* Form 2: Preferences Form */}
              <div className="form-card" style={{ opacity: isPending ? 0.6 : 1 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span className={`badge-status ${isPending ? 'locked' : (isDeclined ? 'locked' : (preferencesSaved ? 'completed' : 'pending'))}`}>
                      {isPending ? (locale === "fr" ? "Verrouillé" : "Locked") : (isDeclined ? (locale === "fr" ? "Non applicable" : "Not attending") : (preferencesSaved ? (locale === "fr" ? "Complété" : "Completed") : (locale === "fr" ? "À Remplir" : "Action Needed")))}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: "600" }}>Phase 2</span>
                  </div>
                  <h3 className="u-serif" style={{ fontSize: "20px", fontWeight: "600", margin: "0 0 6px" }}>
                    {locale === "fr" ? "2. Menu & Préférences" : "2. Menu & Music Preferences"}
                  </h3>
                  <p style={{ color: "var(--muted)", fontSize: "13px", margin: 0, maxWidth: "400px" }}>
                    {locale === "fr" ? "Choisissez votre repas et proposez vos musiques préférées." : "Share your meal selection and songs you'd love to hear."}
                  </p>
                </div>
                <button
                  disabled={isPending || isDeclined}
                  onClick={() => setActiveFormModal("preferences")}
                  style={{
                    background: (isPending || isDeclined) ? "#f5f5f5" : (preferencesSaved ? "rgba(67, 53, 58, 0.05)" : "var(--primary)"),
                    color: (isPending || isDeclined) ? "#999" : (preferencesSaved ? "var(--primary)" : "white"),
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "10px",
                    fontWeight: "600",
                    cursor: (isPending || isDeclined) ? "not-allowed" : "pointer",
                  }}
                >
                  {(isPending || isDeclined) ? "🔒" : (preferencesSaved ? (locale === "fr" ? "Modifier" : "Update") : (locale === "fr" ? "Remplir" : "Start"))}
                </button>
              </div>

              {/* Form 3: Timing / Re-check */}
              <div className="form-card" style={{ opacity: isPending ? 0.6 : 1 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span className={`badge-status ${isPending ? 'locked' : (isDeclined ? 'locked' : (recheckSaved ? 'completed' : 'pending'))}`}>
                      {isPending ? (locale === "fr" ? "Verrouillé" : "Locked") : (isDeclined ? (locale === "fr" ? "Non applicable" : "Not attending") : (recheckSaved ? (locale === "fr" ? "Confirmé" : "Confirmed") : (locale === "fr" ? "À Remplir" : "Action Needed")))}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: "600" }}>Phase 3</span>
                  </div>
                  <h3 className="u-serif" style={{ fontSize: "20px", fontWeight: "600", margin: "0 0 6px" }}>
                    {locale === "fr" ? "3. Re-Check & Hébergement" : "3. Logistics & Stay Re-Check"}
                  </h3>
                  <p style={{ color: "var(--muted)", fontSize: "13px", margin: 0, maxWidth: "400px" }}>
                    {locale === "fr" ? "Indiquez votre horaire d'arrivée et l'hôtel que vous avez réservé." : "Provide your arrival details and hotel reservation info."}
                  </p>
                </div>
                <button
                  disabled={isPending || isDeclined}
                  onClick={() => setActiveFormModal("recheck")}
                  style={{
                    background: (isPending || isDeclined) ? "#f5f5f5" : (recheckSaved ? "rgba(67, 53, 58, 0.05)" : "var(--primary)"),
                    color: (isPending || isDeclined) ? "#999" : (recheckSaved ? "var(--primary)" : "white"),
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "10px",
                    fontWeight: "600",
                    cursor: (isPending || isDeclined) ? "not-allowed" : "pointer",
                  }}
                >
                  {(isPending || isDeclined) ? "🔒" : (recheckSaved ? (locale === "fr" ? "Modifier" : "Update") : (locale === "fr" ? "Remplir" : "Start"))}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Travel & Connections */}
        {activeTab === "travel" && (
          <div className="card">
            <h2 className="u-serif" style={{ fontSize: "28px", fontWeight: "600", marginBottom: "8px" }}>
              {locale === "fr" ? "Covoiturage & Compagnons de Voyage" : "Travel & Carsharing Connections"}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "15px", marginBottom: "32px" }}>
              {locale === "fr"
                ? "Identifiez d'autres invités faisant des trajets similaires et coordonnez votre transport vers Hood River."
                : "Meet other guests flying into PDX or driving from NYC. Save transport fees and share a premium ride together."}
            </p>

            <div className="travel-grid">
              {/* Left Column: Shared Travel entries */}
              <div>
                <h4 style={{ fontWeight: "600", fontSize: "16px", marginBottom: "16px" }}>🚗 {locale === "fr" ? "Covoits Disponibles" : "Active Travels"}</h4>
                {connections.length > 0 ? (
                  connections.map((match) => (
                    <div key={match.id} className="connection-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "600", fontSize: "15px" }}>{match.name}</span>
                      <span style={{ fontSize: "12px", background: "rgba(110, 138, 114, 0.1)", color: "var(--success)", padding: "3px 8px", borderRadius: "100px", fontWeight: "600" }}>{match.date}</span>
                    </div>
                    <p style={{ margin: "6px 0", fontSize: "13px", color: "var(--muted)" }}>📍 {locale === "fr" ? "Depuis" : "From"}: <strong>{match.from}</strong></p>
                    <p style={{ margin: "4px 0", fontSize: "13px", color: "var(--muted)" }}>🚗 {locale === "fr" ? "Méthode" : "Method"}: {match.method}</p>
                    <p style={{ margin: "4px 0", fontSize: "13px", color: "var(--muted)" }}>💬 {match.notes}</p>

                    {match.seatsAvailable > 0 && (
                      <p style={{ margin: "6px 0", fontSize: "12px", color: "var(--success)", fontWeight: "bold" }}>
                        ✓ {match.seatsAvailable} {locale === "fr" ? "places dispo" : "seats open"}
                      </p>
                    )}

                    <button
                      disabled={match.requested}
                      onClick={() => handleContactRequest(match.id)}
                      style={{
                        width: "100%",
                        marginTop: "12px",
                        background: match.requested ? "rgba(110, 138, 114, 0.1)" : "var(--primary)",
                        color: match.requested ? "var(--success)" : "white",
                        border: "none",
                        padding: "8px",
                        borderRadius: "8px",
                        fontWeight: "600",
                        fontSize: "12px",
                        cursor: match.requested ? "default" : "pointer"
                      }}
                    >
                      {match.requested ? (locale === "fr" ? "✓ Demande envoyée" : "✓ Contact Requested") : (locale === "fr" ? "Demander le contact" : "Request Contact Details")}
                    </button>
                  </div>
                  ))
                ) : (
                  <p style={{ color: "var(--muted)", fontSize: "14px", textAlign: "center", padding: "40px 20px" }}>
                    {locale === "fr" ? "Aucun trajet partagé n'est disponible pour le moment." : "No shared travel options available yet."}
                  </p>
                )}
              </div>

              {/* Right Column: Share Your Travel */}
              <div style={{ background: "#fcfbfa", padding: "24px", borderRadius: "20px", border: "1px solid #e1dec3", height: "fit-content" }}>
                <h4 style={{ fontWeight: "600", fontSize: "16px", marginBottom: "16px" }}>➕ {locale === "fr" ? "Proposer un Trajet" : "Share My Travel"}</h4>

                <div className="field">
                  <label>{locale === "fr" ? "Ville de départ" : "Starting Location"}</label>
                  <input
                    type="text"
                    value={guestFrom}
                    onChange={(e) => setGuestFrom(e.target.value)}
                    placeholder="e.g. PDX Airport, Portland"
                  />
                </div>

                <div className="field">
                  <label>{locale === "fr" ? "Moyen de transport" : "Travel Method"}</label>
                  <select value={guestMethod} onChange={(e) => setGuestMethod(e.target.value)}>
                    <option value="Driving">{locale === "fr" ? "Voiture personnelle" : "Driving"}</option>
                    <option value="Car Rental">{locale === "fr" ? "Location de voiture" : "Car Rental"}</option>
                    <option value="Carpool Needed">{locale === "fr" ? "Recherche passager" : "Looking for Ride"}</option>
                  </select>
                </div>

                <div className="field">
                  <label>{locale === "fr" ? "Places disponibles (si conducteur)" : "Seats Available (if driving)"}</label>
                  <select value={guestSeats} onChange={(e) => setGuestSeats(e.target.value)}>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4+</option>
                  </select>
                </div>

                <div className="field">
                  <label>{locale === "fr" ? "Remarques" : "Notes"}</label>
                  <textarea
                    value={guestNotes}
                    onChange={(e) => setGuestNotes(e.target.value)}
                    placeholder="e.g. Happy to carpool!"
                    rows={3}
                  />
                </div>

                <button
                  onClick={handleAddMyTravel}
                  disabled={!guestFrom.trim()}
                  style={{
                    background: guestFrom.trim() ? "var(--accent)" : "rgba(176, 124, 130, 0.3)",
                    color: "white",
                    border: "none",
                    padding: "14px 24px",
                    borderRadius: "12px",
                    width: "100%",
                    fontWeight: "600",
                    fontSize: "15px",
                    cursor: guestFrom.trim() ? "pointer" : "not-allowed",
                    transition: "all 0.2s ease",
                    marginTop: "8px"
                  }}
                  aria-label={locale === "fr" ? "Publier mon trajet" : "Post travel option"}>
                  {locale === "fr" ? "Publier mon trajet" : "Post Travel Option"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Logistics & Recommended Hotels */}
        {activeTab === "logistics" && (
          <div className="card">
            <h2 className="u-serif" style={{ fontSize: "28px", fontWeight: "600", marginBottom: "8px" }}>
              {locale === "fr" ? "Lieux & Recommandations" : "Logistics & Stays"}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "15px", marginBottom: "32px" }}>
              {locale === "fr" ? "Toutes les adresses recommandées et le planning officiel du mariage." : "A curated list of luxury gorge hotels and the official wedding schedule."}
            </p>

            <div className="logistics-grid">
              {/* Hotel recommendations */}
              <div>
                <h4 style={{ fontWeight: "600", fontSize: "16px", marginBottom: "16px" }}>🏨 {locale === "fr" ? "Hébergements Conseillés" : "Recommended Places to Stay"}</h4>
                {STAYS.map((stay) => (
                  <div key={stay.name} className="hotel-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: "bold", background: "#fdf2f4", color: "var(--accent)", padding: "3px 8px", borderRadius: "100px" }}>{stay.badge}</span>
                        <h5 style={{ fontWeight: "600", fontSize: "16px", margin: "6px 0 2px" }}>{stay.name}</h5>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: "bold", color: "var(--success)" }}>{stay.rating}</span>
                    </div>
                    <p style={{ margin: "4px 0", fontSize: "13px", color: "var(--muted)" }}>📍 {stay.distance} • {stay.price}</p>
                    <p style={{ margin: "6px 0 12px", fontSize: "13px", color: "var(--muted)", lineHeight: "1.5" }}>{stay.desc}</p>
                    <a href={stay.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "var(--accent)", fontWeight: "600", textDecoration: "none" }}>
                      🔗 {locale === "fr" ? "Visiter le site" : "Visit Website"} →
                    </a>
                  </div>
                ))}
              </div>

              {/* Timing timeline & Address */}
              <div>
                <h4 style={{ fontWeight: "600", fontSize: "16px", marginBottom: "16px" }}>📍 {locale === "fr" ? "Le Lieu du Mariage" : "The Venue Address"}</h4>
                <div style={{ border: "1px solid #e1dec3", padding: "20px", borderRadius: "16px", background: "#fcfbfa", marginBottom: "24px" }}>
                  {invitation.wedding.venue_name ? (
                    <p style={{ margin: "0 0 6px", fontWeight: "bold", fontSize: "16px" }}>
                      {invitation.wedding.venue_name}
                    </p>
                  ) : null}
                  {addressText ? (
                    <>
                      <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "14px" }}>{addressText}</p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-block",
                          padding: "10px 16px",
                          background: "white",
                          border: "1px solid #e1dec3",
                          borderRadius: "10px",
                          color: "var(--primary)",
                          fontWeight: "600",
                          fontSize: "13px",
                          textDecoration: "none",
                        }}
                      >
                        🗺️ {locale === "fr" ? "Ouvrir sur Google Maps" : "Open in Google Maps"}
                      </a>
                    </>
                  ) : (
                    <p style={{ margin: 0, color: "var(--muted)", fontSize: "14px", fontStyle: "italic" }}>
                      {addressPending}
                    </p>
                  )}
                </div>

                <h4 style={{ fontWeight: "600", fontSize: "16px", marginBottom: "16px" }}>🕒 {locale === "fr" ? "Déroulement du Mariage" : "Wedding Schedule"}</h4>
                <div style={{ borderLeft: "2px solid var(--accent)", paddingLeft: "16px", marginLeft: "10px" }}>
                  <div style={{ marginBottom: "16px", position: "relative" }}>
                    <span style={{ position: "absolute", left: "-22px", top: "3px", width: "10px", height: "10px", background: "var(--accent)", borderRadius: "100px" }}></span>
                    <strong style={{ fontSize: "14px", color: "var(--primary)" }}>16:00</strong>
                    <h5 style={{ margin: "2px 0", fontSize: "15px", fontWeight: "600" }}>{locale === "fr" ? "Arrivée des Invités" : "Guest Arrival"}</h5>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>Welcome drinks & premium seating</p>
                  </div>
                  <div style={{ marginBottom: "16px", position: "relative" }}>
                    <span style={{ position: "absolute", left: "-22px", top: "3px", width: "10px", height: "10px", background: "var(--accent)", borderRadius: "100px" }}></span>
                    <strong style={{ fontSize: "14px", color: "var(--primary)" }}>16:30</strong>
                    <h5 style={{ margin: "2px 0", fontSize: "15px", fontWeight: "600" }}>{locale === "fr" ? "La Cérémonie" : "The Ceremony"}</h5>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>In the beautiful meadow garden</p>
                  </div>
                  <div style={{ marginBottom: "16px", position: "relative" }}>
                    <span style={{ position: "absolute", left: "-22px", top: "3px", width: "10px", height: "10px", background: "var(--accent)", borderRadius: "100px" }}></span>
                    <strong style={{ fontSize: "14px", color: "var(--primary)" }}>17:30</strong>
                    <h5 style={{ margin: "2px 0", fontSize: "15px", fontWeight: "600" }}>{locale === "fr" ? "Cocktails & Banquet" : "Cocktails & Dining"}</h5>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>Local wines & seasonal organic banquet</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Local FAQ */}
        {activeTab === "faq" && (
          <div className="card">
            <h2 className="u-serif" style={{ fontSize: "28px", fontWeight: "600", marginBottom: "8px" }}>
              {locale === "fr" ? "Foire Aux Questions" : "Frequently Asked Questions"}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "15px", marginBottom: "32px" }}>
              {locale === "fr" ? "Toutes les réponses pour faciliter votre organisation." : "Quick answers to help plan your trip and details about the day."}
            </p>

            <div className="faq-grid">
              <div className="faq-item">
                <h4 style={{ fontWeight: "600", fontSize: "15px", margin: "0 0 6px" }}>👗 {locale === "fr" ? "Quel est le dress code ?" : "What is the dress code?"}</h4>
                <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0, lineHeight: "1.5" }}>
                  {locale === "fr"
                    ? "Tenue élégante de campagne chic. Prévoyez des talons larges ou des chaussures plates pour la pelouse extérieure."
                    : "Garden elegant. Grass-friendly footwear is highly recommended as the ceremony and cocktail hour are outdoors."}
                </p>
              </div>

              <div className="faq-item">
                <h4 style={{ fontWeight: "600", fontSize: "15px", margin: "0 0 6px" }}>👶 {locale === "fr" ? "Les enfants sont-ils invités ?" : "Are children welcome?"}</h4>
                <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0, lineHeight: "1.5" }}>
                  {locale === "fr"
                    ? "Regardez votre invitation personnalisée pour connaître la taille totale de votre groupe d'invités."
                    : "Please check your personalised forms in the first tab to see if your invitation extends to children / families."}
                </p>
              </div>

              <div className="faq-item">
                <h4 style={{ fontWeight: "600", fontSize: "15px", margin: "0 0 6px" }}>🚗 {locale === "fr" ? "Le stationnement est-il disponible sur place ?" : "Is parking available at the venue?"}</h4>
                <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0, lineHeight: "1.5" }}>
                  {locale === "fr"
                    ? "Oui, un parking privé gratuit est disponible sur place. Le covoiturage reste conseillé."
                    : "Yes, ample free parking is available on-site. You can also match with other drivers using our Travel Board."}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- DRAWERS / MODALS FOR STRONGLY SEPARATE FORMS --- */}

      {/* Form 1: RSVP Modal */}
      {activeFormModal === "rsvp" && (
        <div className="drawer-overlay" onClick={() => setActiveFormModal(null)}>
          <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h2 className="u-serif" style={{ fontSize: "28px", fontWeight: "600", margin: 0 }}>
                {rsvpModalContext === "reconfirmation" ? reconfirmTitle : rsvpTitle}
              </h2>
              <button
                onClick={() => setActiveFormModal(null)}
                style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "13px", margin: "0 0 24px" }}>
              {rsvpModalContext === "reconfirmation" ? reconfirmSubtitle : rsvpSubtitle}
            </p>

            {/* Primary Guest RSVP */}
            <div style={{ marginBottom: "24px" }}>
              <p style={{ fontWeight: "bold", color: "var(--accent)", margin: "0 0 10px" }}>
                👤 {invitation.guest.first_name} {invitation.guest.last_name || ""}
              </p>
              <div className="choice-row">
                <button
                  onClick={() => setPrimaryRsvp("attending")}
                  className={`choice-btn ${primaryRsvp === "attending" ? "selected-yes" : ""}`}
                >
                  ✓ {labelAttending}
                </button>
                <button
                  onClick={() => setPrimaryRsvp("declined")}
                  className={`choice-btn ${primaryRsvp === "declined" ? "selected-no" : ""}`}
                >
                  ✗ {labelDeclined}
                </button>
              </div>

              {primaryRsvp === "attending" && (
                <div className="field" style={{ marginTop: "16px" }}>
                  <label>🍏 {locale === "fr" ? "Vos restrictions alimentaires / allergies" : "Your Dietary Restrictions"}</label>
                  <input
                    type="text"
                    value={primaryDietary}
                    onChange={(e) => setPrimaryDietary(e.target.value)}
                    placeholder={locale === "fr" ? "Ex: sans gluten, végétarien..." : "e.g. vegetarian, nut allergies"}
                  />
                </div>
              )}
            </div>

            {/* Companion RSVPs */}
            {primaryRsvp === "attending" && (companions.length > 0 || canAddPartner || canAddKids) && (
              <div style={{ marginBottom: "24px" }}>
                <h4 style={{ fontWeight: "bold", fontSize: "14px", margin: "0 0 12px", borderTop: "1px solid #e1dec3", paddingTop: "16px" }}>
                  👥 {locale === "fr" ? "Proches de votre foyer :" : "Companions in your group :"}
                </h4>
                {companions.map((companion) => {
                  const state = companionsRsvp[companion.id] || { rsvp_status: "pending", dietary_notes: "" };
                  return (
                    <div key={companion.id} className="companion-box">
                      <p style={{ fontWeight: "bold", fontSize: "14px", margin: "0 0 8px" }}>
                        {companion.first_name} {companion.last_name || ""} <span style={{ fontWeight: "normal", fontSize: "12px", color: "var(--muted)", fontStyle: "italic" }}>({locale === "fr" ? "optionnel" : "optional"})</span>
                      </p>
                      <div className="choice-row" style={{ marginBottom: "10px" }}>
                        <button
                          onClick={() => setCompanionsRsvp({
                            ...companionsRsvp,
                            [companion.id]: { ...state, rsvp_status: "attending" }
                          })}
                          className={`choice-btn ${state.rsvp_status === "attending" ? "selected-yes" : ""}`}
                        >
                          {labelAttending}
                        </button>
                        <button
                          onClick={() => setCompanionsRsvp({
                            ...companionsRsvp,
                            [companion.id]: { ...state, rsvp_status: "declined" }
                          })}
                          className={`choice-btn ${state.rsvp_status === "declined" ? "selected-no" : ""}`}
                        >
                          {labelDeclined}
                        </button>
                      </div>

                      {state.rsvp_status === "attending" && (
                        <input
                          type="text"
                          value={state.dietary_notes}
                          onChange={(e) => setCompanionsRsvp({
                            ...companionsRsvp,
                            [companion.id]: { ...state, dietary_notes: e.target.value }
                          })}
                          placeholder={locale === "fr" ? "Restrictions alimentaires..." : "Dietary restrictions..."}
                          style={{
                            width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e1dec3", fontSize: "13px"
                          }}
                        />
                      )}
                    </div>
                  );
                })}

                {(canAddPartner || canAddKids) && (
                  <div style={{ marginTop: companions.length > 0 ? 8 : 0 }}>
                    {addCompanionCandidates ? (
                      <div className="companion-box">
                        <p style={{ fontWeight: "bold", fontSize: "13px", margin: "0 0 8px" }}>
                          {locale === "fr"
                            ? "Ce nom ressemble à quelqu'un déjà sur la liste :"
                            : "This name looks like someone already on the list:"}
                        </p>
                        {addCompanionCandidates.map((c) => (
                          <p key={c.id} style={{ fontSize: "13px", margin: "0 0 4px", color: "var(--muted)" }}>
                            {c.first_name} {c.last_name || ""}
                            {c.added_by_first_name ? ` (${locale === "fr" ? "ajouté par" : "added by"} ${c.added_by_first_name})` : ""}
                          </p>
                        ))}
                        {addCompanionError && (
                          <div style={{ color: "#C0553B", fontSize: 12, margin: "8px 0" }}>{addCompanionError}</div>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button
                            type="button"
                            className="choice-btn"
                            disabled={addCompanionBusy}
                            onClick={() => submitAddCompanion("force_create")}
                          >
                            {locale === "fr" ? "Non, ajouter quand même" : "No, add as new"}
                          </button>
                          <button
                            type="button"
                            className="choice-btn"
                            disabled={addCompanionBusy}
                            onClick={cancelAddCompanion}
                          >
                            {locale === "fr" ? "Annuler" : "Cancel"}
                          </button>
                        </div>
                      </div>
                    ) : addCompanionKind ? (
                      <div className="companion-box">
                        <p style={{ fontWeight: "bold", fontSize: "13px", margin: "0 0 8px" }}>
                          {addCompanionKind === "partner"
                            ? (locale === "fr" ? "Ajouter mon/ma partenaire" : "Add my partner")
                            : (locale === "fr" ? "Ajouter un enfant" : "Add a child")}
                        </p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            type="text"
                            value={addCompanionFirst}
                            onChange={(e) => setAddCompanionFirst(e.target.value)}
                            placeholder={locale === "fr" ? "Prénom" : "First name"}
                            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #e1dec3", fontSize: "13px" }}
                          />
                          <input
                            type="text"
                            value={addCompanionLast}
                            onChange={(e) => setAddCompanionLast(e.target.value)}
                            placeholder={locale === "fr" ? "Nom (optionnel)" : "Last name (optional)"}
                            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #e1dec3", fontSize: "13px" }}
                          />
                        </div>
                        {addCompanionError && (
                          <div style={{ color: "#C0553B", fontSize: 12, margin: "8px 0 0" }}>{addCompanionError}</div>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button
                            type="button"
                            className="choice-btn selected-yes"
                            disabled={addCompanionBusy}
                            onClick={() => submitAddCompanion("auto")}
                          >
                            {addCompanionBusy ? t.common.saving : (locale === "fr" ? "Ajouter" : "Add")}
                          </button>
                          <button
                            type="button"
                            className="choice-btn"
                            disabled={addCompanionBusy}
                            onClick={cancelAddCompanion}
                          >
                            {locale === "fr" ? "Annuler" : "Cancel"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {canAddPartner && (
                          <button type="button" className="choice-btn" style={{ flex: "unset" }} onClick={() => setAddCompanionKind("partner")}>
                            + {locale === "fr" ? "Ajouter mon/ma partenaire" : "Add my partner"}
                          </button>
                        )}
                        {canAddKids && (
                          <button type="button" className="choice-btn" style={{ flex: "unset" }} onClick={() => setAddCompanionKind("child")}>
                            + {locale === "fr" ? "Ajouter un enfant" : "Add a child"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Message to Couple */}
            <div className="field">
              <label>✍️ {locale === "fr" ? "Un mot pour Maya & Daniel ?" : "A message for the couple"}</label>
              <textarea
                value={primaryMessage}
                onChange={(e) => setPrimaryMessage(e.target.value)}
                placeholder={locale === "fr" ? "Hâte de fêter avec vous !" : "Can't wait to see you!"}
                rows={3}
              />
            </div>

            <button
              className="btn-submit"
              disabled={submittingRsvp || primaryRsvp === "pending"}
              onClick={handleSaveRsvp}
            >
              {submittingRsvp ? t.common.saving : (locale === "fr" ? "Soumettre le RSVP" : "Submit RSVP")}
            </button>
          </div>
        </div>
      )}

      {/* Custom form modal */}
      {activeCustomForm && (
        <div className="drawer-overlay" onClick={() => (customSubmitting ? null : setActiveCustomFormId(null))}>
          <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 className="u-serif" style={{ fontSize: "28px", fontWeight: "600", margin: 0 }}>
                {activeCustomForm.title}
              </h2>
              <button
                onClick={() => setActiveCustomFormId(null)}
                style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            {activeCustomForm.questions.map((q: RsvpQuestion) => (
              <div className="field" key={q.id}>
                <label>
                  {q.title}
                  {q.required ? " *" : ` (${locale === "fr" ? "optionnel" : "optional"})`}
                </label>

                {(q.kind === "single" || q.kind === "multi") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(q.options ?? []).map((opt) => {
                      const current = customDraft[q.id];
                      const selected = q.kind === "single" ? current === opt : Array.isArray(current) && current.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setCustomDraft((prev) => {
                              if (q.kind === "single") return { ...prev, [q.id]: opt };
                              const list = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
                              const next = list.includes(opt) ? list.filter((o) => o !== opt) : [...list, opt];
                              return { ...prev, [q.id]: next };
                            });
                          }}
                          className={`choice-btn ${selected ? "selected-yes" : ""}`}
                          style={{ justifyContent: "flex-start", textAlign: "left" }}
                        >
                          {selected ? "✓ " : ""}{opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.kind === "short" && (
                  <input
                    type="text"
                    value={typeof customDraft[q.id] === "string" ? (customDraft[q.id] as string) : ""}
                    onChange={(e) => setCustomDraft((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  />
                )}

                {q.kind === "comment" && (
                  <textarea
                    value={typeof customDraft[q.id] === "string" ? (customDraft[q.id] as string) : ""}
                    onChange={(e) => setCustomDraft((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    rows={3}
                  />
                )}
              </div>
            ))}

            {customError && (
              <div style={{ color: "#C0553B", fontSize: 13, marginBottom: 16 }}>{customError}</div>
            )}

            <button
              className="btn-submit"
              disabled={customSubmitting}
              onClick={handleSubmitCustomForm}
            >
              {customSubmitting ? t.common.saving : (locale === "fr" ? "Envoyer mes réponses" : "Submit answers")}
            </button>
          </div>
        </div>
      )}

      {/* Form 2: Preferences Modal */}
      {activeFormModal === "preferences" && (
        <div className="drawer-overlay" onClick={() => setActiveFormModal(null)}>
          <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 className="u-serif" style={{ fontSize: "28px", fontWeight: "600", margin: 0 }}>
                {locale === "fr" ? "Menu & Préférences" : "Menu & Preferences"}
              </h2>
              <button
                onClick={() => setActiveFormModal(null)}
                style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "20px" }}>
              {locale === "fr" ? "Données récoltées séparément pour planifier le banquet et la musique du mariage." : "Separate preferences collection event for wedding dining and music."}
            </p>

            <div className="field">
              <label>🍽️ {locale === "fr" ? "Plat principal souhaité" : "Main Meal Preference"}</label>
              <select value={prefMeal} onChange={(e) => setPrefMeal(e.target.value)}>
                <option value="">{locale === "fr" ? "-- Choisir --" : "-- Select Option --"}</option>
                <option value="beef">{locale === "fr" ? "Filet de Boeuf grillé & légumes bio" : "Gourmet Beef Tenderloin"}</option>
                <option value="salmon">{locale === "fr" ? "Pavé de Saumon du Pacifique au four" : "Wild Pacific Salmon"}</option>
                <option value="vegan">{locale === "fr" ? "Courge rôtie aux herbes & quinoa bio (Vegan)" : "Roasted Organic Squash & Quinoa (Vegan)"}</option>
              </select>
            </div>

            <div className="field">
              <label>🎵 {locale === "fr" ? "Chanson que vous aimeriez entendre" : "Song request"}</label>
              <input
                type="text"
                value={prefSong}
                onChange={(e) => setPrefSong(e.target.value)}
                placeholder="e.g. ABBA - Dancing Queen"
              />
            </div>

            <button
              className="btn-submit"
              disabled={submittingPrefs || !prefMeal}
              onClick={handleSavePrefs}
            >
              {submittingPrefs ? t.common.saving : (locale === "fr" ? "Enregistrer les préférences" : "Save Preferences")}
            </button>
          </div>
        </div>
      )}

      {/* Form 3: Recheck Modal */}
      {activeFormModal === "recheck" && (
        <div className="drawer-overlay" onClick={() => setActiveFormModal(null)}>
          <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 className="u-serif" style={{ fontSize: "28px", fontWeight: "600", margin: 0 }}>
                {locale === "fr" ? "Logistique & Re-Check" : "Logistics & Re-Check"}
              </h2>
              <button
                onClick={() => setActiveFormModal(null)}
                style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "20px" }}>
              {locale === "fr" ? "Formulaire de dernière minute pour confirmer la présence et coordonner les arrivées." : "Last-minute data collection to confirm attendance and stays."}
            </p>

            <div className="field">
              <label>⏰ {locale === "fr" ? "Quand prévoyez-vous d'arriver ?" : "When are you arriving?"}</label>
              <select value={recheckArrival} onChange={(e) => setRecheckArrival(e.target.value)}>
                <option value="">{locale === "fr" ? "-- Choisir --" : "-- Select Option --"}</option>
                <option value="fri_morning">{locale === "fr" ? "Vendredi matin" : "Friday Morning"}</option>
                <option value="fri_afternoon">{locale === "fr" ? "Vendredi après-midi / soir" : "Friday Afternoon"}</option>
                <option value="sat_morning">{locale === "fr" ? "Samedi matin (Jour J)" : "Saturday Morning"}</option>
              </select>
            </div>

            <div className="field">
              <label>🏨 {locale === "fr" ? "Où logez-vous pendant le week-end ?" : "Where are you staying?"}</label>
              <input
                type="text"
                value={recheckHotel}
                onChange={(e) => setRecheckHotel(e.target.value)}
                placeholder="e.g. Hood River Hotel"
              />
            </div>

            <button
              className="btn-submit"
              disabled={submittingRecheck || !recheckArrival}
              onClick={handleSaveRecheck}
            >
              {submittingRecheck ? t.common.saving : (locale === "fr" ? "Valider le Re-Check" : "Confirm Arrival Details")}
            </button>
          </div>
        </div>
      )}

      {/* Success Modals for requests */}
      {activeModal && (
        <div className="drawer-overlay" onClick={() => setActiveModal(null)} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: "32px", borderRadius: "20px", maxWidth: "400px", width: "100%", textAlign: "center", position: "relative" }}>
            <span style={{ fontSize: "40px" }}>💌</span>
            <h4 className="u-serif" style={{ fontSize: "22px", fontWeight: "600", margin: "12px 0 8px" }}>
              {locale === "fr" ? "Demande Envoyée" : "Request Sent"}
            </h4>
            <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "24px" }}>
              {locale === "fr"
                ? "Une notification a été transmise à l'invité. S'il accepte, ses coordonnées s'afficheront ici."
                : "The guest has been notified. If they accept sharing their details, they will be sent to your email."}
            </p>
            <button
              onClick={() => setActiveModal(null)}
              style={{ background: "var(--primary)", color: "white", border: "none", padding: "12px 24px", borderRadius: "10px", fontWeight: "600", width: "100%", cursor: "pointer" }}
            >
              {locale === "fr" ? "Fermer" : "Close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
