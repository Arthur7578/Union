# Liste d'attaques (QA adverse)

Ce qu'un QA essaie pour casser une fonctionnalité. Le QA de la squad (`.github/squad/roles/qa.md`, mode review) et le QA adverse des PR (`.github/qa/role.md`) partent de cette liste. Ils prennent ce qui s'applique au diff, et pas tout à chaque fois.

Ajoute une ligne chaque fois qu'un bug passé en prod tombe dans une catégorie absente : la liste apprend des bugs réels.

## Identité et droits (P1 : une fuite est le pire bug)
- Lien invité (`/guest/[token]`) d'un autre mariage, d'un autre foyer, inconnu, vide, tronqué, en majuscules.
- Code de groupe (`/join/[code]`) inconnu, d'un autre mariage, prénom d'un invité d'un autre mariage.
- Page couple ouverte sans session, avec la session d'un autre couple, ou avec la session d'un collaborateur aux droits limités.
- Appel direct d'une RPC ou d'une table avec la clé publique (`anon`) : rien ne doit sortir ni changer.
- Un invité voit-il le nom, la réponse ou l'adresse d'un autre invité (texte visible, `aria-label`, HTML caché, réponse réseau) ?

## Saisies
- Champ vide, espaces seuls, texte très long (500 caractères et plus), retours à la ligne.
- Accents, apostrophe typographique (’), emoji, alphabet non latin, nom composé (Jean-Édouard), particule (de La Tour).
- Téléphone : format français, international, avec espaces, invalide. E-mail : majuscules, faute de domaine, espace en trop.
- Nombres : 0, négatif, décimal, très grand. Dates : passée, 29 février, fuseau horaire différent du mariage.
- HTML ou markdown dans un champ (`<b>`, `**`) : affiché tel quel, jamais interprété.

## Gestes et navigation (téléphone)
- Double tap sur Valider ; tap pendant le chargement ; Entrée dans un champ.
- Retour arrière du navigateur au milieu d'un parcours, puis en avant ; rechargement de la page au milieu.
- Deux onglets ouverts sur le même invité ; réponse modifiée dans l'un puis l'autre.
- Clavier ouvert qui cache le bouton ; rotation de l'écran ; écran de 320 px de large ; texte agrandi (zoom 200 %).
- Pas de défilement horizontal, cibles tactiles d'au moins 44 px.

## États et données
- Liste vide, un seul élément, beaucoup d'éléments (foyer de 12, 300 invités).
- Fonction désactivée par le couple (module, phase, fenêtre RSVP fermée) : l'invité ne la voit pas et ne peut pas la forcer par l'URL.
- Donnée supprimée entre deux écrans (invité retiré du foyer, formulaire supprimé).
- Réponse déjà donnée puis modifiée ; réponse donnée pour un proche puis ce proche retiré.
- Contenu que le couple n'a pas rempli : la page tient debout sans trou ni « undefined ».

## Langue
- Invité anglophone sur un mariage français et l'inverse ; libellé du couple dans une seule langue.
- Pluriels (1 personne, 2 personnes), espaces insécables, majuscules.

## Réseau
- Hors ligne au moment de valider : message clair, rien de perdu ou de compté deux fois.
- Réponse lente : l'écran montre qu'il travaille, le bouton ne relance pas l'envoi.
- Erreur serveur : message humain, pas de pile technique.

## Accessibilité
- Tout le parcours au clavier ; focus visible ; ordre logique.
- Chaque champ a un libellé ; chaque erreur est annoncée et rattachée à son champ.
- Contraste suffisant ; rien n'est dit seulement par la couleur.
