/** A hub section's heading: the title in script, a line of context. */
export function SectionHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="gh-head">
      <h2 className="gh-h2">{title}</h2>
      {lead ? <p className="gh-lead">{lead}</p> : null}
    </header>
  );
}
