# Squad — l'équipe d'agents de Union

Une équipe d'agents qui prend une issue GitHub et la mène jusqu'à une PR testée, sans que tu fasses le relais entre chaque rôle. Tu interviens trois fois : après la stratégie, après le design, et sur la preview finale.

## Le déroulé

```
Issue + label `squad`
   │
   ▼
1. Product Strategist ── go / reformuler / no-go
   │
   🛑 toi : /go · /revise <texte> · /stop
   │
   ▼
2. Product Designer (flow, états, copy, prototype téléphone)
   + Product Manager (critères d'acceptation AC-1…)
   + Tech Lead (faisabilité ; si infaisable, le designer refait une fois)
   │
   🛑 toi : prototype sur la preview Vercel, puis /go · /revise <texte> · /stop
   │
   ▼
3. Tech Lead : plan d'implémentation
   QA : écrit les tests AVANT le code (un ou plusieurs par critère)
   Dev : implémente
   │
   ▼
   Boucle, jusqu'à 0 point bloquant ou 5 tours :
     checks (lint, types, unitaires, pgTAP, Playwright) ─ rouge → Dev corrige
     verts → QA (explore l'app à taille téléphone, ajoute un test par bug trouvé)
           → Senior reviewer d'un autre fournisseur (relit le diff contre le plan)
           → Designer (compare les captures au prototype)
           → points bloquants → Dev corrige → tour suivant
   │
   ▼
   PR prête (ou « besoin de toi » si la boucle n'a pas convergé)
   │
   🛑 toi : test sur téléphone → merge, ou /fix <texte> sur la PR (relance la boucle)
```

Un **bug** (issue avec les labels `bug` puis `squad`) saute les étapes 1 et 2 : le QA écrit d'abord un test qui reproduit le bug, puis plan court, correctif et même boucle de revue.

## Les commandes

| Où | Quoi | Effet |
|---|---|---|
| Issue | ajouter le label `squad` | Lance la stratégie (ou le correctif si l'issue a déjà `bug`) |
| Issue | `/go` (+ texte facultatif) | Passe à l'étape suivante ; ton texte est transmis aux agents |
| Issue | `/revise <ce qui ne va pas>` | Refait l'étape en cours avec ton retour |
| Issue | `/stop` | Arrête la squad sur l'issue |
| PR de la squad | `/fix <ce qui ne va pas>` | Le dev corrige, puis toute la boucle de revue repart |

Seuls tes commentaires déclenchent la squad (le repo est public). Les commentaires des autres ne sont jamais lus comme des instructions.

Labels posés par la squad : `squad:working` (en cours), `squad:gate-strategy` et `squad:gate-design` (attend ta décision), `squad:ready` (PR prête), `squad:needs-human` (bloqué), `squad:stopped`.

## Où sont les choses

- `docs/specs/<issue>/` : `strategy.md`, `design.md`, `prototype.html`, `criteria.md`, `feasibility.md`, `plan.md`, `tests.md`. C'est la mémoire de la feature, versionnée avec le code.
- `.github/squad/roles/` : les consignes de chaque rôle. Les modifier change le comportement de l'équipe.
- `.github/squad/*.sh` : l'enchaînement. `.github/workflows/squad.yml` : les déclencheurs.
- Chaque run garde les sorties de tous les rôles (coûts, verdicts, captures d'écran) en artefact pendant 14 jours : lien en bas de chaque commentaire de la squad.

## Mise en place

1. **Secrets Actions** (fait) : `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`.
2. **Secret `SQUAD_GH_TOKEN`** (à faire, fortement recommandé). Sans lui, les commits de la squad ne déclenchent ni la CI ni la preview Vercel, car GitHub ne relance pas de workflow sur un push fait avec le jeton par défaut. Crée un *fine-grained personal access token* limité au repo `union`, avec les permissions *Contents*, *Issues* et *Pull requests* en lecture/écriture, et ajoute-le en secret Actions.
3. **Variables Actions** (facultatives, *Settings → Secrets and variables → Actions → Variables*) :

   | Variable | Défaut | Rôle |
   |---|---|---|
   | `SQUAD_MODEL` | `opus` | Modèle Claude de tous les rôles (alias ou ID complet ; `fable` si ton compte y a accès) |
   | `SQUAD_EFFORT` | `high` | Niveau de réflexion (`medium`, `high`, `xhigh`, `max`) |
   | `REVIEWER_MODEL` | `openai/gpt-5.5` | Modèle OpenRouter du senior reviewer (ID vérifié le 21/10/2026) |
   | `SQUAD_MAX_ROUNDS` | `5` | Tours maximum de la boucle de revue |
   | `SQUAD_BUDGET_USD` | `8` | Plafond de dépense par run d'un rôle (garde-fou anti-emballement, pas un budget) |
   | `SQUAD_DEV_BUDGET_USD` | `20` | Idem pour le développeur |

4. Les coûts : chaque commentaire final donne le coût Claude estimé du run. La clé API est facturée à l'usage, séparément de l'abonnement Claude.

## Écrire une bonne issue

La squad ne devine pas mieux que toi. Une issue utile dit : **qui** (persona), **le problème** vécu (pas la solution), **pourquoi maintenant**, et ce que tu sais déjà (contraintes, idées, écrans concernés). Trois lignes précises valent mieux qu'une page vague.

## Limites connues

- La boucle relance tous les tests de bout en bout à chaque tour : un run de build prend du temps (souvent plus d'une heure si plusieurs tours). [Likely]
- Les tests de bout en bout couvrent encore peu de parcours. Tant que ce n'est pas rattrapé (issues « Étape 0 »), le QA explore à la main et les régressions hors du périmètre de l'issue peuvent passer. [Certain]
- Le reviewer externe ne voit que le diff (tronqué au-delà d'environ 250 000 caractères) et les specs, pas tout le repo.
- Un plafond de tours atteint n'est pas un échec silencieux : la PR reste en brouillon avec le label `squad:needs-human` et la liste des derniers points bloquants.

## Plus tard

- **Boucle production → backlog** : analyse hebdomadaire Contentsquare + erreurs Vercel qui propose des issues. Les connecteurs Contentsquare et Vercel existent côté Claude (claude.ai) mais pas dans GitHub Actions ; la piste la plus simple est une tâche planifiée Claude qui lit ces données et ouvre des issues labellisées `proposé-par-agent`.
- **Tests sur Safari mobile** (WebKit) en plus de Chromium, une fois les parcours critiques couverts.
