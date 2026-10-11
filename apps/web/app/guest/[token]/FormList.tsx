"use client";

import { useLocale } from "@/lib/i18n/client";

/** Where a form stands for this guest. */
export type FormState = "todo" | "done" | "soon" | "closed";

export type FormItem = {
  key: string;
  title: string;
  /** One line under the title: the form's context, or the guest's answer. */
  meta?: string;
  state: FormState;
  /** Opens the form; absent when it can't be opened (not open yet, closed). */
  onOpen?: () => void;
  /** Overrides the action's label ("Confirm" for the final check-in). */
  actionLabel?: string;
};

function StateIcon({ state }: { state: FormState }) {
  return (
    <span className="gh-task-icon" aria-hidden="true">
      {state === "done" && (
        <svg viewBox="0 0 16 16">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      )}
      {state === "closed" && (
        <svg viewBox="0 0 16 16">
          <path d="M4.5 8h7" />
        </svg>
      )}
    </span>
  );
}

/**
 * Every form the couple asks the guest to fill in — the RSVP, its final
 * check-in, their own forms — as one checklist: the same card for each, a
 * state icon, the state in words (never colour alone), and one action.
 */
export function FormList({ items }: { items: FormItem[] }) {
  const { t } = useLocale();
  const hub = t.guestHub;
  const stateLabel: Record<FormState, string> = {
    todo: hub.statusPending,
    done: hub.statusDone,
    soon: hub.statusSoon,
    closed: hub.statusClosed,
  };

  return (
    <ul className="gh-list">
      {items.map((item) => (
        <li key={item.key} className={`gh-card gh-task is-${item.state}`}>
          <StateIcon state={item.state} />
          <div className="gh-task-text">
            <h3 className="gh-card-title">{item.title}</h3>
            {item.meta ? <p className="gh-card-meta">{item.meta}</p> : null}
            <p className="gh-status">{stateLabel[item.state]}</p>
          </div>
          {item.onOpen ? (
            <button
              type="button"
              className={item.state === "todo" ? "gh-btn gh-btn--small" : "gh-btn gh-btn--small gh-btn--ghost"}
              onClick={item.onOpen}
            >
              {item.actionLabel ?? (item.state === "todo" ? hub.reply : hub.edit)}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
