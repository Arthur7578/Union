"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocale } from "@/lib/i18n/client";
import "./Flow.css";

/** What `onNext` may answer: stay (`false`), go on, or jump to a step key. */
type NextResult = void | boolean | string;

/**
 * One screen of a question-by-question form. The steps are recomputed by the
 * parent on every render, from its own answers, so a choice can add or remove
 * the steps after it (a guest who declines is never asked about their diet).
 */
export type FlowStep = {
  key: string;
  /** `intro` and `end` are framing screens: not numbered, not counted. */
  kind?: "intro" | "question" | "end";
  /** Shown above the title (an ornament on a framing screen). */
  before?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The answer field(s). */
  body?: React.ReactNode;
  /** Whether the answer lets the guest move on. Defaults to true. */
  valid?: boolean;
  /** Shown when they try to move on while `valid` is false. */
  invalidMessage?: string;
  /** Label of the button that moves on (defaults to OK / Start). */
  okLabel?: string;
  /** The button's label while `onNext` runs (defaults to "Saving…"). */
  busyLabel?: string;
  /** No button: the step moves on by itself (a single choice), or not at all. */
  hideOk?: boolean;
  /** Runs when the guest moves on. Throwing keeps them on the step. */
  onNext?: () => NextResult | Promise<NextResult>;
};

type FlowApi = {
  /** Validate the current step and move on. */
  next: () => void;
  /** Move on after a beat, so a picked choice can blink first. */
  nextSoon: () => void;
  /** Go straight to a step, without validating the current one. */
  goTo: (key: string) => void;
  /** False while a step is leaving: its fields stop taking keys. */
  active: boolean;
};

const FlowContext = createContext<FlowApi>({
  next: () => {},
  nextSoon: () => {},
  goTo: () => {},
  active: false,
});

/** For answer fields: move the form on from inside a step. */
export function useFlow() {
  return useContext(FlowContext);
}

const LEAVE_MS = 240;
const BLINK_MS = 420;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Typing in a field: Enter and the arrow keys belong to it, not to the form. */
const isTextField = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "checkbox"));

/**
 * A full-screen form that asks one thing at a time, in the manner of
 * Typeform: the question large, the answer under it, OK or Enter to move on,
 * a thin progress line at the top and arrows to go back.
 */
export function Flow({
  label,
  steps,
  onClose,
  topRight,
}: {
  /** Shown small at the top, and the dialog's accessible name. */
  label: string;
  steps: FlowStep[];
  /** Without it there is no close button: a step the guest must get through. */
  onClose?: () => void;
  /** Extra controls at the top right, before the close button. */
  topRight?: React.ReactNode;
}) {
  const { t } = useLocale();
  const copy = t.guestFlow;

  const [currentKey, setCurrentKey] = useState(steps[0]?.key ?? "");
  const [leaving, setLeaving] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [showInvalid, setShowInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // The steps can change between a click and the moment the next one is
  // picked (onNext saves state, the parent re-renders): always read the
  // latest from refs, never from a stale closure.
  const stepsRef = useRef(steps);
  const keyRef = useRef(currentKey);
  const busyRef = useRef(false);
  const leavingRef = useRef(false);
  const lastIndex = useRef(0);
  const timers = useRef<number[]>([]);
  const stepEl = useRef<HTMLElement>(null);

  useEffect(() => {
    stepsRef.current = steps;
    keyRef.current = currentKey;
  });

  // The step on its way out stays on screen as it was when the guest moved
  // on, even if its answer has since removed it from the list (an added
  // companion, a cancelled addition).
  const [outgoing, setOutgoing] = useState<{ step: FlowStep; number: number } | null>(null);
  const found = steps.findIndex((s) => s.key === currentKey);
  const index = found >= 0 ? found : 0;
  useEffect(() => {
    if (found >= 0) lastIndex.current = found;
  });
  const frozen = (leaving || found < 0) && outgoing ? outgoing : null;
  const step = frozen ? frozen.step : steps[index];
  const kind = step?.kind ?? "question";

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  // Lock the page behind the form.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /** Leave the current step, then show whichever step `pick` names. */
  const go = useCallback(
    (pick: () => string | undefined, dir: 1 | -1, from?: FlowStep) => {
      setDirection(dir);
      setShowInvalid(false);
      setFailure(null);
      const list = stepsRef.current;
      const leavingStep = from ?? list.find((s) => s.key === keyRef.current);
      const questions = list.filter((s) => (s.kind ?? "question") === "question");
      setOutgoing(leavingStep ? { step: leavingStep, number: questions.indexOf(leavingStep) + 1 } : null);
      leavingRef.current = true;
      const land = () => {
        const target = pick();
        leavingRef.current = false;
        setLeaving(false);
        if (target) {
          // Now, not after the next render: a choice picked the instant the
          // step appears must know which step it belongs to.
          keyRef.current = target;
          setCurrentKey(target);
        }
      };
      if (reducedMotion()) {
        later(land, 0);
        return;
      }
      setLeaving(true);
      later(land, LEAVE_MS);
    },
    [later],
  );

  const keyAfter = useCallback((key: string) => {
    const list = stepsRef.current;
    const i = list.findIndex((s) => s.key === key);
    return list[(i >= 0 ? i : lastIndex.current) + 1]?.key;
  }, []);

  const next = useCallback(async () => {
    if (busyRef.current || leavingRef.current) return;
    const list = stepsRef.current;
    const from = keyRef.current;
    const current = list.find((s) => s.key === from) ?? list[lastIndex.current];
    if (!current) return;
    if (current.valid === false) {
      setShowInvalid(true);
      return;
    }
    let jump: string | undefined;
    if (current.onNext) {
      busyRef.current = true;
      setBusy(true);
      setFailure(null);
      try {
        const result = await current.onNext();
        if (result === false) return;
        if (typeof result === "string") jump = result;
      } catch (e) {
        console.error("Form step failed:", e);
        setFailure(e instanceof Error && e.message ? e.message : copy.error);
        return;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    }
    go(() => jump ?? keyAfter(from), 1, current);
  }, [copy.error, go, keyAfter]);

  // Only if the guest is still on the step that asked: a second tap, or the
  // arrows, may already have moved them on.
  const nextSoon = useCallback(() => {
    const asked = keyRef.current;
    later(() => {
      if (keyRef.current === asked) void next();
    }, BLINK_MS);
  }, [later, next]);

  const prevKey = index > 0 && kind !== "end" ? steps[index - 1]?.key : undefined;
  const nextStep = steps[index + 1];
  // The down arrow never skips past the step that sends the answers.
  const canGoDown = kind === "question" && !!nextStep && (nextStep.kind ?? "question") === "question";

  const prev = useCallback(() => {
    if (!prevKey || busyRef.current || leavingRef.current) return;
    go(() => prevKey, -1);
  }, [go, prevKey]);

  // Keyboard: Enter moves on (Shift+Enter is a new line in a long answer),
  // the arrows go back and forth when no field has them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const target = e.target as HTMLElement | null;
      if (e.key === "Enter") {
        if (target?.tagName === "BUTTON" || target?.tagName === "A") return;
        if (target?.tagName === "TEXTAREA" && e.shiftKey) return;
        e.preventDefault();
        void next();
        return;
      }
      if (isTextField(target)) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowDown" && canGoDown) {
        e.preventDefault();
        void next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, canGoDown]);

  // Each new step takes the focus: its first field, or the step itself so a
  // screen reader announces the question.
  useEffect(() => {
    if (leaving) return;
    const el = stepEl.current;
    if (!el) return;
    const field = el.querySelector<HTMLElement>("[data-autofocus]");
    (field ?? el).focus({ preventScroll: true });
  }, [currentKey, leaving]);

  if (!step) return null;

  const questions = steps.filter((s) => (s.kind ?? "question") === "question");
  const questionNumber = frozen ? frozen.number : questions.indexOf(step) + 1;
  const progress =
    kind === "end" ? 1 : kind === "intro" || !questions.length ? 0 : (questionNumber - 1) / questions.length;

  const motion = leaving ? (direction === 1 ? "out-up" : "out-down") : direction === 1 ? "in-up" : "in-down";
  const okLabel = step.okLabel ?? (kind === "intro" ? copy.start : copy.ok);
  const titleId = `flow-title-${step.key}`;

  return (
    <FlowContext.Provider
      value={{
        next: () => void next(),
        nextSoon,
        goTo: (key) => go(() => key, 1),
        active: !leaving && !busy,
      }}
    >
      <div className="tf" role="dialog" aria-modal="true" aria-label={label}>
        <div
          className="tf-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-valuetext={kind === "question" ? copy.progress(questionNumber, questions.length) : undefined}
        >
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>

        <header className="tf-top">
          <span className="tf-label">{label}</span>
          <div className="tf-top-right">
            {topRight}
            {onClose && (
              <button type="button" className="tf-close" onClick={onClose} aria-label={copy.close}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
        </header>

        <div className="tf-stage">
          <section
            key={step.key}
            ref={stepEl}
            tabIndex={-1}
            aria-labelledby={titleId}
            className={`tf-step tf-${kind} tf-${motion}`}
          >
            {step.before}
            <div className="tf-q">
              {kind === "question" && (
                <span className="tf-num" aria-hidden="true">
                  {questionNumber}
                  <svg viewBox="0 0 16 16">
                    <path d="M2 8h11M9 4l4 4-4 4" />
                  </svg>
                </span>
              )}
              <h2 id={titleId} className="tf-title">
                {step.title}
              </h2>
            </div>
            {step.description ? <div className="tf-desc">{step.description}</div> : null}
            {step.body ? <div className="tf-body">{step.body}</div> : null}

            {(showInvalid && step.valid === false) || failure ? (
              <p className="tf-error" role="alert">
                {failure ?? step.invalidMessage ?? copy.required}
              </p>
            ) : null}

            {!step.hideOk && (
              <div className="tf-actions">
                <button type="button" className="tf-ok" onClick={() => void next()} disabled={busy}>
                  {busy ? (step.busyLabel ?? t.common.saving) : okLabel}
                  {!busy && kind === "question" && (
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3 8.5l3.2 3L13 4.5" />
                    </svg>
                  )}
                </button>
                {kind !== "end" && <span className="tf-hint">{copy.pressEnter}</span>}
              </div>
            )}
          </section>
        </div>

        {kind === "question" && (
          <nav className="tf-nav" aria-label={label}>
            <button type="button" onClick={prev} disabled={!prevKey} aria-label={copy.previous}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 10l4-4 4 4" />
              </svg>
            </button>
            <button type="button" onClick={() => void next()} disabled={!canGoDown} aria-label={copy.next}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
          </nav>
        )}
      </div>
    </FlowContext.Provider>
  );
}
