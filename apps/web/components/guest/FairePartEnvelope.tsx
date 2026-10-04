"use client";

import React, { useState, useEffect, useRef } from "react";
import { G, T, alpha } from "@/lib/theme";

interface FairePartEnvelopeProps {
  coupleNames: string;
  weddingDate?: string | null;
  venueName?: string | null;
  venueCity?: string | null;
  welcomeNote?: string | null;
  locale?: string;
  onRespond: () => void;
}

export function FairePartEnvelope({
  coupleNames,
  weddingDate,
  venueName,
  venueCity,
  welcomeNote,
  locale = "fr",
  onRespond,
}: FairePartEnvelopeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  const isFr = locale === "fr";

  // Handle scroll / gesture progression
  useEffect(() => {
    let ticking = false;

    const handleWheel = (e: WheelEvent) => {
      if (isOpen) return;
      if (e.deltaY > 20) {
        setIsOpen(true);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isOpen || touchStartY.current === null) return;
      const currentY = e.touches[0].clientY;
      const diff = touchStartY.current - currentY;
      if (diff > 30) {
        setIsOpen(true);
      }
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (window.scrollY > 40 && !isOpen) {
            setIsOpen(true);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen]);

  const handleSealClick = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div
      ref={containerRef}
      className="relative min-h-[92vh] w-full flex flex-col items-center justify-center py-8 px-4 overflow-hidden select-none"
      style={{
        background: `radial-gradient(circle at 50% 30%, ${alpha(G.forestDeep, 0.95)} 0%, ${G.forestDark} 100%)`,
        perspective: "1200px",
      }}
    >
      {/* Subtle ambient lighting particle effects */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(${G.goldMuted} 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Header hint */}
      <div
        className={`transition-all duration-700 transform ${
          isOpen ? "opacity-0 -translate-y-4" : "opacity-100 translate-y-0"
        } text-center mb-6 z-20`}
      >
        <span
          className="inline-block text-xs uppercase tracking-[0.3em] px-4 py-1.5 rounded-full border"
          style={{
            borderColor: alpha(G.goldMuted, 0.3),
            color: G.goldAccent,
            background: alpha(G.forestDark, 0.6),
            backdropFilter: "blur(8px)",
          }}
        >
          {isFr ? "Invitation Spéciale" : "Special Invitation"}
        </span>
        <p className="text-xs mt-2 font-light tracking-wide" style={{ color: G.goldSubtext }}>
          {isFr ? "Faites défiler ou appuyez sur le sceau" : "Scroll or tap the seal to open"}
        </p>
      </div>

      {/* Envelope Container */}
      <div
        className="relative w-full max-w-[380px] sm:max-w-[440px] aspect-[1.4/1] flex items-center justify-center transition-all duration-1000 ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: isOpen ? "translateY(80px) scale(0.95)" : "translateY(0) scale(1)",
        }}
      >
        {/* Envelope Back Body (Forest Green Texture) */}
        <div
          className="absolute inset-0 rounded-2xl shadow-2xl border"
          style={{
            borderColor: alpha(G.goldMuted, 0.25),
            background: `linear-gradient(145deg, ${G.forestMid} 0%, ${G.forestDark} 100%)`,
            boxShadow: `0 25px 50px -12px ${alpha(T.scrim, 0.7)}, 0 0 30px ${alpha(G.goldMuted, 0.15)}`,
          }}
        >
          {/* Inner Envelope Lining with fine gold hairline border */}
          <div
            className="absolute inset-3 rounded-xl border"
            style={{
              borderColor: alpha(G.goldMuted, 0.2),
              background: G.forestFlap,
            }}
          />
        </div>

        {/* The Faire-Part Card inside */}
        <div
          className={`absolute w-[92%] left-[4%] transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) z-10 rounded-xl p-6 sm:p-8 flex flex-col justify-between border ${
            isOpen
              ? "-translate-y-[260px] sm:-translate-y-[290px] scale-105 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)]"
              : "translate-y-2 scale-95 shadow-md"
          }`}
          style={{
            borderColor: G.cardGoldBorder,
            background: `linear-gradient(160deg, ${G.cardBgTop} 0%, ${G.cardBgBottom} 100%)`,
            minHeight: "360px",
            color: G.cardInk,
          }}
        >
          {/* Subtle paper grain & gold leaf corner frames */}
          <div
            className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2"
            style={{ borderColor: alpha(G.goldMuted, 0.4) }}
          />
          <div
            className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2"
            style={{ borderColor: alpha(G.goldMuted, 0.4) }}
          />
          <div
            className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2"
            style={{ borderColor: alpha(G.goldMuted, 0.4) }}
          />
          <div
            className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2"
            style={{ borderColor: alpha(G.goldMuted, 0.4) }}
          />

          {/* Card Top / Header */}
          <div className="text-center space-y-1">
            <span
              className="text-[10px] sm:text-xs uppercase tracking-[0.35em] font-semibold"
              style={{ color: G.cardGoldSub }}
            >
              {isFr ? "Mariage de" : "Wedding of"}
            </span>
            <h1
              className="text-2xl sm:text-3xl font-serif tracking-tight font-bold"
              style={{ fontFamily: T.serif, color: G.cardTitle }}
            >
              {coupleNames}
            </h1>
            <div
              className="w-12 h-[1px] mx-auto my-2"
              style={{ background: alpha(G.goldMuted, 0.5) }}
            />
          </div>

          {/* Card Main Info Body */}
          <div className="text-center my-4 space-y-3">
            {weddingDate && (
              <div
                className="text-sm sm:text-base font-serif tracking-wide"
                style={{ color: G.cardText }}
              >
                {weddingDate}
              </div>
            )}
            {(venueName || venueCity) && (
              <div className="text-xs sm:text-sm font-medium" style={{ color: G.cardSubtext }}>
                {venueName} {venueCity ? `• ${venueCity}` : ""}
              </div>
            )}
            {welcomeNote && (
              <p
                className="text-xs sm:text-sm italic max-w-xs mx-auto leading-relaxed pt-1"
                style={{ color: G.cardNote }}
              >
                “{welcomeNote}”
              </p>
            )}
          </div>

          {/* Card Action / CTA */}
          <div className="pt-2 text-center z-20">
            <button
              onClick={onRespond}
              className="w-full py-3.5 px-6 rounded-lg text-sm font-medium tracking-wide transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center space-x-2 cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${G.forestDeep} 0%, ${G.forestDark} 100%)`,
                color: G.goldText,
                border: `1px solid ${alpha(G.goldMuted, 0.4)}`,
                boxShadow: `0 10px 20px -5px ${alpha(G.forestDark, 0.4)}`,
              }}
            >
              <span>{isFr ? "Répondre à l'invitation" : "Respond to Invitation"}</span>
              <span className="text-base">→</span>
            </button>
          </div>
        </div>

        {/* Envelope Front Pocket Layers (Left, Right, Bottom triangles overlay) */}
        <div
          className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-2xl"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Left Flap */}
          <div
            className="absolute top-0 left-0 bottom-0 w-1/2 border-r"
            style={{
              borderColor: alpha(G.goldMuted, 0.15),
              background: `linear-gradient(135deg, ${G.forestDeep} 0%, ${G.forestDark} 100%)`,
              clipPath: "polygon(0 0, 100% 50%, 0 100%)",
            }}
          />
          {/* Right Flap */}
          <div
            className="absolute top-0 right-0 bottom-0 w-1/2 border-l"
            style={{
              borderColor: alpha(G.goldMuted, 0.15),
              background: `linear-gradient(225deg, ${G.forestDeep} 0%, ${G.forestDark} 100%)`,
              clipPath: "polygon(100% 0, 0 50%, 100% 100%)",
            }}
          />
          {/* Bottom Flap */}
          <div
            className="absolute bottom-0 left-0 right-0 h-3/5 border-t"
            style={{
              borderColor: alpha(G.goldMuted, 0.2),
              background: `linear-gradient(0deg, ${G.forestDark} 0%, ${G.forestMid} 100%)`,
              clipPath: "polygon(0 100%, 50% 0, 100% 100%)",
            }}
          />
        </div>

        {/* Envelope Top Flap (3D Fold / Open) */}
        <div
          className="absolute top-0 left-0 right-0 h-1/2 z-30 transition-transform duration-1000 cubic-bezier(0.4, 0, 0.2, 1) origin-top"
          style={{
            transformStyle: "preserve-3d",
            transform: isOpen ? "rotateX(-180deg)" : "rotateX(0deg)",
          }}
        >
          <div
            className="w-full h-full rounded-t-2xl border-b shadow-md"
            style={{
              borderColor: alpha(G.goldMuted, 0.3),
              background: `linear-gradient(180deg, ${G.forestLight} 0%, ${G.forestFlap} 100%)`,
              clipPath: "polygon(0 0, 50% 100%, 100% 0)",
              backfaceVisibility: "hidden",
            }}
          />
        </div>

        {/* Premium Gold Wax Seal */}
        <button
          onClick={handleSealClick}
          aria-label={isFr ? "Ouvrir l'enveloppe" : "Open envelope"}
          className={`absolute z-40 top-[45%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl cursor-pointer ${
            isOpen ? "scale-0 opacity-0 rotate-12" : "scale-100 opacity-100 hover:scale-105 active:scale-95"
          }`}
          style={{
            background: `radial-gradient(circle at 35% 35%, ${G.goldLight} 0%, ${G.goldAccent} 40%, ${G.goldDark} 85%, ${G.goldDeep} 100%)`,
            boxShadow: `0 10px 25px ${alpha(T.scrim, 0.6)}, inset 0 2px 4px ${alpha(T.white, 0.6)}, inset 0 -3px 6px ${alpha(T.scrim, 0.5)}`,
            border: `2px solid ${G.goldRim}`,
          }}
        >
          {/* Detailed inner rim ring */}
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border flex items-center justify-center shadow-inner"
            style={{ borderColor: alpha(T.white, 0.4) }}
          >
            {/* Monogram emblem */}
            <span
              className="text-xl sm:text-2xl font-serif font-bold"
              style={{
                color: G.goldEmblem,
                filter: `drop-shadow(0 1px 1px ${alpha(T.white, 0.5)})`,
              }}
            >
              ❦
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
