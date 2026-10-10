"use client";

import { useState } from "react";
import { Flow, type FlowStep } from "@/components/guest/flow/Flow";
import { FlowChoices, FlowLongText, FlowText } from "@/components/guest/flow/fields";
import { OliveBranch } from "@/components/guest/OliveBranch";
import { useLocale } from "@/lib/i18n/client";
import { SectionHead } from "./SectionHead";

// Simulated board of guest travel (carsharing / travel buddy matches).
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
  },
];

type Method = "Driving" | "Car Rental" | "Carpool Needed";

/** Sharing one's own trip on the board, one question at a time. */
function ShareTravelFlow({
  onPublish,
  onClose,
}: {
  onPublish: (trip: { from: string; method: Method; seats: string; notes: string }) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const copy = t.travelFlow;
  const [from, setFrom] = useState("");
  const [method, setMethod] = useState<Method | null>(null);
  const [seats, setSeats] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const driving = method === "Driving" || method === "Car Rental";

  const steps: FlowStep[] = [
    {
      key: "intro",
      kind: "intro",
      before: <OliveBranch className="tf-ornament" />,
      title: copy.intro,
      description: copy.introBody,
      body: <p className="tf-meta">{t.guestFlow.duration(1)}</p>,
    },
    {
      key: "from",
      title: copy.from,
      body: <FlowText value={from} onChange={setFrom} placeholder={copy.fromPlaceholder} />,
      valid: from.trim() !== "",
    },
    {
      key: "method",
      title: copy.method,
      body: (
        <FlowChoices
          options={[
            { id: "Driving", label: copy.driving },
            { id: "Car Rental", label: copy.rental },
            { id: "Carpool Needed", label: copy.lookingForRide },
          ]}
          value={method}
          onChange={(id) => {
            setMethod(id as Method);
            if (id === "Carpool Needed") setSeats(null);
          }}
        />
      ),
      valid: method !== null,
      hideOk: method === null,
    },
  ];
  if (driving) {
    steps.push({
      key: "seats",
      title: copy.seats,
      body: (
        <FlowChoices
          options={["0", "1", "2", "3", "4"].map((n) => ({ id: n, label: n === "4" ? "4+" : n }))}
          value={seats}
          onChange={setSeats}
        />
      ),
      valid: seats !== null,
      hideOk: seats === null,
    });
  }
  steps.push(
    {
      key: "notes",
      title: copy.notes,
      description: t.guestFlow.optional,
      body: <FlowLongText value={notes} onChange={setNotes} placeholder={copy.notesPlaceholder} />,
      okLabel: copy.publish,
      onNext: () => onPublish({ from: from.trim(), method: method ?? "Driving", seats: seats ?? "0", notes }),
    },
    {
      key: "end",
      kind: "end",
      before: <OliveBranch className="tf-ornament" />,
      title: copy.thanks,
      description: copy.thanksBody,
      okLabel: t.guestFlow.back,
      onNext: () => {
        onClose();
        return false;
      },
    },
  );

  return <Flow label={copy.intro} steps={steps} onClose={onClose} />;
}

/** Travel & carsharing board: other guests' trips, and sharing one's own. */
export function TravelSection({ guestName }: { guestName: string }) {
  const { t, locale } = useLocale();
  const fr = locale === "fr";
  const [connections, setConnections] = useState(SAMPLE_CONNECTIONS);
  const [requested, setRequested] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const requestContact = (matchId: string) => {
    setConnections((prev) => prev.map((item) => (item.id === matchId ? { ...item, requested: true } : item)));
    setRequested(matchId);
  };

  return (
    <>
      <SectionHead
        title={fr ? "Voyage & covoiturage" : "Travel & carsharing"}
        lead={
          fr
            ? "Repère les invités qui font le même trajet que toi et partage la route."
            : "Meet other guests travelling your way, save on transport and share the ride."
        }
      />

      <div className="gh-center">
        <button type="button" className="gh-btn gh-btn--ghost" onClick={() => setSharing(true)}>
          {t.travelFlow.open}
        </button>
      </div>

      <div className="gh-tickets">
        {connections.length > 0 ? (
          connections.map((match) => (
            <article key={match.id} className="gh-ticket">
              <div className="gh-ticket-head">
                <h3 className="gh-ticket-name">{match.name}</h3>
                <span className="gh-chip">{match.date}</span>
              </div>
              <dl className="gh-facts">
                <div>
                  <dt>{fr ? "Depuis" : "From"}</dt>
                  <dd>{match.from}</dd>
                </div>
                <div>
                  <dt>{fr ? "Moyen" : "Method"}</dt>
                  <dd>{match.method}</dd>
                </div>
              </dl>
              <p className="gh-ticket-notes">{match.notes}</p>
              {match.seatsAvailable > 0 && (
                <p className="gh-seats">
                  {match.seatsAvailable} {fr ? "places disponibles" : "seats open"}
                </p>
              )}
              <button
                type="button"
                className={match.requested ? "gh-btn gh-btn--done" : "gh-btn gh-btn--small"}
                disabled={match.requested}
                onClick={() => requestContact(match.id)}
              >
                {match.requested
                  ? fr
                    ? "Demande envoyée"
                    : "Contact requested"
                  : fr
                    ? "Demander le contact"
                    : "Request contact details"}
              </button>
            </article>
          ))
        ) : (
          <p className="gh-empty">
            {fr ? "Aucun trajet partagé n'est disponible pour le moment." : "No shared travel options available yet."}
          </p>
        )}
      </div>

      {sharing && (
        <ShareTravelFlow
          onClose={() => setSharing(false)}
          onPublish={(trip) =>
            setConnections((prev) => [
              {
                id: `match-custom-${Date.now()}`,
                name: guestName,
                from: trip.from,
                date: "Sept 19",
                method: trip.method,
                hasSeats: Number(trip.seats) > 0,
                seatsAvailable: Number(trip.seats),
                notes: trip.notes.trim() || "Happy to pool travel/share a ride!",
                sharedContact: true,
                requested: false,
              },
              ...prev,
            ])
          }
        />
      )}

      {requested && (
        <div className="gh-dialog-scrim" onClick={() => setRequested(null)}>
          <div
            className="gh-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gh-request-title"
            onClick={(e) => e.stopPropagation()}
          >
            <OliveBranch className="gh-dialog-branch" />
            <h3 id="gh-request-title" className="gh-h3">
              {fr ? "Demande envoyée" : "Request sent"}
            </h3>
            <p className="gh-sub">
              {fr
                ? "Une notification a été transmise à l'invité. S'il accepte, ses coordonnées s'afficheront ici."
                : "The guest has been notified. If they accept sharing their details, they will be sent to your email."}
            </p>
            <button type="button" className="gh-btn" onClick={() => setRequested(null)} autoFocus>
              {fr ? "Fermer" : "Close"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
