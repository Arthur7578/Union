#!/usr/bin/env node
// Turns the adversarial QA's report into the PR comment (markdown on stdout).
//   node .github/qa/comment.mjs <report.json> <proposals-dir>
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const [reportPath, proposalsDir] = process.argv.slice(2);
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const findings = Array.isArray(report.findings) ? report.findings : [];
const runUrl = process.env.RUN_URL ?? "";
const MAX = 60_000; // GitHub's comment limit is 65,536 characters

const kind = { bug: "🐞 bug", "missing-test": "🧩 test manquant", doubt: "❓ doute" };
const verified = { "fails-now": "rouge aujourd’hui", "passes-now": "vert aujourd’hui", "not-run": "—" };
const plain = (s) => String(s ?? "").replace(/\n/g, " ").replace(/</g, "&lt;");
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const keepable = findings.filter(
  (f) => (f.files ?? []).length && (f.files ?? []).every((file) => existsSync(path.join(proposalsDir, file))),
);

let out = `<!-- union-qa-adverse -->\n## 🧪 QA adverse — ${findings.length} trouvaille${findings.length > 1 ? "s" : ""}\n\n`;
out += `${report.summary ?? ""}\n\n`;
if (findings.length) {
  out += "| ID | Type | Gravité | Quoi | Test proposé | État |\n|---|---|---|---|---|---|\n";
  for (const f of findings) {
    const files = (f.files ?? []).map((x) => `\`${path.basename(x)}\``).join(", ") || "—";
    out += `| ${cell(f.id)} | ${kind[f.kind] ?? cell(f.kind)} | ${cell(f.severity)} | ${cell(f.what)} | ${files} | ${verified[f.verified] ?? "—"} |\n`;
  }
  out += "\n";
}

const details = [];
for (const f of findings) {
  let d = `<details><summary><b>${plain(f.id)}</b> — ${plain(f.what)}</summary>\n\n`;
  if (f.steps) d += `**Reproduire :** ${f.steps}\n\n`;
  if (f.where) d += `**Où :** \`${f.where}\`\n\n`;
  if (f.attack) d += `**Attaque :** ${f.attack}\n\n`;
  for (const file of f.files ?? []) {
    const p = path.join(proposalsDir, file);
    if (!existsSync(p)) {
      d += `_${file} : fichier introuvable dans les propositions._\n\n`;
      continue;
    }
    const lang = file.endsWith(".sql") ? "sql" : "ts";
    d += `\`${file}\`\n\n\`\`\`\`${lang}\n${readFileSync(p, "utf8").trimEnd()}\n\`\`\`\`\n\n`;
  }
  details.push(d + "</details>\n");
}
const additions = (report.attack_list_additions ?? []).filter(Boolean);
let tail = "";
if (additions.length) {
  tail += `\n**À ajouter à \`docs/testing/attack-list.md\` ?**\n${additions.map((a) => `- ${a}`).join("\n")}\n`;
}
if (keepable.length) {
  tail +=
    `\n**Garder des tests :** commente \`/qa-keep ${keepable.map((f) => f.id).join(" ")}\` (ou une partie des ID). ` +
    "Ils sont ajoutés à la PR dans un commit à part. Les tests de bug sont rouges exprès : la CI reste rouge jusqu’au correctif.\n";
}
tail += "\nNon bloquant : ce rapport ne change pas l’état de la CI. Relancer : retire puis remets le label `qa`.\n";
if (runUrl) tail += `\n<sub>[Logs et fichiers proposés](${runUrl})</sub>\n`;

for (const d of details) {
  if (out.length + d.length + tail.length > MAX) {
    out += "\n_Détails tronqués : le reste est dans l’artefact du run._\n";
    break;
  }
  out += d;
}
process.stdout.write(out + tail);
