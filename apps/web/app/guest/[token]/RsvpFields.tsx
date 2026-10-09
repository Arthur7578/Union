"use client";

import { useLocale } from "@/lib/i18n/client";

type ReplyStatus = "pending" | "attending" | "declined";

/** The guest's own reply: the two buttons, then their dietary needs once
 *  they're coming. */
export function PrimaryReplyFields({
  name,
  status,
  onStatus,
  dietary,
  onDietary,
  labelAttending,
  labelDeclined,
}: {
  name: string;
  status: ReplyStatus;
  onStatus: (status: "attending" | "declined") => void;
  dietary: string;
  onDietary: (value: string) => void;
  labelAttending: string;
  labelDeclined: string;
}) {
  const { t } = useLocale();
  return (
    <div style={{ marginBottom: "24px" }}>
      <p style={{ fontWeight: "bold", color: "var(--accent)", margin: "0 0 10px" }}>
        👤 {name}
      </p>
      <div className="choice-row">
        <button
          onClick={() => onStatus("attending")}
          className={`choice-btn ${status === "attending" ? "selected-yes" : ""}`}
        >
          ✓ {labelAttending}
        </button>
        <button
          onClick={() => onStatus("declined")}
          className={`choice-btn ${status === "declined" ? "selected-no" : ""}`}
        >
          ✗ {labelDeclined}
        </button>
      </div>

      {status === "attending" && (
        <div className="field" style={{ marginTop: "16px" }}>
          <label>🍏 {t.rsvpFields.dietaryLabel}</label>
          <input
            type="text"
            value={dietary}
            onChange={(e) => onDietary(e.target.value)}
            placeholder={t.rsvpFields.dietaryPlaceholder}
          />
        </div>
      )}
    </div>
  );
}

/** The guest's note to the couple. */
export function RsvpMessageField({
  couple,
  value,
  onChange,
}: {
  couple: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="field">
      <label>✍️ {t.rsvpFields.messageLabel(couple)}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.rsvpFields.messagePlaceholder}
        rows={3}
      />
    </div>
  );
}
