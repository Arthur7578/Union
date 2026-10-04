"use client";

import { useEffect, useRef } from "react";
import { T, alpha } from "@/lib/theme";
import "./FairePartEnvelope.css";

interface FairePartEnvelopeProps {
  /** First name of the guest this link was sent to; omit for a generic link. */
  guestName?: string | null;
  partnerOne?: string | null;
  partnerTwo?: string | null;
  /** Already formatted, e.g. "12 juin 2027". */
  weddingDate?: string | null;
  /** Short place line shown on the front of the card. */
  place?: string | null;
  /** Venue name and address, shown on the back of the card. */
  venue?: string | null;
  locale?: string;
  onRespond: () => void;
}

const COPY = {
  fr: {
    titleNamed: "vous avez reçu une invitation",
    titleAnon: ["Vous avez reçu", "une invitation"],
    to: (n: string) => `Pour ${n}`,
    anon: "Faire-part",
    kicker: "Le mariage",
    lead: "Nous serions heureux de vous compter parmi nous.",
    hint: "Touchez le sceau ou faites défiler",
    open: "Ouvrir l'enveloppe",
    flipCard: "Retourner le carton",
    flipHint: "Touchez le carton pour le retourner.",
    skip: "Passer",
    respond: "Répondre à l'invitation",
  },
  en: {
    titleNamed: "you have received an invitation",
    titleAnon: ["You have received", "an invitation"],
    to: (n: string) => `For ${n}`,
    anon: "Invitation",
    kicker: "The wedding",
    lead: "We would be delighted to have you with us.",
    hint: "Tap the seal or scroll",
    open: "Open the envelope",
    flipCard: "Turn the card over",
    flipHint: "Tap the card to turn it over.",
    skip: "Skip",
    respond: "Respond to the invitation",
  },
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Olive sprig: leaves placed along a curved stem (SVG markup from numbers only). */
function sprig(x0: number, y0: number, x1: number, y1: number, n: number, len: number, bend: number) {
  const cx = (x0 + x1) / 2 + bend;
  const cy = (y0 + y1) / 2 - bend;
  let s = `<path d="M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}" fill="none" stroke="currentColor" stroke-width="${len * 0.07}" stroke-linecap="round"/>`;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 0.4);
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
    const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    const ang = (Math.atan2(2 * u * (cy - y0) + 2 * t * (y1 - cy), 2 * u * (cx - x0) + 2 * t * (x1 - cx)) * 180) / Math.PI;
    const side = i % 2 ? 1 : -1;
    const l = len * (1 - t * 0.35);
    const a = ang + side * 42;
    s += `<ellipse cx="${l * 0.5}" cy="0" rx="${l * 0.5}" ry="${l * 0.16}" fill="currentColor" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(1)})"/>`;
  }
  return s;
}

const SPRIG = sprig(6, 18, 54, 8, 5, 11, 4);
const SHADE_A = sprig(200, 0, 40, 150, 9, 46, 30) + sprig(190, 10, 110, 190, 7, 40, -20);
const SHADE_B = sprig(200, 0, 30, 130, 8, 44, 24);

/**
 * Welcome screen for a guest link: a pinned stage where scroll progress drives
 * envelope → flap → folded card → unfolded faire-part → one "respond" button.
 * Envelope and card are photographic layers (public/faire-part); text is live HTML.
 */
export function FairePartEnvelope({
  guestName,
  partnerOne,
  partnerTwo,
  weddingDate,
  place,
  venue,
  locale = "fr",
  onRespond,
}: FairePartEnvelopeProps) {
  const t = locale === "fr" ? COPY.fr : COPY.en;
  const rootRef = useRef<HTMLDivElement>(null);
  const hasName = Boolean(guestName);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const $ = <E extends HTMLElement = HTMLElement>(id: string) => root.querySelector<E>(`[data-id="${id}"]`)!;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const stage = $("stage"), scene = $("scene"), card = $("card"), flap = $("flap");
    const flipper = $("flipper"), cta = $("cta"), head = $("head"), hint = $("hint");
    const recto = $("recto"), verso = $("verso"), fIn = $("fIn"), fOut = $("fOut"), skip = $("skip");
    const envs = [...root.querySelectorAll<HTMLElement>(".env")];
    const lines = [...verso.querySelectorAll<HTMLElement>(".line")];

    let L = { sh: 0, W: 0, H: 0, ch: 0, cardTop: 0, envTop: 0, s0: 1, yIn: 0, yUp: 0 };
    let target = 0, shown = 0, raf = 0, auto = 0, flipTo = 0, flipCur = 0;

    const layout = () => {
      const sw = stage.clientWidth, sh = stage.clientHeight;
      const EH = 0.8767, CR = 0.685; // envelope ratio from the photo; the card is the photographed sheet turned to landscape
      const W = Math.min(sw * 0.84, 440, (sh * 0.46) / EH), H = W * EH;
      const cw = Math.min(sw - 24, 440, (sh - 136) / CR), ch = cw * CR;
      const cardTop = Math.max(18, (sh - 116 - ch) / 2);
      const envTop = sh * 0.5 - H * 0.5 + 14;
      const s0 = (0.84 * W) / cw;
      // the card is longer than the envelope: while it is inside, whatever would stick out below is clipped (see render)
      L = { sh, W, H, ch, cardTop, envTop, s0, yIn: envTop + (H - ch * s0) / 2 - H * 0.06 - cardTop, yUp: Math.max(16, envTop - 0.66 * ch * s0) - cardTop };
      for (const [k, v] of Object.entries({ W, H, cw, ch, cardTop, envTop })) scene.style.setProperty("--" + k, v + "px");
      head.style.top = Math.max(54, envTop - head.offsetHeight - Math.min(40, sh * 0.05)) + "px";
      hint.style.top = Math.min(sh - 84, envTop + H + Math.min(44, sh * 0.055)) + "px";
    };

    const render = (p: number) => {
      const { sh, H, ch, cardTop, envTop, s0, yIn, yUp } = L;
      const out = 1 - seg(p, 0.02, 0.12);
      head.style.opacity = String(out);
      hint.style.opacity = String(out);
      head.style.transform = `translateY(${-18 * (1 - out)}px)`;
      stage.classList.toggle("scrubbing", p > 0.01);

      const deg = 180 * ease(seg(p, 0.06, 0.34));
      const exit = ease(seg(p, 0.52, 0.76)), envY = exit * sh * 1.05, envO = 1 - seg(p, 0.72, 0.76);
      envs.forEach((e) => {
        e.style.opacity = String(envO);
        if (e !== flap) e.style.transform = `translateY(${envY}px)`;
      });
      flap.style.transform = `translateY(${envY}px) perspective(1100px) rotateX(${deg}deg)`;
      const open = deg > 90;
      flap.style.zIndex = open ? "1" : "4";
      fIn.hidden = !open;
      fOut.hidden = open;
      const lift = Math.min(1, deg / 90);
      if (!open) fOut.style.filter = `brightness(${1 + 0.1 * lift}) drop-shadow(${-1 - 5 * lift}px ${3 + 12 * lift}px ${3 + 9 * lift}px ${alpha(T.scrim, 0.5 * (1 - 0.8 * lift))})`;
      flap.style.pointerEvents = p > 0.03 ? "none" : "auto";

      const rise = ease(seg(p, 0.3, 0.55)), fin = ease(seg(p, 0.52, 0.78));
      const y = lerp(lerp(yIn, yUp, rise), 0, fin), s = lerp(s0, 1, fin);
      card.style.transform = `translateY(${y}px) scale(${s})`;
      card.style.setProperty("--lift", String(fin));
      card.style.setProperty("--dim", String(0.92 * (1 - ease(seg(p, 0.08, 0.3)))));

      const below = ch - (envTop + H + envY - 2 - (cardTop + y)) / s; // how much of the card would poke out under the envelope
      card.style.clipPath = below > 0 && envO > 0 ? `inset(-90px -90px ${below}px -90px)` : "none";

      // the card turns over to show its back; after the sequence, a tap turns it again
      const turn = ease(seg(p, 0.74, 0.9)) + flipCur, a = 180 * turn, m = ((a % 360) + 360) % 360, back = m > 90 && m < 270;
      flipper.style.transform = `perspective(1400px) rotateY(${-a}deg)`; // negative: the right edge comes toward the viewer and travels left
      flipper.style.filter = `brightness(${1 - 0.16 * Math.abs(Math.sin((a * Math.PI) / 180))})`;
      recto.hidden = back;
      verso.hidden = !back;
      lines.forEach((el, i) => el.style.setProperty("--o", String(seg(p, 0.84 + i * 0.02, 0.91 + i * 0.02))));
      flipper.classList.toggle("can", p > 0.98);
      flipper.tabIndex = p > 0.98 ? 0 : -1;

      const c = seg(p, 0.92, 1);
      cta.style.opacity = String(c);
      cta.style.transform = `translateY(${(1 - c) * 14}px)`;
      cta.classList.toggle("on", c > 0.5);
      skip.hidden = p > 0.9;
    };

    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
    const tick = () => {
      shown += (target - shown) * 0.2;
      if (Math.abs(target - shown) < 0.0004) shown = target;
      flipCur += (flipTo - flipCur) * 0.14;
      if (Math.abs(flipTo - flipCur) < 0.002) flipCur = flipTo;
      render(shown);
      raf = shown === target && flipCur === flipTo ? 0 : requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      const m = maxScroll();
      target = reduced || m <= 0 ? 1 : clamp(window.scrollY / m);
      kick();
    };
    const play = (to: number, ms: number) => {
      cancelAnimationFrame(auto);
      if (reduced) return;
      const from = window.scrollY, dist = to - from, t0 = performance.now();
      const dur = Math.max(400, (ms * Math.abs(dist)) / Math.max(1, maxScroll()));
      const step = (now: number) => {
        const k0 = clamp((now - t0) / dur), k = k0 < 0.5 ? 2 * k0 * k0 : 1 - Math.pow(-2 * k0 + 2, 2) / 2;
        window.scrollTo(0, from + dist * k);
        if (k0 < 1) auto = requestAnimationFrame(step);
      };
      auto = requestAnimationFrame(step);
    };
    const stopAuto = () => cancelAnimationFrame(auto);
    const onKey = (fn: () => void) => (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        fn();
      }
    };

    const openEnvelope = () => play(maxScroll(), 5600);
    const turnCard = () => {
      if (shown < 0.98) return;
      flipTo += 1;
      if (reduced) flipCur = flipTo;
      kick();
    };
    const skipIntro = () => {
      cancelAnimationFrame(auto);
      window.scrollTo(0, maxScroll());
      shown = target = 1;
      render(1);
    };
    const onResize = () => {
      layout();
      onScroll();
      render(shown);
    };
    const flapKey = onKey(openEnvelope), flipKey = onKey(turnCard);

    (["wheel", "touchstart", "keydown"] as const).forEach((ev) => addEventListener(ev, stopAuto, { passive: true }));
    flap.addEventListener("click", openEnvelope);
    flap.addEventListener("keydown", flapKey);
    flipper.addEventListener("click", turnCard);
    flipper.addEventListener("keydown", flipKey);
    skip.addEventListener("click", skipIntro);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize);

    window.scrollTo(0, 0);
    layout();
    onScroll();
    render(target);
    shown = target;
    document.fonts?.ready.then(() => {
      layout();
      render(shown);
    });

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(auto);
      (["wheel", "touchstart", "keydown"] as const).forEach((ev) => removeEventListener(ev, stopAuto));
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="fp-root" ref={rootRef}>
      <button type="button" className="skip" data-id="skip">{t.skip}</button>

      <main className="track">
        <div className="stage" data-id="stage">
          <div className="grain" />
          <svg className="shade a" viewBox="0 0 200 200" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SHADE_A }} />
          <svg className="shade b" viewBox="0 0 200 200" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SHADE_B }} />

          <header className="head" data-id="head">
            <svg className="eyebrow-sprig" viewBox="0 0 60 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SPRIG }} />
            <h1>
              {hasName ? (
                <>
                  <em>{guestName},</em>
                  {t.titleNamed}
                </>
              ) : (
                <>
                  {t.titleAnon[0]}
                  <br />
                  {t.titleAnon[1]}
                </>
              )}
            </h1>
            <div className="rule" />
          </header>

          <div className="scene" data-id="scene">
            <div className="arrive">
              <div className="env env-back" />

              <article className="card" data-id="card">
                <div className="flipper" data-id="flipper" role="button" tabIndex={-1} aria-label={t.flipCard}>
                  <section className="side recto" data-id="recto">
                    <div>
                      <p className="to">{hasName ? t.to(guestName!) : t.anon}</p>
                      <h2 className="names">
                        {partnerOne}
                        {partnerOne && partnerTwo ? <b>&amp;</b> : null}
                        {partnerTwo}
                      </h2>
                    </div>
                    <div>
                      {weddingDate ? <p className="when">{weddingDate}</p> : null}
                      {place ? <p className="where">{place}</p> : null}
                    </div>
                  </section>
                  <section className="side verso" data-id="verso" hidden>
                    <div className="verso-in">
                      <p className="kicker line">{t.kicker}</p>
                      <p className="lead line">{t.lead}</p>
                      {venue ? <p className="foot line">{venue}</p> : null}
                    </div>
                  </section>
                </div>
              </article>

              <div className="env pocket">
                <img alt="" src="/faire-part/pocket.webp" />
              </div>

              <div className="env flap" data-id="flap" role="button" tabIndex={0} aria-label={t.open}>
                <span className="face inside" data-id="fIn">
                    <img alt="" src="/faire-part/flap-inside.webp" />
                </span>
                <span className="face outside" data-id="fOut">
                    <img alt="" src="/faire-part/flap-outside.webp" />
                  <span className="ping" />
                </span>
              </div>
            </div>
          </div>

          <p className="hint" data-id="hint">
            {t.hint}
            <i />
          </p>
        </div>
      </main>

      <div className="cta" data-id="cta">
        <button className="primary" type="button" onClick={onRespond}>{t.respond}</button>
        <p className="note">{t.flipHint}</p>
      </div>
    </div>
  );
}
