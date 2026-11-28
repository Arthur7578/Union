# Module — Catalogues de contenus, recommandation, personnalisation, médias

À appliquer quand le produit gère un catalogue de contenus (vidéo, musique, podcasts, articles, collection personnelle), de la recherche ou de la découverte, de la recommandation, de la personnalisation, ou une monétisation par la publicité ou l'abonnement. Les chiffres propres au produit (audiences, taux de connexion et de consentement, revenus, résultats d'A/B tests) ne sont pas connus ici : demande-les ou raisonne en variables. Vérifie les faits récents de marché et de réglementation avant de les affirmer.

## Sommaire
1. Ce qui change les raisonnements (tous catalogues)
2. Métadonnées et taxonomie
3. Leviers de personnalisation
4. Métriques
5. Expérimentation
6. Personnalisation responsable
7. Cas particulier : diffuseur / plateforme financée par la publicité (ex. TF1+)
8. Cas particulier : bibliothèque musicale ou collection personnelle

## 1. Ce qui change les raisonnements

- **Le modèle de revenu oriente la reco.** Publicité : revenu ≈ audience × temps monétisable × taux de remplissage × CPM, donc toute décision de reco a une dimension revenu à expliciter. Abonnement : la rétention et la valeur perçue priment sur le volume de visionnage. Gratuit sans revenu (projet perso) : la métrique utile est la satisfaction de l'utilisateur, pas le temps passé.
- **Nature du catalogue.** Contenus périssables (actualité, replay dont la fraîcheur décroît vite), contenus soumis à des droits qui expirent, événements qui créent des pics, fonds de catalogue stable. La reco doit gérer fraîcheur, disponibilité et saisonnalité.
- **Cold start.** Les nouveaux contenus et les nouveaux utilisateurs n'ont pas d'historique : ils sont mal servis par un algorithme seul. Prévois des règles (boosts de lancement, onboarding par choix de goûts, contenus populaires ou éditoriaux).
- **Éditorial et algorithmique.** La bonne question est rarement « 100 % algo ou 100 % édito » mais : quelles surfaces, quels slots, quelles règles de mélange, qui décide. La forme qui marche le mieux est souvent l'éditorial exprimé en règles dans le moteur (épingles, boosts, quotas, bascule pendant un événement).
- **Identification et consentement.** La personnalisation et le ciblage dépendent de l'identification et du consentement (RGPD, ePrivacy en Europe). Une stratégie de perso doit traiter les non-connectés et les non-consentants (reco contextuelle, populaire, éditoriale).
- **Devices.** Sur TV connectée : peu d'éléments visibles, navigation coûteuse, effet de position fort, comptes partagés par un foyer. Sur mobile : sessions plus courtes. Sur desktop : recherche et navigation plus profondes. Raisonne device par device.

## 2. Métadonnées et taxonomie

La qualité de la reco, de la recherche et de la composition des pages est plafonnée par celle des métadonnées. Questions utiles :
- Quel référentiel de classification (genres, thèmes, ambiances, publics, formats) et qui le maintient ? Un référentiel trop fin est mal renseigné ; trop grossier, il ne discrimine rien.
- Quelle part du catalogue est correctement taguée ? Le taux de couverture est souvent la vraie contrainte.
- Manuel, enrichi automatiquement (modèles, sources externes) ou mixte ? L'enrichissement automatique demande un contrôle qualité et une boucle de correction.
- À quelles surfaces le référentiel sert-il (page d'accueil, fiches, recherche, CRM, notifications) ? Un même référentiel au service de plusieurs surfaces se justifie mieux qu'un référentiel par surface.

## 3. Leviers de personnalisation

Classement des contenus dans les rails ou listes ; choix et ordre des rails (composition de page) ; reprise et épisode / morceau suivant ; recherche ; visuels personnalisés ; notifications et CRM ; onboarding (choix de goûts) ; contexte (moment de la journée, device, activité) ; profils (dont enfants).

Pièges : les contenus périssables encombrent la reprise et font de mauvais points d'ancrage (« parce que vous avez regardé le journal d'hier ») ; l'information et la jeunesse demandent des règles dédiées. Le temps passé sur des profils enfants ne doit pas être un objectif d'optimisation.

## 4. Métriques

- **Engagement** : taux de lecture par rail et par position, CTR, temps jusqu'au premier play, temps passé par session et par utilisateur, taux de complétion, part des lectures issues de la reco (vs recherche, éditorial, direct), sessions par utilisateur, rétention J1/J7/J30, retour hebdomadaire.
- **Qualité de la reco** : couverture du catalogue, diversité intra-liste, nouveauté, biais de popularité, fraîcheur.
- **Hors ligne** : precision@k, recall@k, NDCG, MAP. Utiles pour itérer sur les modèles, mais l'écart offline/online est fréquent : seul un test en ligne tranche.
- **Guardrails typiques** : revenu, latence, mises en avant éditoriales respectées, diversité, plaintes, désinscriptions aux notifications.
- **Pièges** : le temps passé seul favorise les contenus longs et l'autoplay ; le CTR seul favorise le clickbait ; une hausse de la part reco peut n'être qu'un déplacement depuis la recherche ou l'éditorial. Associe toujours une métrique de valeur durable (rétention, retour) à une métrique d'activité.
- **North Star possibles** (à discuter, pas à imposer) : temps « qualifié » par utilisateur actif hebdomadaire (lectures au-delà d'un seuil de durée) ; part des utilisateurs actifs qui trouvent quoi regarder ou écouter en moins de N minutes. Chacune a des biais à expliciter.

## 5. Expérimentation

- A/B test au niveau utilisateur connecté plutôt qu'appareil quand c'est possible ; attention aux foyers partagés.
- Effet de nouveauté : prévois une durée suffisante et regarde la tendance, pas seulement la moyenne.
- Holdout de long terme (petit groupe sans la nouvelle personnalisation) pour mesurer l'effet cumulé.
- Les métriques de temps passé sont très variables : calcule la taille d'échantillon et l'effet minimum détectable avant de lancer ; envisage la réduction de variance (CUPED).
- Fixe à l'avance la métrique primaire, les guardrails et les seuils de décision.
- Sans trafic suffisant (petit produit), remplace l'A/B test par de l'évaluation qualitative (l'utilisateur juge des listes) et des comparaisons hors ligne.

## 6. Personnalisation responsable

Bulles de filtre et diversité, pluralisme pour l'information, protection des mineurs, transparence sur la reco, respect du consentement. Ce sont à la fois des contraintes (réglementaires, éditoriales, de marque) et des arguments pour embarquer les parties prenantes. Fais confirmer les obligations précises par le juridique plutôt que de les affirmer.

## 7. Cas particulier : diffuseur / plateforme financée par la publicité (ex. TF1+)

TF1+ est la plateforme de streaming du groupe TF1, essentiellement gratuite et financée par la publicité (direct, replay, catalogue). Ce qui s'ajoute pour ce type d'acteur :
- **Parties prenantes** : programmes et éditorial, régie publicitaire, data science, juridique/DPO, équipes plateforme, partenaires de contenu. Une stratégie de perso qui ne dit pas ce qu'elle apporte à l'éditorial et à la régie aura du mal à passer.
- **Mises en avant contractuelles** (régie, partenaires de contenus) et lancements de programmes qui doivent coexister avec l'algorithme.
- **Contraintes réglementaires à vérifier** : en France, les règles d'exposition des œuvres européennes et d'expression originale française (décret SMAD) peuvent peser sur la page d'accueil ; le pluralisme de l'information impose des précautions sur les rails d'info, en particulier en période électorale ; la publicité et le profilage des mineurs sont encadrés. Signale-les comme points à faire confirmer par le juridique, sans en affirmer la portée exacte.
- **Offre sans publicité** : le revenu publicitaire perdu sur chaque abonné est souvent le chiffre décisif ; calcule le point mort.

## 8. Cas particulier : bibliothèque musicale ou collection personnelle

- **Le job principal est souvent de retrouver et d'organiser**, pas de découvrir. La recherche, le tri, les métadonnées propres (artiste, album, genre, ambiance, BPM, tonalité selon l'usage) et la déduplication valent souvent plus qu'un moteur de reco.
- **Qualité des métadonnées sources** : fichiers mal tagués, doublons, variantes d'artistes. Un projet d'enrichissement (bases ouvertes comme MusicBrainz, empreintes audio) est souvent le vrai premier chantier ; vérifie les conditions d'usage des API envisagées.
- **Usages distincts** : écoute perso, préparation de sets (DJ), partage avec des proches, archivage. Chacun appelle une organisation différente : choisis l'usage principal avant de concevoir.
- **Droits** : héberger ou partager des fichiers protégés pose des questions de droit d'auteur ; les rapprochements avec des services de streaming dépendent de leurs API et de leurs conditions. À vérifier avant de construire dessus.
- **Métrique utile** : temps pour trouver ce qu'on cherche, part de la bibliothèque réellement écoutée ou utilisée, qualité perçue des playlists générées.
