import type { FairePartLines } from "@/lib/fairePart";

interface FairePartFacesProps {
  partnerOne?: string | null;
  partnerTwo?: string | null;
  /** What each line says; an empty line is left out. */
  lines: FairePartLines;
  /** Both sides stacked for the opening sequence (the back starts hidden), or one side shown flat. */
  side?: "both" | "front" | "back";
}

/**
 * The two printed sides of the faire-part card. Shared by the guest's opening
 * sequence (which turns the card over) and the organiser's preview (which lays
 * both sides out flat). The `data-id`s and classes are what the sequence and
 * the stylesheet hook onto.
 */
export function FairePartFaces({ partnerOne, partnerTwo, lines, side = "both" }: FairePartFacesProps) {
  const back: Array<[keyof FairePartLines, string]> = [
    ["greeting", "greet"],
    ["moments", ""],
    ["invite", ""],
    ["hope", ""],
    ["closing", ""],
    ["signature", "sign"],
  ];
  return (
    <>
      {side !== "back" && (
      <section className="side recto" data-id="recto">
        <div>
          <h2 className="names">
            {partnerOne}
            {partnerOne && partnerTwo ? <b>&amp;</b> : null}
            {partnerTwo}
          </h2>
          {lines.front_intro ? <p className="joy">{lines.front_intro}</p> : null}
        </div>
        <div>
          {lines.front_dates ? <p className="when">{lines.front_dates}</p> : null}
          {lines.front_place ? <p className="where">{lines.front_place}</p> : null}
        </div>
      </section>
      )}
      {side !== "front" && (
      <section className="side verso" data-id="verso" hidden={side === "both"}>
        <div className="verso-in">
          {back.map(([slot, cls]) =>
            lines[slot] ? (
              <p key={slot} className={`${cls} line`.trim()}>
                {lines[slot]}
              </p>
            ) : null,
          )}
        </div>
      </section>
      )}
    </>
  );
}
