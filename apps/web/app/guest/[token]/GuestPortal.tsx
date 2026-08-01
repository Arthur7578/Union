"use client";

import React, { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getSupabase } from "@/lib/supabase";

type Invitation = {
  guest_id: string;
  guest_first_name: string;
  guest_last_name: string | null;
  party_size: number;
  partner_one: string | null;
  partner_two: string | null;
  event_date: string | null;
  venue_name: string | null;
  venue_address: string | null;
  rsvp_status: "pending" | "attending" | "declined";
  num_attending: number | null;
  dietary_notes: string | null;
  message: string | null;
};

interface GuestPortalProps {
  token: string;
  invitation: Invitation;
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
    from: "Boston Logan Airport",
    date: "Sept 19",
    method: "Flying (Looking for a ride)",
    hasSeats: false,
    seatsAvailable: 0,
    notes: "Landing around 2 PM. Anyone passing by Logan Airport around then?",
    sharedContact: false,
    requested: false,
  },
  {
    id: "match-3",
    name: "Lucas Dupont",
    from: "Montreal",
    date: "Sept 18",
    method: "Driving (Electric car)",
    hasSeats: true,
    seatsAvailable: 2,
    notes: "Direct drive, planning to stop halfway for coffee.",
    sharedContact: false,
    requested: false,
  },
];

// Predefined lists for Typeform options
const PREFERENCES_SONGS = [
  "L-O-V-E — Nat King Cole",
  "You Are the Best Thing — Ray LaMontagne",
  "September — Earth, Wind & Fire",
  "At Last — Etta James",
  "Canned Heat — Jamiroquai",
  "Something custom / I will surprise you",
];

const PREFERENCES_MEALS = [
  { id: "beef", name: "Prime Rib Eye with truffle potato purée", icon: "🥩" },
  { id: "salmon", name: "Pan-seared Atlantic Salmon with lemon herb butter", icon: "🐟" },
  { id: "vegan", name: "Wild mushroom & butternut squash risotto (GF/V)", icon: "🍄" },
];

export function GuestPortal({ token, invitation, isDemo }: GuestPortalProps) {
  const { t, locale } = useLocale();
  const [activeTab, setActiveTab] = useState<"forms" | "travel" | "info" | "faqs">("forms");

  // Countdown State
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0 });

  // Connections Board State
  const [connections, setConnections] = useState(SAMPLE_CONNECTIONS);
  const [guestTravelShared, setGuestTravelShared] = useState(false);
  const [guestFrom, setGuestFrom] = useState("");
  const [guestDate, setGuestDate] = useState("Sept 19");
  const [guestMethod, setGuestMethod] = useState("Driving");
  const [guestSeats, setGuestSeats] = useState("1");
  const [guestNotes, setGuestNotes] = useState("");
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Form Sequences State
  // 1. RSVP form
  const [rsvpChoice, setRsvpChoice] = useState<"attending" | "declined" | null>(
    invitation.rsvp_status !== "pending" ? invitation.rsvp_status : null
  );
  const [partySizeChoice, setPartySizeChoice] = useState(invitation.num_attending ?? invitation.party_size ?? 1);
  const [dietaryChoice, setDietaryChoice] = useState(invitation.dietary_notes ?? "");
  const [messageChoice, setMessageChoice] = useState(invitation.message ?? "");

  // 2. Preferences Form
  const [prefSong, setPrefSong] = useState("");
  const [prefMeal, setPrefMeal] = useState("");
  const [prefSongCustom, setPrefSongCustom] = useState("");

  // 3. Re-Check Form
  const [recheckArrival, setRecheckArrival] = useState("");
  const [recheckHotel, setRecheckHotel] = useState("");

  // Submitting States
  const [submittingRsvp, setSubmittingRsvp] = useState(false);
  const [submittingPrefs, setSubmittingPrefs] = useState(false);
  const [submittingRecheck, setSubmittingRecheck] = useState(false);

  // Completed Step trackers
  const [rsvpSaved, setRsvpSaved] = useState(invitation.rsvp_status !== "pending");
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [recheckSaved, setRecheckSaved] = useState(false);

  // Active step of Typeform-style questionnaire
  // 1: RSVP Choice, 2: Party Size, 3: Dietary/Message -> Submit RSVP
  // 4: Song choice, 5: Meal Choice -> Submit Preferences
  // 6: Arrival time, 7: Hotel choice -> Submit Re-Check
  const [formStep, setFormStep] = useState(1);

  // Keyboard navigation for Typeform-style experience
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "forms") return;

      // Skip keyboard shortcut if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (e.key === "Enter") {
        if (isTyping && target.tagName === "INPUT" && formStep === 7) {
          // Allow Enter to save Recheck on hotel input
          handleSaveRecheck();
          return;
        }
        if (isTyping) return; // Let input handle native enters

        e.preventDefault();
        if (formStep === 1 && rsvpChoice) {
          setFormStep(rsvpChoice === "attending" ? 2 : 3);
        } else if (formStep === 2) {
          setFormStep(3);
        } else if (formStep === 3) {
          handleSaveRsvp();
        } else if (formStep === 4 && prefSong) {
          setFormStep(5);
        } else if (formStep === 5 && prefMeal) {
          handleSavePrefs();
        } else if (formStep === 6 && recheckArrival) {
          setFormStep(7);
        } else if (formStep === 7 && recheckHotel) {
          handleSaveRecheck();
        }
      } else if (e.key === "Backspace" && !isTyping) {
        e.preventDefault();
        if (formStep > 1 && formStep <= 7) {
          if (formStep === 3 && rsvpChoice === "declined") {
            setFormStep(1);
          } else {
            setFormStep(prev => prev - 1);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeTab,
    formStep,
    rsvpChoice,
    partySizeChoice,
    dietaryChoice,
    messageChoice,
    prefSong,
    prefSongCustom,
    prefMeal,
    recheckArrival,
    recheckHotel
  ]);

  // Calculation for Countdown
  useEffect(() => {
    const targetDate = invitation.event_date ? new Date(`${invitation.event_date}T00:00:00`) : new Date("2026-09-20T16:00:00");

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
  }, [invitation.event_date]);

  // Form Submissions
  const handleSaveRsvp = async () => {
    if (!rsvpChoice) return;
    setSubmittingRsvp(true);
    try {
      if (!isDemo) {
        const supabase = getSupabase();
        const { error } = await supabase.rpc("submit_rsvp", {
          p_token: token,
          p_status: rsvpChoice,
          p_num_attending: rsvpChoice === "attending" ? partySizeChoice : 0,
          p_dietary_notes: dietaryChoice.trim() || undefined,
          p_message: messageChoice.trim() || undefined,
        });
        if (error) throw error;
      }
      setRsvpSaved(true);
      // Automatically advance to preferences step if attending
      if (rsvpChoice === "attending") {
        setFormStep(4);
      } else {
        // If declining, fast-track directly to completion screen
        setFormStep(8);
      }
    } catch (e) {
      console.error("Failed to submit RSVP:", e);
      alert("Error saving RSVP. Please try again.");
    } finally {
      setSubmittingRsvp(false);
    }
  };

  const handleSavePrefs = async () => {
    setSubmittingPrefs(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    setPrefsSaved(true);
    setFormStep(6); // Advance to Re-check
    setSubmittingPrefs(false);
  };

  const handleSaveRecheck = async () => {
    setSubmittingRecheck(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    setRecheckSaved(true);
    setFormStep(8); // Completely Finished
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
      id: "my-connection",
      name: `${invitation.guest_first_name} ${invitation.guest_last_name ?? ""}`.trim(),
      from: guestFrom,
      date: guestDate,
      method: guestMethod + (guestMethod === "Driving" ? ` (${guestSeats} spots)` : ""),
      hasSeats: guestMethod === "Driving",
      seatsAvailable: guestMethod === "Driving" ? parseInt(guestSeats, 10) : 0,
      notes: guestNotes || "Looking forward to matching with someone!",
      sharedContact: true,
      requested: false,
    };

    setConnections([newConnection, ...connections]);
    setGuestTravelShared(true);
  };

  const handleRemoveMyTravel = () => {
    setConnections(prev => prev.filter(item => item.id !== "my-connection"));
    setGuestTravelShared(false);
    setGuestFrom("");
    setGuestNotes("");
  };

  const coupleNames = `${invitation.partner_one} & ${invitation.partner_two}`;
  const displayDate = invitation.event_date ? new Date(`${invitation.event_date}T00:00:00`).toLocaleDateString(
    locale === "fr" ? "fr-FR" : "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  ) : "";

  return (
    <div className="u-app" style={{ color: "#43353A", minHeight: "100vh" }}>
      {/* Immersive Top Ambient Section */}
      <header style={{
        position: "relative",
        background: "linear-gradient(180deg, rgba(176, 124, 130, 0.08) 0%, rgba(242, 236, 229, 0) 100%)",
        padding: "48px 24px 24px",
        textAlign: "center",
      }}>
        <div style={{ position: "absolute", top: 16, right: 16 }}>
          <LanguageSwitcher compact />
        </div>

        {isDemo && (
          <div style={{
            display: "inline-block",
            background: "rgba(176, 124, 130, 0.12)",
            color: "#9a626a",
            fontSize: "12px",
            fontWeight: "bold",
            letterSpacing: "1px",
            textTransform: "uppercase",
            padding: "4px 12px",
            borderRadius: "100px",
            marginBottom: "16px",
          }}>
            {t.common.sample} · Preview Mode
          </div>
        )}

        <div className="brand" style={{ letterSpacing: "5px", fontSize: "12px" }}>UNION PRESENTS</div>
        <h1 className="u-serif" style={{ fontSize: "40px", fontWeight: "600", margin: "12px 0 4px", color: "#43353A" }}>
          {coupleNames}
        </h1>
        <p style={{ margin: "0 auto 16px", fontSize: "16px", color: "#8a817c", maxWidth: "400px" }}>
          {displayDate} • {invitation.venue_name}
        </p>

        {/* Dynamic Countdown Clock */}
        <div style={{
          display: "inline-flex",
          gap: "20px",
          background: "rgba(255, 252, 250, 0.6)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(176, 124, 130, 0.15)",
          padding: "10px 24px",
          borderRadius: "50px",
          boxShadow: "0 8px 24px rgba(43, 39, 36, 0.04)",
          marginTop: "8px",
        }}>
          <div style={{ textAlign: "center" }}>
            <span style={{ display: "block", fontSize: "18px", fontWeight: "700", color: "#b07c82" }}>{timeLeft.days}</span>
            <span style={{ fontSize: "10px", color: "#8a817c", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {locale === "fr" ? "jours" : "days"}
            </span>
          </div>
          <div style={{ color: "rgba(176, 124, 130, 0.3)", fontSize: "18px" }}>•</div>
          <div style={{ textAlign: "center" }}>
            <span style={{ display: "block", fontSize: "18px", fontWeight: "700", color: "#b07c82" }}>{timeLeft.hours}</span>
            <span style={{ fontSize: "10px", color: "#8a817c", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {locale === "fr" ? "heures" : "hours"}
            </span>
          </div>
          <div style={{ color: "rgba(176, 124, 130, 0.3)", fontSize: "18px" }}>•</div>
          <div style={{ textAlign: "center" }}>
            <span style={{ display: "block", fontSize: "18px", fontWeight: "700", color: "#b07c82" }}>{timeLeft.mins}</span>
            <span style={{ fontSize: "10px", color: "#8a817c", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {locale === "fr" ? "mins" : "mins"}
            </span>
          </div>
        </div>

        {/* Dynamic Greeting */}
        <div style={{ marginTop: "24px" }}>
          <p style={{ fontSize: "18px", fontWeight: "500" }}>
            {locale === "fr" ? "Bienvenue," : "Welcome,"} <strong style={{ color: "#b07c82" }}>{invitation.guest_first_name}</strong>
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="u-main" style={{ paddingBottom: "120px" }}>

        {/* Navigation Tabs - Editorial Premium Style */}
        <nav style={{
          display: "flex",
          justifyContent: "space-between",
          background: "rgba(255, 252, 250, 0.8)",
          border: "1px solid rgba(67, 53, 58, 0.08)",
          borderRadius: "16px",
          padding: "6px",
          marginBottom: "32px",
          boxShadow: "0 6px 18px rgba(43, 39, 36, 0.02)",
        }}>
          {[
            { id: "forms", label: locale === "fr" ? "Formulaires" : "My Forms", icon: "📋" },
            { id: "travel", label: locale === "fr" ? "Voyage & Covoit" : "Travel Board", icon: "🚗" },
            { id: "info", label: locale === "fr" ? "Logistique" : "Logistics", icon: "📍" },
            { id: "faqs", label: "FAQs", icon: "❓" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                background: activeTab === tab.id ? "var(--primary)" : "transparent",
                color: activeTab === tab.id ? "#ffffff" : "var(--text)",
                border: "none",
                borderRadius: "12px",
                padding: "8px 4px",
                fontSize: "12px",
                fontWeight: "600",
                transition: "all 0.2s ease",
              }}
            >
              <span style={{ fontSize: "16px" }}>{tab.icon}</span>
              <span style={{ fontSize: "11px", whiteSpace: "nowrap" }}>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* TABS INNER PAGES */}

        {/* TAB 1: FORMS (TYPEFORM STYLE SEQUENTIAL SYSTEM) */}
        {activeTab === "forms" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span className="u-kicker" style={{ color: "#b07c82" }}>
                  {locale === "fr" ? "QUESTIONNAIRE DU MARIAGE" : "WEDDING QUESTIONS"}
                </span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#8a817c" }}>
                  Step {Math.min(formStep, 8)} of 8
                </span>
              </div>

              {/* Custom Progress Bar */}
              <div style={{ height: "6px", background: "rgba(67, 53, 58, 0.08)", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${(Math.min(formStep, 8) / 8) * 100}%`,
                  background: "var(--primary)",
                  borderRadius: "100px",
                  transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                }} />
              </div>
            </div>

            {/* Step 1: RSVP Yes or No */}
            {formStep === 1 && (
              <div className="card" style={{ maxWidth: "100%", border: "none", boxShadow: "0 15px 45px rgba(43, 39, 36, 0.05)", animation: "slideIn 0.3s ease" }}>
                <h2 className="u-serif" style={{ fontSize: "26px", fontWeight: "600", marginBottom: "16px", textAlign: "center" }}>
                  {locale === "fr" ? "Serez-vous des nôtres ?" : "Will you join us for the celebration?"}
                </h2>
                <p style={{ color: "#8a817c", textAlign: "center", marginBottom: "30px" }}>
                  {locale === "fr" ? "Veuillez confirmer votre présence pour nous aider à planifier." : "Please let us know if you can make it. We would love to celebrate with you!"}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <button
                    onClick={() => {
                      setRsvpChoice("attending");
                      setFormStep(2);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "20px 24px",
                      background: rsvpChoice === "attending" ? "var(--success-bg)" : "rgba(255, 252, 250, 0.8)",
                      border: rsvpChoice === "attending" ? "2px solid var(--success)" : "1px solid var(--border)",
                      borderRadius: "16px",
                      fontSize: "18px",
                      fontWeight: "600",
                      textAlign: "left",
                      color: rsvpChoice === "attending" ? "var(--success)" : "var(--text)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.01)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span>🎉 {locale === "fr" ? "Oui, j'adore venir !" : "Yes, absolutely!"}</span>
                    <span style={{ fontSize: "14px", color: "#8a817c" }}>Press Enter ↵</span>
                  </button>

                  <button
                    onClick={() => {
                      setRsvpChoice("declined");
                      // Skip party size preference, go to Message (step 3)
                      setFormStep(3);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "20px 24px",
                      background: rsvpChoice === "declined" ? "var(--danger-bg)" : "rgba(255, 252, 250, 0.8)",
                      border: rsvpChoice === "declined" ? "2px solid var(--danger)" : "1px solid var(--border)",
                      borderRadius: "16px",
                      fontSize: "18px",
                      fontWeight: "600",
                      textAlign: "left",
                      color: rsvpChoice === "declined" ? "var(--danger)" : "var(--text)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.01)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span>✉️ {locale === "fr" ? "Malheureusement, je ne peux pas" : "Regretfully, cannot attend"}</span>
                    <span style={{ fontSize: "14px", color: "#8a817c" }}></span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Party Size Selection (Attending Only) */}
            {formStep === 2 && (
              <div className="card" style={{ maxWidth: "100%", border: "none", boxShadow: "0 15px 45px rgba(43, 39, 36, 0.05)", animation: "slideIn 0.3s ease" }}>
                <h2 className="u-serif" style={{ fontSize: "26px", fontWeight: "600", marginBottom: "16px", textAlign: "center" }}>
                  {locale === "fr" ? "Combien de personnes ?" : "Who is coming?"}
                </h2>
                <p style={{ color: "#8a817c", textAlign: "center", marginBottom: "30px" }}>
                  {locale === "fr" ? `Votre invitation comprend un maximum de ${invitation.party_size} personnes.` : `Your invitation covers up to ${invitation.party_size} guests in your group.`}
                </p>

                <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "32px" }}>
                  {Array.from({ length: invitation.party_size ?? 1 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setPartySizeChoice(n)}
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "16px",
                        border: partySizeChoice === n ? "2px solid var(--primary)" : "1px solid var(--border)",
                        background: partySizeChoice === n ? "rgba(176, 124, 130, 0.08)" : "white",
                        color: partySizeChoice === n ? "var(--primary)" : "var(--text)",
                        fontSize: "20px",
                        fontWeight: "700",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => setFormStep(1)}
                    style={{
                      flex: 1,
                      minHeight: "52px",
                      background: "rgba(67, 53, 58, 0.05)",
                      border: "none",
                      borderRadius: "14px",
                      color: "var(--text)",
                      fontWeight: "600",
                    }}
                  >
                    {t.common.back}
                  </button>
                  <button
                    onClick={() => setFormStep(3)}
                    style={{
                      flex: 2,
                      minHeight: "52px",
                      background: "var(--primary)",
                      border: "none",
                      borderRadius: "14px",
                      color: "white",
                      fontWeight: "600",
                    }}
                  >
                    {locale === "fr" ? "Continuer" : "Next step"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Dietary and Message & Submit RSVP */}
            {formStep === 3 && (
              <div className="card" style={{ maxWidth: "100%", border: "none", boxShadow: "0 15px 45px rgba(43, 39, 36, 0.05)", animation: "slideIn 0.3s ease" }}>
                <h2 className="u-serif" style={{ fontSize: "26px", fontWeight: "600", marginBottom: "20px", textAlign: "center" }}>
                  {locale === "fr" ? "Presque prêt !" : "Just a few more details"}
                </h2>

                {rsvpChoice === "attending" && (
                  <div className="field">
                    <label style={{ fontSize: "14px", color: "var(--text)" }}>🍏 {locale === "fr" ? "Restrictions ou allergies ?" : "Dietary restrictions / Allergies"}</label>
                    <input
                      type="text"
                      value={dietaryChoice}
                      onChange={(e) => setDietaryChoice(e.target.value)}
                      placeholder={locale === "fr" ? "Ex: Végétarien, sans gluten..." : "e.g. Vegetarian, Nut allergy..."}
                      style={{ marginTop: "6px" }}
                    />
                  </div>
                )}

                <div className="field">
                  <label style={{ fontSize: "14px", color: "var(--text)" }}>✍️ {locale === "fr" ? "Un mot pour le couple ?" : "A message for Maya & Daniel"}</label>
                  <textarea
                    value={messageChoice}
                    onChange={(e) => setMessageChoice(e.target.value)}
                    placeholder={locale === "fr" ? "Nous avons hâte !" : "We can't wait to see you!"}
                    style={{ marginTop: "6px" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                  <button
                    onClick={() => setFormStep(rsvpChoice === "attending" ? 2 : 1)}
                    style={{
                      flex: 1,
                      minHeight: "52px",
                      background: "rgba(67, 53, 58, 0.05)",
                      border: "none",
                      borderRadius: "14px",
                      color: "var(--text)",
                      fontWeight: "600",
                    }}
                  >
                    {t.common.back}
                  </button>
                  <button
                    onClick={handleSaveRsvp}
                    disabled={submittingRsvp}
                    style={{
                      flex: 2,
                      minHeight: "52px",
                      background: "var(--primary)",
                      border: "none",
                      borderRadius: "14px",
                      color: "white",
                      fontWeight: "600",
                    }}
                  >
                    {submittingRsvp ? t.common.saving : (rsvpSaved ? (locale === "fr" ? "Mettre à jour" : "Update RSVP") : (locale === "fr" ? "Soumettre le RSVP" : "Submit RSVP"))}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Song Request (Preferences Form published later) */}
            {formStep === 4 && (
              <div className="card" style={{ maxWidth: "100%", border: "none", boxShadow: "0 15px 45px rgba(43, 39, 36, 0.05)", animation: "slideIn 0.3s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", background: "#e7efe6", color: "#6e8a72", padding: "3px 8px", borderRadius: "100px" }}>
                    FORM 2 • {locale === "fr" ? "PRÉFÉRENCES" : "PREFERENCES"}
                  </span>
                </div>
                <h2 className="u-serif" style={{ fontSize: "26px", fontWeight: "600", marginBottom: "12px" }}>
                  🎵 {locale === "fr" ? "De quoi danser toute la nuit" : "What gets you on the dancefloor?"}
                </h2>
                <p style={{ color: "#8a817c", marginBottom: "24px" }}>
                  {locale === "fr" ? "Maya et Daniel préparent une liste personnalisée. Choisissez votre hymne de soirée !" : "Maya & Daniel are building the ultimate collaborative playlist. Select or suggest a song!"}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                  {PREFERENCES_SONGS.map((song) => (
                    <button
                      key={song}
                      onClick={() => setPrefSong(song)}
                      style={{
                        padding: "14px 18px",
                        textAlign: "left",
                        background: prefSong === song ? "rgba(176, 124, 130, 0.06)" : "white",
                        border: prefSong === song ? "2px solid var(--primary)" : "1px solid var(--border)",
                        borderRadius: "12px",
                        fontWeight: "500",
                        fontSize: "15px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {song}
                    </button>
                  ))}

                  <input
                    type="text"
                    value={prefSongCustom}
                    onChange={(e) => {
                      setPrefSongCustom(e.target.value);
                      setPrefSong("custom");
                    }}
                    placeholder={locale === "fr" ? "Saisir une autre chanson..." : "Suggest another song..."}
                    style={{
                      border: prefSong === "custom" ? "2px solid var(--primary)" : "1px solid var(--border)",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => setFormStep(3)}
                    style={{
                      flex: 1,
                      minHeight: "52px",
                      background: "rgba(67, 53, 58, 0.05)",
                      border: "none",
                      borderRadius: "14px",
                      color: "var(--text)",
                      fontWeight: "600",
                    }}
                  >
                    {t.common.back}
                  </button>
                  <button
                    onClick={() => setFormStep(5)}
                    disabled={!prefSong}
                    style={{
                      flex: 2,
                      minHeight: "52px",
                      background: "var(--primary)",
                      border: "none",
                      borderRadius: "14px",
                      color: "white",
                      fontWeight: "600",
                    }}
                  >
                    {locale === "fr" ? "Étape suivante" : "Choose Meal"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Meal Selection */}
            {formStep === 5 && (
              <div className="card" style={{ maxWidth: "100%", border: "none", boxShadow: "0 15px 45px rgba(43, 39, 36, 0.05)", animation: "slideIn 0.3s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", background: "#e7efe6", color: "#6e8a72", padding: "3px 8px", borderRadius: "100px" }}>
                    FORM 2 • {locale === "fr" ? "PRÉFÉRENCES" : "PREFERENCES"}
                  </span>
                </div>
                <h2 className="u-serif" style={{ fontSize: "26px", fontWeight: "600", marginBottom: "12px", textAlign: "center" }}>
                  🍽️ {locale === "fr" ? "Votre choix de menu" : "Select your main course"}
                </h2>
                <p style={{ color: "#8a817c", textAlign: "center", marginBottom: "24px" }}>
                  {locale === "fr" ? "Veuillez sélectionner votre plat principal pour la réception." : "Crafted beautifully by Ember & Oak catering team. Select for your party:"}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                  {PREFERENCES_MEALS.map((meal) => (
                    <button
                      key={meal.id}
                      onClick={() => setPrefMeal(meal.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "16px 20px",
                        textAlign: "left",
                        background: prefMeal === meal.id ? "rgba(176, 124, 130, 0.06)" : "white",
                        border: prefMeal === meal.id ? "2px solid var(--primary)" : "1px solid var(--border)",
                        borderRadius: "14px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontSize: "24px" }}>{meal.icon}</span>
                      <span style={{ fontSize: "16px", fontWeight: "600" }}>{meal.name}</span>
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => setFormStep(4)}
                    style={{
                      flex: 1,
                      minHeight: "52px",
                      background: "rgba(67, 53, 58, 0.05)",
                      border: "none",
                      borderRadius: "14px",
                      color: "var(--text)",
                      fontWeight: "600",
                    }}
                  >
                    {t.common.back}
                  </button>
                  <button
                    onClick={handleSavePrefs}
                    disabled={submittingPrefs || !prefMeal}
                    style={{
                      flex: 2,
                      minHeight: "52px",
                      background: "var(--primary)",
                      border: "none",
                      borderRadius: "14px",
                      color: "white",
                      fontWeight: "600",
                    }}
                  >
                    {submittingPrefs ? t.common.saving : (locale === "fr" ? "Enregistrer" : "Save Preferences")}
                  </button>
                </div>
              </div>
            )}

            {/* Step 6: RSVP Re-Check Arrival time (Published closer to event) */}
            {formStep === 6 && (
              <div className="card" style={{ maxWidth: "100%", border: "none", boxShadow: "0 15px 45px rgba(43, 39, 36, 0.05)", animation: "slideIn 0.3s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", background: "rgba(176, 124, 130, 0.15)", color: "var(--primary)", padding: "3px 8px", borderRadius: "100px" }}>
                    FORM 3 • {locale === "fr" ? "VÉRIFICATION FINALE" : "FINAL RE-CHECK"}
                  </span>
                </div>
                <h2 className="u-serif" style={{ fontSize: "26px", fontWeight: "600", marginBottom: "12px" }}>
                  ✈️ {locale === "fr" ? "Quand arrivez-vous ?" : "When do you arrive?"}
                </h2>
                <p style={{ color: "#8a817c", marginBottom: "24px" }}>
                  {locale === "fr" ? "Nous organisons des navettes depuis l'aéroport et le centre-ville. Indiquez vos prévisions :" : "We are coordinating shuttle buses and airport transfers. Let us know when you expect to land/drive in:"}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                  {[
                    { id: "fri-morning", text: locale === "fr" ? "Vendredi 19 Sept - Matin" : "Friday Sept 19 - Morning" },
                    { id: "fri-afternoon", text: locale === "fr" ? "Vendredi 19 Sept - Après-midi" : "Friday Sept 19 - Afternoon" },
                    { id: "sat-morning", text: locale === "fr" ? "Samedi 20 Sept - Matin (Jour J)" : "Saturday Sept 20 - Morning (Wedding Day)" },
                  ].map((arrival) => (
                    <button
                      key={arrival.id}
                      onClick={() => setRecheckArrival(arrival.id)}
                      style={{
                        padding: "16px 20px",
                        textAlign: "left",
                        background: recheckArrival === arrival.id ? "rgba(176, 124, 130, 0.06)" : "white",
                        border: recheckArrival === arrival.id ? "2px solid var(--primary)" : "1px solid var(--border)",
                        borderRadius: "14px",
                        fontWeight: "600",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {arrival.text}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => setFormStep(5)}
                    style={{
                      flex: 1,
                      minHeight: "52px",
                      background: "rgba(67, 53, 58, 0.05)",
                      border: "none",
                      borderRadius: "14px",
                      color: "var(--text)",
                      fontWeight: "600",
                    }}
                  >
                    {t.common.back}
                  </button>
                  <button
                    onClick={() => setFormStep(7)}
                    disabled={!recheckArrival}
                    style={{
                      flex: 2,
                      minHeight: "52px",
                      background: "var(--primary)",
                      border: "none",
                      borderRadius: "14px",
                      color: "white",
                      fontWeight: "600",
                    }}
                  >
                    {locale === "fr" ? "Continuer" : "Next step"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 7: RSVP Re-Check Hotel details */}
            {formStep === 7 && (
              <div className="card" style={{ maxWidth: "100%", border: "none", boxShadow: "0 15px 45px rgba(43, 39, 36, 0.05)", animation: "slideIn 0.3s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", background: "rgba(176, 124, 130, 0.15)", color: "var(--primary)", padding: "3px 8px", borderRadius: "100px" }}>
                    FORM 3 • {locale === "fr" ? "VÉRIFICATION FINALE" : "FINAL RE-CHECK"}
                  </span>
                </div>
                <h2 className="u-serif" style={{ fontSize: "26px", fontWeight: "600", marginBottom: "12px", textAlign: "center" }}>
                  🏨 {locale === "fr" ? "Où séjournez-vous ?" : "Where are you staying?"}
                </h2>
                <p style={{ color: "#8a817c", textAlign: "center", marginBottom: "24px" }}>
                  {locale === "fr" ? "Aidez-nous à confirmer le trajet des navettes de retour de soirée." : "This helps our planners route the late-night departure shuttles directly to your hotels!"}
                </p>

                <div className="field" style={{ marginBottom: "24px" }}>
                  <input
                    type="text"
                    value={recheckHotel}
                    onChange={(e) => setRecheckHotel(e.target.value)}
                    placeholder={locale === "fr" ? "Nom de l'hôtel, AirBnB ou hébergement..." : "Hotel name, AirBnB, or lodging..."}
                  />
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => setFormStep(6)}
                    style={{
                      flex: 1,
                      minHeight: "52px",
                      background: "rgba(67, 53, 58, 0.05)",
                      border: "none",
                      borderRadius: "14px",
                      color: "var(--text)",
                      fontWeight: "600",
                    }}
                  >
                    {t.common.back}
                  </button>
                  <button
                    onClick={handleSaveRecheck}
                    disabled={submittingRecheck || !recheckHotel}
                    style={{
                      flex: 2,
                      minHeight: "52px",
                      background: "var(--primary)",
                      border: "none",
                      borderRadius: "14px",
                      color: "white",
                      fontWeight: "600",
                    }}
                  >
                    {submittingRecheck ? t.common.saving : (locale === "fr" ? "Enregistrer" : "Finish Final Re-Check")}
                  </button>
                </div>
              </div>
            )}

            {/* Step 8: Complete Screen */}
            {formStep === 8 && (
              <div className="card confirmation" style={{ maxWidth: "100%", border: "none", boxShadow: "0 15px 45px rgba(43, 39, 36, 0.05)", animation: "slideIn 0.3s ease" }}>
                <div className="icon" style={{ fontSize: "54px" }}>🌸</div>
                <h2 className="u-serif" style={{ fontSize: "28px", fontWeight: "600", margin: "16px 0 8px" }}>
                  {locale === "fr" ? "Tout est parfait !" : "You're all set!"}
                </h2>
                <p style={{ color: "#8a817c", fontSize: "16px", marginBottom: "24px" }}>
                  {locale === "fr"
                    ? `Merci ${invitation.guest_first_name} ! Toutes vos réponses et préférences ont été partagées en direct avec les organisateurs.`
                    : `Thank you, ${invitation.guest_first_name}! All forms have been successfully completed. Your preferences have been saved and shared with Maya & Daniel.`}
                </p>

                <div style={{
                  background: "rgba(110, 138, 114, 0.08)",
                  border: "1px solid rgba(110, 138, 114, 0.2)",
                  borderRadius: "12px",
                  padding: "16px",
                  textAlign: "left",
                  marginBottom: "24px",
                }}>
                  <h4 style={{ margin: "0 0 6px", color: "var(--success)", fontWeight: "bold" }}>
                    ✓ {locale === "fr" ? "Résumé des réponses :" : "Answers Summary:"}
                  </h4>
                  <p style={{ margin: "4px 0", fontSize: "14px" }}>
                    <strong>RSVP:</strong> {rsvpChoice === "attending" ? (locale === "fr" ? "Présent" : "Attending") : (locale === "fr" ? "Absent" : "Declined")} ({partySizeChoice} {locale === "fr" ? "invité" : "guests"})
                  </p>
                  {prefSong && (
                    <p style={{ margin: "4px 0", fontSize: "14px" }}>
                      <strong>{locale === "fr" ? "Chanson:" : "Song:"}</strong> {prefSong === "custom" ? prefSongCustom : prefSong}
                    </p>
                  )}
                  {prefMeal && (
                    <p style={{ margin: "4px 0", fontSize: "14px" }}>
                      <strong>plat:</strong> {prefMeal}
                    </p>
                  )}
                  {recheckHotel && (
                    <p style={{ margin: "4px 0", fontSize: "14px" }}>
                      <strong>Hôtel:</strong> {recheckHotel}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setFormStep(1);
                    setPrefsSaved(false);
                    setRecheckSaved(false);
                  }}
                  style={{
                    minHeight: "48px",
                    width: "100%",
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    color: "var(--text)",
                    fontWeight: "600",
                  }}
                >
                  🔄 {locale === "fr" ? "Recommencer" : "Update my replies"}
                </button>
              </div>
            )}
          </div>
        )}


        {/* TAB 2: TRAVEL & CONNECTIONS BOARD */}
        {activeTab === "travel" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div style={{ marginBottom: "28px" }}>
              <span className="u-kicker" style={{ color: "#b07c82" }}>
                {locale === "fr" ? "COVOITURAGE & COORDINATION" : "TRAVEL & CARSHARING"}
              </span>
              <h2 className="u-serif" style={{ fontSize: "28px", fontWeight: "600", margin: "6px 0 10px" }}>
                {locale === "fr" ? "Voyager ensemble" : "Travel with other guests"}
              </h2>
              <p style={{ color: "#8a817c" }}>
                {locale === "fr"
                  ? "Identifiez d'autres invités qui effectuent des trajets similaires vers le domaine ou l'aéroport et organisez un covoiturage !"
                  : "Find guests flying into similar hubs or driving from nearby cities. Share details, reduce carbon footprints, and save costs!"}
              </p>
            </div>

            {/* Self Travel Sharing Panel */}
            <div className="card" style={{
              maxWidth: "100%",
              background: guestTravelShared ? "rgba(110, 138, 114, 0.05)" : "rgba(255,252,250,0.8)",
              border: guestTravelShared ? "1.5px solid var(--success)" : "1.5px dashed var(--border)",
              borderRadius: "16px",
              padding: "24px",
              marginBottom: "32px",
            }}>
              {!guestTravelShared ? (
                <div>
                  <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "700" }}>
                    🚗 {locale === "fr" ? "Proposer un trajet ou chercher un binôme ?" : "Share your travel plans"}
                  </h3>
                  <p style={{ color: "#8a817c", fontSize: "14px", marginBottom: "18px" }}>
                    {locale === "fr" ? "En partageant vos plans de transport, vous apparaissez sur ce tableau." : "By posting your details, other guests can request to coordinate rides or share taxis."}
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                    <div>
                      <label style={{ fontSize: "12px" }}>{locale === "fr" ? "Départ de" : "Origin City / Hub"}</label>
                      <input
                        type="text"
                        value={guestFrom}
                        onChange={(e) => setGuestFrom(e.target.value)}
                        placeholder="e.g. Portland Airport (PDX)"
                        style={{ minHeight: "42px", fontSize: "14px", padding: "8px 12px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "12px" }}>{locale === "fr" ? "Date de trajet" : "Travel Date"}</label>
                      <select
                        value={guestDate}
                        onChange={(e) => setGuestDate(e.target.value)}
                        style={{ minHeight: "42px", fontSize: "14px", padding: "8px 12px" }}
                      >
                        <option value="Sept 18">Friday Sept 18</option>
                        <option value="Sept 19">Saturday Sept 19</option>
                        <option value="Sept 20">Sunday Sept 20</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                    <div>
                      <label style={{ fontSize: "12px" }}>{locale === "fr" ? "Mode de transport" : "Method"}</label>
                      <select
                        value={guestMethod}
                        onChange={(e) => setGuestMethod(e.target.value)}
                        style={{ minHeight: "42px", fontSize: "14px", padding: "8px 12px" }}
                      >
                        <option value="Driving">{locale === "fr" ? "Je conduis" : "I am driving"}</option>
                        <option value="Flying">{locale === "fr" ? "Je prends l'avion" : "I am flying / Train"}</option>
                        <option value="Taxi Share">{locale === "fr" ? "Je cherche un taxi" : "Looking to share taxi"}</option>
                      </select>
                    </div>
                    {guestMethod === "Driving" && (
                      <div>
                        <label style={{ fontSize: "12px" }}>{locale === "fr" ? "Places dispo." : "Seats available"}</label>
                        <select
                          value={guestSeats}
                          onChange={(e) => setGuestSeats(e.target.value)}
                          style={{ minHeight: "42px", fontSize: "14px", padding: "8px 12px" }}
                        >
                          <option value="1">1 seat</option>
                          <option value="2">2 seats</option>
                          <option value="3">3 seats</option>
                          <option value="4">4+ seats</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: "18px" }}>
                    <label style={{ fontSize: "12px" }}>{locale === "fr" ? "Remarques (Optionnel)" : "Notes"}</label>
                    <input
                      type="text"
                      value={guestNotes}
                      onChange={(e) => setGuestNotes(e.target.value)}
                      placeholder={locale === "fr" ? "Ex: Vol UA123 arrivant à 14h, ou coffre spacieux..." : "e.g., flight lands at 2pm, or plenty of space for bags..."}
                      style={{ minHeight: "42px", fontSize: "14px", padding: "8px 12px" }}
                    />
                  </div>

                  <button
                    onClick={handleAddMyTravel}
                    disabled={!guestFrom.trim()}
                    className="btn"
                    style={{ minHeight: "44px", fontSize: "14px", marginTop: 0 }}
                  >
                    ✨ {locale === "fr" ? "Rejoindre le tableau" : "Publish My Travel Details"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "bold", background: "var(--success-bg)", color: "var(--success)", padding: "3px 8px", borderRadius: "100px" }}>
                      {locale === "fr" ? "VOTRE TRAJET EST EN LIGNE" : "YOUR PLANS ARE LIVE"}
                    </span>
                    <h4 style={{ margin: "8px 0 4px", fontSize: "16px", fontWeight: "700" }}>
                      {locale === "fr" ? "Départ de" : "Driving/Traveling from"} {guestFrom}
                    </h4>
                    <p style={{ margin: 0, fontSize: "13px", color: "#8a817c" }}>
                      {guestDate} • {guestMethod} {guestMethod === "Driving" ? `• ${guestSeats} spots` : ""}
                    </p>
                    {guestNotes && (
                      <p style={{ margin: "6px 0 0", fontSize: "13px", fontStyle: "italic", color: "#8a817c" }}>
                        "{guestNotes}"
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleRemoveMyTravel}
                    style={{
                      background: "rgba(192, 85, 59, 0.08)",
                      color: "var(--danger)",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    ✕ {locale === "fr" ? "Retirer" : "Remove"}
                  </button>
                </div>
              )}
            </div>

            {/* List of Other Guests */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <span className="u-kicker" style={{ marginBottom: "-4px" }}>
                {locale === "fr" ? "OPTIONS DE COVOITURAGES DISPONIBLES" : "AVAILABLE COORDINATION OPTIONS"}
              </span>

              {connections.map((match) => (
                <div key={match.id} className="card" style={{
                  maxWidth: "100%",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  padding: "20px",
                  boxShadow: "0 8px 24px rgba(43, 39, 36, 0.02)",
                  background: "white",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <h4 style={{ margin: "0 0 2px", fontSize: "17px", fontWeight: "700" }}>{match.name}</h4>
                      <p style={{ margin: 0, fontSize: "13px", color: "#b07c82", fontWeight: "600" }}>
                        📍 {locale === "fr" ? "Depuis" : "From"} {match.from}
                      </p>
                    </div>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      padding: "3px 10px",
                      borderRadius: "100px",
                      background: match.hasSeats ? "#e7efe6" : "rgba(67, 53, 58, 0.05)",
                      color: match.hasSeats ? "var(--success)" : "var(--text)",
                    }}>
                      {match.hasSeats
                        ? (locale === "fr" ? `${match.seatsAvailable} places` : `${match.seatsAvailable} seats left`)
                        : (locale === "fr" ? "En recherche" : "Looking for ride")}
                    </span>
                  </div>

                  <p style={{ margin: "8px 0", fontSize: "14px", color: "var(--text)" }}>
                    {locale === "fr" ? "Départ prévu :" : "Travel date:"} <strong>{match.date}</strong> • {match.method}
                  </p>

                  {match.notes && (
                    <p style={{
                      margin: "8px 0 16px",
                      fontSize: "13px",
                      color: "#8a817c",
                      background: "rgba(67,53,58,0.03)",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontStyle: "italic",
                    }}>
                      "{match.notes}"
                    </p>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    {match.id === "my-connection" ? (
                      <span style={{ fontSize: "13px", color: "var(--success)", fontWeight: "600" }}>
                        ✓ {locale === "fr" ? "Votre propre annonce" : "This is your listing"}
                      </span>
                    ) : match.requested ? (
                      <span style={{
                        fontSize: "13px",
                        color: "var(--success)",
                        fontWeight: "600",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        📩 {locale === "fr" ? "Demande envoyée !" : "Request pending host approval!"}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleContactRequest(match.id)}
                        style={{
                          background: "none",
                          border: "1px solid var(--primary)",
                          color: "var(--primary)",
                          padding: "8px 16px",
                          borderRadius: "100px",
                          fontSize: "13px",
                          fontWeight: "bold",
                          transition: "all 0.15s ease",
                        }}
                      >
                        ✉️ {locale === "fr" ? "Demander le contact" : "Request Contact Details"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Contact Modal */}
            {activeModal && (
              <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(67, 53, 58, 0.4)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: "20px",
              }}>
                <div className="card" style={{ background: "white", padding: "28px", maxWidth: "420px", textAlign: "center", animation: "zoomIn 0.2s ease" }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>🕊️</div>
                  <h3 className="u-serif" style={{ fontSize: "22px", margin: "0 0 8px" }}>
                    {locale === "fr" ? "Demande transmise !" : "Contact Request Sent!"}
                  </h3>
                  <p style={{ color: "#8a817c", fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>
                    {locale === "fr"
                      ? "Pour protéger la vie privée, nous avons notifié cet invité par SMS/E-mail. Dès qu'il accepte, ses coordonnées vous seront partagées !"
                      : "To keep our guest's details secure, we've sent them a connection request. Once approved, you will get an email with their details."}
                  </p>
                  <button
                    onClick={() => setActiveModal(null)}
                    style={{
                      width: "100%",
                      minHeight: "44px",
                      background: "var(--primary)",
                      border: "none",
                      color: "white",
                      fontWeight: "bold",
                      borderRadius: "12px",
                    }}
                  >
                    {locale === "fr" ? "Super, merci" : "Excellent, thank you"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}


        {/* TAB 3: LOGISTICS & INFORMATION */}
        {activeTab === "info" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div style={{ marginBottom: "28px" }}>
              <span className="u-kicker" style={{ color: "#b07c82" }}>
                {locale === "fr" ? "ORGANISATION ET INFOS" : "TIMINGS & ACCOMMODATIONS"}
              </span>
              <h2 className="u-serif" style={{ fontSize: "28px", fontWeight: "600", margin: "6px 0 10px" }}>
                {locale === "fr" ? "Le Programme & Infos utiles" : "The Schedule & Stays"}
              </h2>
              <p style={{ color: "#8a817c" }}>
                {locale === "fr"
                  ? "Découvrez l'adresse du domaine, le déroulé de la journée du samedi et les meilleures options de logements recommandés."
                  : "Everything you need to plan your stay: where to rest, when to arrive, and local gems to explore."}
              </p>
            </div>

            {/* Address & Location Card */}
            <div className="card" style={{
              maxWidth: "100%",
              background: "white",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "24px",
              marginBottom: "24px",
            }}>
              <h3 className="u-serif" style={{ margin: "0 0 12px", fontSize: "20px", fontWeight: "700" }}>
                📍 {locale === "fr" ? "Le Lieu du Mariage" : "The Venue Address"}
              </h3>
              <p style={{ margin: "0 0 6px", fontWeight: "bold", fontSize: "16px" }}>{invitation.venue_name}</p>
              <p style={{ margin: "0 0 16px", color: "#8a817c", fontSize: "14px" }}>{invitation.venue_address}</p>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(invitation.venue_address ?? "")}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "var(--primary)",
                  borderBottom: "1px dashed var(--primary)",
                  paddingBottom: "2px"
                }}
              >
                🗺️ {locale === "fr" ? "Ouvrir dans Google Maps" : "Open in Google Maps"}
              </a>
            </div>

            {/* Program / Timeline of Saturday */}
            <div style={{ marginBottom: "32px" }}>
              <span className="u-kicker" style={{ display: "block", marginBottom: "12px" }}>
                {locale === "fr" ? "DÉROULÉ DE LA JOURNÉE" : "SATURDAY TIMINGS"}
              </span>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { time: "4:00 PM", title: locale === "fr" ? "Cérémonie Laïque" : "Outdoor Ceremony", loc: "The Lawn (Please arrive 15m early)" },
                  { time: "4:30 PM", title: locale === "fr" ? "Cocktail & Musique live" : "Cocktails & Canapés", loc: "The Orchard Grove" },
                  { time: "6:00 PM", title: locale === "fr" ? "Dîner de réception" : "Reception Dinner", loc: "The Grand Barn" },
                  { time: "11:00 PM", title: locale === "fr" ? "Fin de soirée & Navettes" : "Late-night Shuttles", loc: "Front Drive Departure" },
                ].map((item, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    gap: "16px",
                    background: "rgba(255,252,250,0.6)",
                    border: "1px solid rgba(67,53,58,0.06)",
                    borderRadius: "12px",
                    padding: "14px 18px",
                  }}>
                    <span style={{ fontSize: "14px", fontWeight: "bold", color: "var(--primary)", width: "70px", flexShrink: 0 }}>
                      {item.time}
                    </span>
                    <div>
                      <h4 style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: "700" }}>{item.title}</h4>
                      <p style={{ margin: 0, fontSize: "13px", color: "#8a817c" }}>{item.loc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Stays Section */}
            <div>
              <span className="u-kicker" style={{ display: "block", marginBottom: "12px" }}>
                {locale === "fr" ? "HÉBERGEMENTS RECOMMANDÉS" : "RECOMMENDED STAYS"}
              </span>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[
                  {
                    name: "The Hood River Orchard Inn",
                    distance: "5 mins from venue",
                    price: "$180/night",
                    block: "Room block: 'MAYA-DANIEL' (15% off before June 30)",
                    note: "Highly recommended. Shuttles pick up directly from this lobby.",
                  },
                  {
                    name: "Columbia River Boutique Hotel",
                    distance: "12 mins from venue",
                    price: "$240/night",
                    block: "Book directly on website",
                    note: "Gorgeous river-view rooms and rooftop pool.",
                  },
                ].map((hotel, index) => (
                  <div key={index} className="card" style={{
                    maxWidth: "100%",
                    background: "white",
                    border: "1px solid var(--border)",
                    borderRadius: "16px",
                    padding: "20px",
                    boxShadow: "0 8px 24px rgba(43, 39, 36, 0.02)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>{hotel.name}</h4>
                      <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--primary)" }}>{hotel.price}</span>
                    </div>
                    <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#b07c82", fontWeight: "600" }}>
                      🚗 {hotel.distance}
                    </p>
                    <p style={{ margin: "0 0 8px", fontSize: "13px", background: "rgba(110, 138, 114, 0.08)", color: "var(--success)", padding: "6px 10px", borderRadius: "8px", fontWeight: "bold" }}>
                      🔑 {hotel.block}
                    </p>
                    <p style={{ margin: 0, fontSize: "13px", color: "#8a817c" }}>
                      {hotel.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


        {/* TAB 4: FAQs SECTION */}
        {activeTab === "faqs" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div style={{ marginBottom: "28px" }}>
              <span className="u-kicker" style={{ color: "#b07c82" }}>
                {locale === "fr" ? "QUESTIONS FRÉQUENTES" : "FREQUENTLY ASKED QUESTIONS"}
              </span>
              <h2 className="u-serif" style={{ fontSize: "28px", fontWeight: "600", margin: "6px 0 10px" }}>
                {locale === "fr" ? "Des questions ?" : "Got questions?"}
              </h2>
              <p style={{ color: "#8a817c" }}>
                {locale === "fr"
                  ? "Nous avons rassemblé ici toutes les informations utiles sur le dress code, les enfants, le parking et les cadeaux."
                  : "We gathered all practical information to make your weekend as seamless as possible."}
              </p>
            </div>

            <FaqAccordion locale={locale} />
          </div>
        )}

      </main>

      {/* Styled Animations via standard HTML style tag to prevent styled-jsx Next.js compiler errors */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes zoomIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}} />
    </div>
  );
}

// Sub-component for FAQ Accordion to handle open/close individually
function FaqAccordion({ locale }: { locale: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: locale === "fr" ? "Quel est le dress code ?" : "What is the dress code?",
      a: locale === "fr"
        ? "Le dress code est 'Garden Chic'. Pensez à des tenues printanières élégantes mais adaptées aux pelouses extérieures. Évitez les talons trop fins pour ne pas vous enfoncer !"
        : "The dress code is Garden Elegant. Summer suits, cocktail dresses, and pastel tones are highly encouraged. Please note both ceremony and cocktails are on open lawn fields, so block heels or flats are highly recommended!",
    },
    {
      q: locale === "fr" ? "Puis-je amener des enfants ?" : "Are children welcome?",
      a: locale === "fr"
        ? "Bien que nous adorions vos petits loups, nous avons choisi de célébrer notre journée entre adultes. Merci de votre compréhension !"
        : "We love your little ones, but our wedding will be an adults-only celebration. We hope you can join us and enjoy a night off!",
    },
    {
      q: locale === "fr" ? "Y a-t-il un parking sur place ?" : "Is there parking at the venue?",
      a: locale === "fr"
        ? "Oui ! Un grand parking gratuit est accessible directement à l'entrée du Domaine. Vous pouvez également laisser votre voiture toute la nuit et prendre l'une de nos navettes gratuites de retour."
        : "Yes, free parking is available on-site at Wildflower Barn. You can also leave your car parked overnight and ride our free shuttles back to your hotel, picking it up on Sunday morning by 11 AM.",
    },
    {
      q: locale === "fr" ? "Quel type de cadeaux préférez-vous ?" : "Where are you registered?",
      a: locale === "fr"
        ? "Votre présence à nos côtés est le plus beau des cadeaux. Si vous souhaitez néanmoins nous gâter, une urne nuptiale sera à votre disposition pour contribuer à notre voyage de noces au Japon."
        : "Your presence is our biggest gift! If you wish to contribute to our future together, we have set up a honeymoon fund for our dream trip to Japan.",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            style={{
              background: "white",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              overflow: "hidden",
              boxShadow: "0 6px 15px rgba(43, 39, 36, 0.01)",
              transition: "all 0.2s ease",
            }}
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : index)}
              style={{
                width: "100%",
                background: "none",
                border: "none",
                padding: "18px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                textAlign: "left",
                fontWeight: "600",
                fontSize: "15px",
                color: "var(--text)",
              }}
            >
              <span>{faq.q}</span>
              <span style={{
                fontSize: "18px",
                color: "var(--primary)",
                transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}>
                ＋
              </span>
            </button>

            {isOpen && (
              <div style={{
                padding: "0 20px 18px",
                fontSize: "14px",
                color: "#8a817c",
                lineHeight: "1.6",
                borderTop: "1px solid rgba(67, 53, 58, 0.04)",
                background: "rgba(255,252,250,0.5)",
                animation: "fadeIn 0.2s ease",
              }}>
                <p style={{ margin: "12px 0 0" }}>{faq.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
