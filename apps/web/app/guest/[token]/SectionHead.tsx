import { sprig } from "@/components/guest/olive";

const SPRIG = sprig(6, 18, 54, 8, 5, 11, 4);

/** A hub section's heading: a sprig, the title in script, a line of context. */
export function SectionHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="gh-head">
      <svg className="gh-sprig" viewBox="0 0 60 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SPRIG }} />
      <h2 className="gh-h2">{title}</h2>
      {lead ? <p className="gh-lead">{lead}</p> : null}
    </header>
  );
}
