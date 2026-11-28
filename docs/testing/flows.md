# Inventaire des parcours et de leurs tests

Un écran par ligne, chaque écran de `apps/web/app` y est (la CI le vérifie : `.github/test-discipline/check.mjs`, règle 4). Une ligne dit ce qui protège l'écran contre une régression, ou qu'il n'est pas protégé.

- **Navigateur** : test Playwright de `apps/web/e2e/` (📱 = joué à taille téléphone).
- **Unitaire** : test vitest de l'écran ou de ses composants.
- **État** : ✅ parcours principal couvert de bout en bout · 🟡 partiel (composant ou un seul cas) · ❌ non couvert.
- **Priorité** : P1 = un invité ou un couple bloqué, ou une donnée montrée à la mauvaise personne, si ça casse. P2 = gênant. P3 = rare ou secondaire.

Quand tu ajoutes un écran, ajoute sa ligne dans la même PR. Quand tu ajoutes un test, mets la ligne à jour. Un ❌ en P1 mérite une issue.

## Invités (téléphone d'abord)

| Écran | Parcours | Navigateur | Unitaire | État | Priorité |
|---|---|---|---|---|---|
| `/invitation` | Faire-part et entrée de l'invité | — | `apps/web/components/guest/GuestWelcome.test.tsx`, `apps/web/components/guest/WelcomeGate.test.tsx` | 🟡 | P1 |
| `/guest/[token]` | Hub invité, RSVP, formulaires, infos et FAQ, carte RSVP | `apps/web/e2e/guest-forms.spec.ts`, `apps/web/e2e/guest-page-content.spec.ts`, `apps/web/e2e/guest-rsvp-card.spec.ts` 📱 | `apps/web/app/guest/[token]/GuestPortal.test.tsx`, `apps/web/app/guest/[token]/RsvpFlow.test.tsx`, `apps/web/app/guest/[token]/CustomFormFlow.test.tsx` | 🟡 | P1 |
| `/join/[code]` | Lien de groupe : prénom, lien sécurisé, nom inconnu | `apps/web/e2e/join-link.spec.ts` | `apps/web/app/join/[code]/JoinExperience.test.tsx` | 🟡 | P1 |
| `/rsvp/[token]` | Ancien lien RSVP | — | `apps/web/app/rsvp/[token]/page.test.tsx` | 🟡 | P2 |
| `/offline` | Page hors ligne | — | — | ❌ | P3 |

## Couple (organisateur)

| Écran | Parcours | Navigateur | Unitaire | État | Priorité |
|---|---|---|---|---|---|
| `/` | Accueil, redirection selon la session | — | — | ❌ | P2 |
| `/sign-in` | Connexion | — | — | ❌ | P1 |
| `/onboarding` | Création du mariage | — | — | ❌ | P1 |
| `/choose-wedding` | Choix du mariage | — | — | ❌ | P2 |
| `/accept-invite` | Un collaborateur accepte l'invitation | — | `apps/web/app/api/invite-collaborator/route.test.ts` | 🟡 | P2 |
| `/today` | Tableau de bord du jour | — | — | ❌ | P2 |
| `/guests` | Liste des invités | `apps/web/e2e/organiser-access.spec.ts` | — | 🟡 | P1 |
| `/guests/new` | Ajouter un invité | `apps/web/e2e/organiser-access.spec.ts` | — | 🟡 | P1 |
| `/guests/[id]` | Fiche invité, lien personnel | — | — | ❌ | P1 |
| `/guests/duplicates` | Doublons | — | — | ❌ | P3 |
| `/guests/groups` | Foyers et groupes | — | — | ❌ | P1 |
| `/guests/group-link` | Lien de groupe | — | — | ❌ | P1 |
| `/guests/modules` | Modules invités activés | `apps/web/e2e/organiser-access.spec.ts` | — | 🟡 | P2 |
| `/guests/forms` | Liste des formulaires | — | — | ❌ | P2 |
| `/guests/forms/[id]` | Constructeur de formulaire | `apps/web/e2e/guest-forms.spec.ts` | — | 🟡 | P1 |
| `/guests/rsvp-form` | Formulaire RSVP | — | — | ❌ | P1 |
| `/guests/page-content` | Contenu de la page invité | `apps/web/e2e/guest-page-content.spec.ts` | — | 🟡 | P2 |
| `/guests/permissions` | Ce que l’invité peut voir ou modifier | — | `apps/web/app/(app)/guests/permissions/page.test.tsx` | 🟡 | P1 |
| `/guests/seating` | Plan de table | — | — | ❌ | P2 |
| `/guests/sms-template` | Modèle de SMS | — | — | ❌ | P3 |
| `/guests/stays` | Hébergements | — | — | ❌ | P2 |
| `/plan` | Planning | — | — | ❌ | P2 |
| `/plan/budget` | Budget | — | — | ❌ | P2 |
| `/plan/team` | Équipe | — | — | ❌ | P2 |
| `/plan/weekend` | Programme du week-end | — | — | ❌ | P2 |
| `/vendors` | Prestataires | — | — | ❌ | P2 |
| `/vendors/new` | Ajouter un prestataire | — | — | ❌ | P3 |
| `/vendors/[id]` | Fiche prestataire | — | — | ❌ | P3 |
| `/vendors/search` | Recherche de prestataires | — | — | ❌ | P3 |
| `/vendors/search/active` | Recherche en cours | — | — | ❌ | P3 |
| `/account` | Compte | — | — | ❌ | P3 |
| `/account/profile` | Profil | — | — | ❌ | P3 |
| `/account/wedding` | Réglages du mariage | — | — | ❌ | P2 |
| `/account/settings` | Réglages | — | — | ❌ | P3 |
| `/account/settings/notifications` | Notifications | — | — | ❌ | P3 |
| `/account/privacy` | Confidentialité | — | — | ❌ | P3 |
| `/account/feedback` | Retour utilisateur | — | `apps/web/app/(app)/account/feedback/page.test.tsx` | 🟡 | P3 |

## Hors écran

| Surface | Ce qui est protégé | Tests |
|---|---|---|
| Accès signé-out (`anon`) | Aucune table lisible, chaque RPC invité sondée avec une clé inconnue ou nulle | `supabase/tests/database/anon_function_grants.test.sql`, `apps/web/e2e/keepalive.spec.ts` |
| Keepalive | La tâche planifiée écrit avec la clé publique | `apps/web/e2e/keepalive.spec.ts` |
