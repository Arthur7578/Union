# Comment la banque de tests suit le produit

But : qu'aucune nouveauté n'arrive en prod sans un test qui préviendra sa régression, et que les trous (edge cases, parcours non couverts, tests creux) deviennent visibles au lieu d'être découverts par un invité.

Principe : **seuls les tests déterministes protègent.** Les agents (QA adverse, squad) servent à *trouver* ce qui manque ; ce qu'ils trouvent ne protège qu'une fois devenu un test de la banque.

Quatre couches, de la moins chère à la plus lente.

## 1. Barrières de PR (bloquantes, à chaque push)

Workflow `test-discipline.yml`, scripts dans `.github/test-discipline/`.

| Règle | Ce qui la déclenche | Ce qu'il faut |
|---|---|---|
| Écran → test navigateur | `.tsx` modifié sous `apps/web/app` ou `apps/web/components` | du code de test ajouté dans `apps/web/e2e/` (un commentaire ne compte pas) |
| Logique → test unitaire | `packages/shared/src`, `apps/web/lib`, `.ts` sous `apps/web/app` | du code ajouté dans un `*.test.ts(x)` |
| Migration → pgTAP | nouveau fichier dans `supabase/migrations/` | un test ajouté ou modifié dans `supabase/tests/database/` |
| Inventaire complet | chaque `page.tsx` | une ligne dans `docs/testing/flows.md` |
| Cartes de tests vraies | `docs/specs/*/tests.md`, `flows.md` | chaque fichier de test cité existe ; chaque nom de test cité entre guillemets dans le tableau d'un `tests.md` existe |
| Pas de prototype | `apps/web/public/squad-proto/` | supprimé avant de sortir du brouillon |

**Échappatoires** : labels `no-e2e`, `no-unit`, `no-db-test`, seulement si le changement ne peut pas changer un comportement. Chacun exige une ligne `<label>: <raison>` dans la description de la PR, sinon la CI reste rouge.

**Couverture du diff** (job `diff-coverage`) : part des lignes de logique modifiées que les tests unitaires exécutent, détaillée dans le résumé du job. Un pourcentage global se triche et ne dit rien des nouveautés ; celui-ci mesure exactement ce que la PR ajoute. Il **avertit** pour l'instant : les modules d'accès aux données (appels Supabase) sont couverts par les tests navigateur, pas par vitest, et feraient échouer le seuil à tort. Après quelques semaines de rapports, passe la variable de dépôt `DIFF_COVERAGE_MODE` à `block` (seuil : `MIN_DIFF_COVERAGE`, 80 par défaut).

**Correctif de bug** (job `bug-repro`, PR avec le label `bug`) : le test ajouté par la PR est rejoué sur le code de `main` ; il doit y échouer. S'il passe sur les deux, il ne reproduit pas le bug. Ordre : vitest, puis pgTAP, puis Playwright, arrêt au premier rouge. Limite : un test peut être rouge sur `main` pour une mauvaise raison (helper absent) ; la relecture vérifie qu'il échoue pour la raison du bug.

**Tests instables** : en CI, un test navigateur qui ne passe qu'au deuxième essai fait échouer le run (`failOnFlakyTests`). Un test instable est un bug du test ou de l'app : on le corrige, on ne le saute jamais.

## 2. QA adverse (non bloquant, une fois par PR)

Workflow `qa-adverse.yml`, rôle `.github/qa/role.md`, liste d'attaques `docs/testing/attack-list.md`.

- **Quand** : PR ouverte prête à relire, ou passée en « ready for review », ou label `qa` ajouté (le retirer et le remettre relance). Pas à chaque push, pour le coût. Ignoré pour les PR de la squad (elle a son QA), les forks et les PR d'autres auteurs que le propriétaire, et quand la PR ne touche ni l'app ni la base.
- **Quoi** : l'app de la PR est construite et lancée contre un Supabase local ; une session Claude Code sans jeton GitHub lit le diff et les specs, joue les attaques qui s'appliquent à taille téléphone, puis rend au plus 8 trouvailles :
  - 🐞 **bug**, toujours avec un test qui échoue aujourd'hui ;
  - 🧩 **test manquant** : un comportement qui marche mais que rien ne protège, avec un test qui passe aujourd'hui ;
  - ❓ **doute** : non prouvé, ou question produit.
- **Sortie** : un commentaire sur la PR (mis à jour à chaque run), avec le code de chaque test proposé. Rien n'est poussé.
- **Garder** : commente `/qa-keep Q1 Q3` sur la PR (workflow `qa-keep.yml`) ; les fichiers choisis sont ajoutés à la branche dans un commit à part. Un test de bug gardé rend la CI rouge jusqu'au correctif, c'est voulu.
- **Apprendre** : quand le QA signale une attaque absente de la liste, ou qu'un bug passe en prod, ajoute une ligne à `attack-list.md`.
- **Réglages** (variables de dépôt) : `QA_MODEL` (défaut : `SQUAD_MODEL` ou `opus`), `QA_EFFORT` (`high`), `QA_BUDGET_USD` (6). Il utilise le secret `ANTHROPIC_API_KEY` de la squad ; `/qa-keep` pousse avec `SQUAD_GH_TOKEN` pour que la CI tourne sur le commit.

Pourquoi un agent séparé : celui qui écrit le code et ses tests teste ce qu'il a compris, pas ce qui était voulu. Le QA adverse ne voit que le diff et les specs.

## 3. Inventaire des parcours

`docs/testing/flows.md` : un écran par ligne, avec ses tests navigateur et unitaires, un état (✅ / 🟡 / ❌) et une priorité. Il rend les trous visibles. Un ❌ en P1 mérite une issue. La CI garantit qu'il reste complet et que ses fichiers existent ; c'est à chaque PR de le tenir à jour.

## 4. Mesures de fond (hors PR)

- **Test de mutation**, chaque dimanche (workflow `mutation.yml`, config `stryker.config.mjs`). Stryker modifie la logique exprès, un mutant à la fois (un `>` devient `>=`, une condition devient `true`), et relance vitest. Un mutant qui survit est un bug que nos tests n'auraient pas vu. Le résultat met à jour l'issue « Mutation : tests à renforcer » (label `tests`) : score par fichier, survivants des fichiers les plus faibles. C'est le garde-fou contre les tests qui n'affirment rien. Périmètre : `packages/shared/src` et `apps/web/lib`, sans les dictionnaires.
- **Boucle prod → issues** : une tâche planifiée Claude, « Union : erreurs de prod → issues bug » (lundi 05:23 UTC), lit les erreurs Vercel de la semaine et ouvre au plus 5 issues `bug` + `proposé-par-agent`, avec le test à écrire d'abord. Elle ne pose jamais le label `squad`. **Désactivée à sa création (2026-11-28)** : une tâche créée depuis une session ne peut pas emporter le connecteur Vercel. Pour l'activer, ajoute le connecteur Vercel à la tâche dans les tâches planifiées de claude.ai, puis réactive-la ; sans lui, elle s'arrête en le disant.

## En local

```bash
# règles de la couche 1, sur ta branche
node .github/test-discipline/check.mjs origin/main HEAD

# couverture du diff
npm install --no-save --legacy-peer-deps @vitest/coverage-v8@4.1.11
(cd apps/web && npx vitest run --coverage)
node .github/test-discipline/diff-coverage.mjs origin/main HEAD

# test de mutation (une quinzaine de minutes)
npm install --no-save --legacy-peer-deps @stryker-mutator/core@10.1.1 @stryker-mutator/vitest-runner@10.1.1
npx stryker run   # rapport : reports/mutation/index.html
```

Les outils de couverture et de mutation ne sont pas dans `package.json` : npm 10 (celui de Node 22 en CI) plante en les ajoutant au lockfile (bug d'arborist sur les peer deps, constaté le 2026-11-28). Ils s'installent à la volée dans les jobs qui en ont besoin. `--no-save` retire les paquets installés de la même façon avant : installe-les ensemble si tu veux les deux.

## Limites connues

- La règle « écran → test » vérifie qu'un test a changé, pas que ce test couvre le changement. Le QA adverse et la relecture comblent l'écart. [Certain]
- Le QA adverse est non déterministe : deux runs ne trouvent pas la même chose, et il peut se tromper. C'est pour ça qu'il ne bloque jamais et que ses bugs doivent venir avec un test rouge. [Certain]
- La couverture du diff ne compte que vitest ; une logique couverte seulement par Playwright y apparaît non couverte. [Certain]
