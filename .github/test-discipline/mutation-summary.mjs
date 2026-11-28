#!/usr/bin/env node
// Turns Stryker's JSON report into the body of the weekly "Mutation" issue
// (markdown on stdout): score per file, worst first, and the surviving
// mutants of the weakest files, so a session can write the missing asserts.
//   node .github/test-discipline/mutation-summary.mjs reports/mutation/mutation.json
import { readFileSync } from "node:fs";

const report = JSON.parse(readFileSync(process.argv[2], "utf8"));
const runUrl = process.env.RUN_URL ?? "";
const detected = new Set(["Killed", "Timeout"]);
const missed = new Set(["Survived", "NoCoverage"]);

const files = Object.entries(report.files).map(([file, { mutants, source }]) => {
  const valid = mutants.filter((m) => detected.has(m.status) || missed.has(m.status));
  const killed = valid.filter((m) => detected.has(m.status)).length;
  const lines = source.split("\n");
  return {
    file,
    total: valid.length,
    killed,
    score: valid.length ? Math.round((killed / valid.length) * 1000) / 10 : 100,
    survivors: valid
      .filter((m) => missed.has(m.status))
      .map((m) => ({
        line: m.location.start.line,
        status: m.status,
        mutator: m.mutatorName,
        replacement: m.replacement ?? "",
        code: (lines[m.location.start.line - 1] ?? "").trim(),
      })),
  };
});
const total = files.reduce((n, f) => n + f.total, 0);
const killed = files.reduce((n, f) => n + f.killed, 0);
const score = total ? Math.round((killed / total) * 1000) / 10 : 100;
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const cell = (s) => cut(String(s), 90).replace(/\|/g, "\\|").replace(/`/g, "ʹ");

let out = `<!-- union-mutation -->\n## Score de mutation : ${score} % (${killed}/${total} mutants détectés)\n\n`;
out +=
  "Stryker modifie la logique exprès (un `>` devient `>=`, une condition devient `true`…) puis lance les tests unitaires. " +
  "Un mutant **survivant** est un bug que nos tests n’auraient pas vu. **Sans couverture** : aucun test ne passe sur cette ligne.\n\n";
out += "Pour traiter : choisis un fichier ci-dessous, et demande à une session Claude d’ajouter les assertions qui tuent ces mutants (sans toucher au code testé).\n\n";
const survived = (f) => f.survivors.filter((m) => m.status === "Survived").length;
const noCov = (f) => f.survivors.length - survived(f);
const covered = files.filter((f) => f.total && noCov(f) < f.total);
const untested = files.filter((f) => f.total && noCov(f) === f.total).sort((a, b) => b.total - a.total);

out += "### Fichiers testés\n\n| Fichier | Score | Survivants (tests trop faibles) | Lignes jamais exécutées |\n|---|---|---|---|\n";
const ranked = covered.sort((a, b) => survived(b) - survived(a) || a.score - b.score);
for (const f of ranked) out += `| \`${f.file}\` | ${f.score} % | ${survived(f)} | ${noCov(f)} |\n`;
if (untested.length) {
  out += "\n### Fichiers sans aucun test unitaire\n\n";
  out += "Souvent de l'accès aux données (couvert, au mieux, par les tests navigateur). À tester en unitaire si la logique y est pure.\n\n";
  out += untested.map((f) => `- \`${f.file}\` (${f.total} mutants)`).join("\n") + "\n";
}

out += "\n### Les survivants à traiter d'abord\n\nDes tests passent sur ces lignes mais ne remarquent pas la mutation : il leur manque une assertion.\n\n";
let shown = 0;
for (const f of ranked.filter((x) => survived(x)).slice(0, 5)) {
  f.survivors = f.survivors.filter((m) => m.status === "Survived");
  out += `<details><summary><code>${f.file}</code> — ${f.survivors.length} survivant(s)</summary>\n\n| Ligne | Mutation | Code |\n|---|---|---|\n`;
  for (const s of f.survivors.slice(0, 25)) {
    out += `| ${s.line} | ${cell(s.mutator)} → \`${cell(s.replacement)}\` | \`${cell(s.code)}\` |\n`;
    shown++;
  }
  if (f.survivors.length > 25) out += `\n_…et ${f.survivors.length - 25} autres dans le rapport complet._\n`;
  out += "\n</details>\n";
  if (out.length > 55_000) break;
}
if (!shown) out += "Aucun survivant. 🎉\n";
if (runUrl) out += `\n<sub>[Rapport HTML complet (artefact) et logs](${runUrl})</sub>\n`;
process.stdout.write(out);
