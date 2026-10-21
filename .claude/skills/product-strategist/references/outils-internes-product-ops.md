# Module — Outils internes et product ops

À appliquer quand le produit est un outil interne, un outil d'opérations produit (backlog, référentiels, reporting, processus de décision, outillage des équipes), ou plus largement quand les utilisateurs sont des collègues plutôt que des clients.

## Ce qui change les raisonnements

- **Les utilisateurs sont captifs, leur adhésion ne l'est pas.** Ils peuvent être obligés d'utiliser l'outil, mais ils le contourneront (tableur parallèle, saisie minimale, données fausses) s'il leur coûte plus qu'il ne leur rapporte. Le vrai concurrent est le contournement.
- **Qui gagne, qui paie l'effort ?** Souvent, ceux qui saisissent les données ne sont pas ceux qui en profitent (le terrain renseigne, le management consulte). Si l'effort et la valeur ne tombent pas sur les mêmes personnes, donne une contrepartie directe à ceux qui saisissent, ou automatise la saisie.
- **Un outil est un changement de processus.** Le plus gros risque n'est presque jamais technique : c'est l'adoption, la formation, la gouvernance (qui maintient le référentiel, qui arbitre). Prévois le plan d'adoption avec le produit, pas après.
- **Valeur mesurable.** Temps gagné par tâche × fréquence × nombre d'utilisateurs, erreurs évitées, délais raccourcis, décisions plus rapides. Établis une baseline avant de construire, sinon la valeur ne pourra jamais être démontrée.
- **Build, buy ou configurer ?** Un outil du marché ou une configuration d'outil existant (Notion, Airtable, Jira, un tableur bien fait) couvre souvent 80 % du besoin. Le développement sur mesure se justifie quand le besoin est vraiment spécifique et stable, ou quand l'outil devient un avantage différenciant.
- **Commencer par le processus à la main.** Faire tourner le nouveau processus manuellement quelques cycles (concierge) révèle les vraies règles et les vrais cas limites avant de les coder.

## Métriques

- Adoption : part des utilisateurs cibles actifs, part des tâches passant par l'outil (vs contournements).
- Qualité : complétude et fraîcheur des données saisies, taux d'erreurs.
- Valeur : temps de cycle, temps gagné, satisfaction des utilisateurs (des deux côtés : ceux qui saisissent et ceux qui consultent).
- Guardrail : charge ajoutée aux utilisateurs qui saisissent.

## Référentiels et taxonomies

Pour un référentiel partagé (classification de contenus, catalogue de produits, nomenclature) : un propriétaire clair, des règles de modification, une granularité adaptée à l'usage réel (trop fin = mal renseigné), et une mesure de la couverture. Un référentiel sert plusieurs consommateurs : liste-les et vérifie que chaque niveau de détail sert au moins l'un d'eux.
