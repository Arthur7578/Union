import { oliveBranch } from "./olive";

const BRANCH = oliveBranch("var(--da-dusty-blue)");

/** The invitation's olive branch, line-drawn, with dusty-blue olives. */
export function OliveBranch({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 -8 162 66"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: BRANCH }}
    />
  );
}
