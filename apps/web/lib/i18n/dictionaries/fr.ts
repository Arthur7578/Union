import type { Dictionary } from "./en";

// French translation. Typed against `Dictionary` — the compiler enforces
// that this file exposes exactly the same keys (and function signatures)
// as `en.ts`. If a new English key ships without a French translation,
// `npm run typecheck` fails at CI time, so French can never silently
// drift behind the app.

export const fr: Dictionary = {
  lang: {
    en: "Anglais",
    fr: "Français",
    switchTo: "Langue",
  },

  common: {
    loading: "Chargement…",
    oneMoment: "Un instant…",
    back: "Retour",
    backHome: "← Retour à l'accueil",
    save: "Enregistrer",
    saving: "Enregistrement…",
    cancel: "Annuler",
    retry: "Réessayer",
    edit: "Modifier",
    delete: "Supprimer",
    add: "Ajouter",
    open: "Ouvrir",
    close: "Fermer",
    signOut: "Se déconnecter",
    signIn: "Se connecter",
    signingOut: "Déconnexion…",
    yes: "Oui",
    no: "Non",
    error: "Une erreur est survenue.",
    sample: "Exemple",
    live: "En direct",
    demo: "Données de démonstration",
    demoNotice:
      "Cet écran affiche du contenu d'exemple — pas les vraies données de votre mariage. C'est un aperçu d'une fonctionnalité qui n'est pas encore reliée au backend.",
    handle: "Je m'en charge",
    invite: "Inviter",
    adding: "Ajout…",
  },

  landing: {
    kicker: "L'IA négociatrice de mariage",
    tagline:
      "L'IA qui ne se contente pas de vous aider à organiser le mariage — elle négocie avec les prestataires, conclut les accords, et garde tout sous contrôle en toute sérénité.",
    getStarted: "Commencer",
    signIn: "Se connecter",
    openUnion: "Ouvrir Union →",
    rsvpHint:
      "Ici pour un RSVP ? Utilisez le lien d'invitation personnel que le couple vous a envoyé.",
  },

  signIn: {
    title: "Union",
    subEmail: "Connectez-vous avec votre e-mail — nous vous enverrons un code à 8 chiffres.",
    subCode: (email: string) => `Saisissez le code à 8 chiffres envoyé à ${email}.`,
    emailLabel: "Adresse e-mail",
    emailPlaceholder: "vous@exemple.com",
    codeLabel: "Code à 8 chiffres",
    codePlaceholder: "12345678",
    sending: "Envoi…",
    sendCode: "Recevoir un code par e-mail",
    verifying: "Vérification…",
    submit: "Se connecter",
    useDifferentEmail: "Utiliser une autre adresse",
    resend: "Renvoyer le code",
    errSend: "Impossible d'envoyer le code.",
    errVerify: "Ce code n'a pas fonctionné — réessayez.",
    errSignOut: "Impossible de vous déconnecter.",
    checking: "Vérification de votre connexion…",
    alreadyTitle: "Vous êtes déjà connecté·e",
    alreadySubWithEmail: (email: string) =>
      `Connecté·e en tant que ${email}. Entrez dans Union — ou déconnectez-vous pour utiliser une autre adresse.`,
    alreadySubNoEmail:
      "Vous êtes connecté·e. Entrez dans Union — ou déconnectez-vous pour utiliser une autre adresse.",
    continue: "Entrer dans Union",
    signOutAndSwitch: "Se déconnecter et changer d'adresse",
  },

  onboarding: {
    title: "Préparons votre mariage",
    sub: "Juste les bases — vous pourrez tout modifier plus tard.",
    yourName: "Votre prénom",
    partnerName: "Prénom de votre partenaire",
    weddingDate: "Date du mariage",
    venue: "Lieu (si vous en avez déjà un)",
    saving: "Configuration…",
    submit: "Commencer à planifier",
    errSave: "Enregistrement impossible. Réessayez.",
    yourNamePlaceholder: "Maya",
    partnerNamePlaceholder: "Daniel",
    venuePlaceholder: "Domaine des Fleurs Sauvages",
  },

  today: {
    goodMorning: (name: string) => `Bonjour, ${name}.`,
    onTrack: "Tout roule",
    daysToGo: "jours restants",
    setYourDate: "définir la date",
    dateTBD: "Date à définir",
    handlingLead: {
      before: "Union s'occupe de",
      strong: "trois choses",
      after:
        " pour vous en ce moment. Rien à craindre aujourd'hui — sauf une jolie décision à prendre.",
    },
    needsYou: "À valider aujourd'hui",
    approveFlorist: "Valider le devis final du fleuriste",
    floristBody: {
      before: "Union a négocié The Wild Stem à",
      priceHighlight: "3 300 $",
      middle: " — ",
      savings: "540 $ de moins",
      end: " que votre budget floral, mêmes compositions style jardin que vous aviez adorées.",
    },
    approve: "Valider",
    review: "Voir le détail",
    yourGuests: "Vos invités",
    guestStatsComing: "Viennent",
    guestStatsWaiting: "En attente",
    guestStatsCant: "Absents",
    guestStatsSummary: (parties: number, invited: number) =>
      `${parties} foyers · ${invited} invités`,
    openGuests: "Ouvrir les invités →",
    unionHandling: "Union s'en occupe",
    justClosed: "Fraîchement bouclé",
    venueDepositPaid: "Acompte du lieu payé — il est à vous",
    venueDepositMeta: (venue: string, name: string) =>
      `${venue} · validé par ${name} · il y a 2 jours`,
    openingUnion: "Ouverture d'Union…",
  },

  nav: {
    today: "Aujourd'hui",
    vendors: "Prestataires",
    union: "Union",
    guests: "Invités",
    plan: "Planning",
  },

  guests: {
    title: "Invités",
    kicker: "invités",
    kickerFallback: "Liste des invités",
    add: "Ajouter un invité",
    addShort: "+ Ajouter",
    empty: "Aucun invité pour l'instant — ajoutez votre première invitation.",
    noGuestsTitle: "Aucun invité pour l'instant",
    noGuestsBody: "Ajoutez la première personne que vous invitez pour commencer.",
    noMatches: "Aucun invité ne correspond.",
    searchPlaceholder: "Rechercher par nom, e-mail, groupe…",
    filterAll: "Tous",
    filterComing: "Viennent",
    filterWaiting: "En attente",
    filterCant: "Absents",
    loadingList: "Chargement de vos invités…",
    planningTools: "Outils de planification",
    tools: {
      groupsLabel: "Groupes & rôles",
      groupsSub: "Codez votre liste par couleur",
      seatingLabel: "Placement",
      seatingSub: "Plan de salle & cérémonie",
      staysLabel: "Hébergements & voyages",
      staysSub: "Blocs de chambres",
      formsLabel: "Formulaires",
      formsSub: "RSVP, et vos formulaires ajoutés",
      smsTemplateLabel: "Modèle SMS",
      smsTemplateSub: "Expéditeur + texte d'invitation",
      groupLinkLabel: "Lien de groupe",
      groupLinkSub: "Un seul lien pour un groupe WhatsApp",
    },
    guestList: "Liste des invités",
    reminderPromptStrong: (n: number) =>
      n === 1 ? "1 personne encore indécise" : `${n} personnes encore indécises`,
    reminderPromptLead: "Vous voulez que je relance en douceur",
    reminderPromptTail: " ? Je prépare un e-mail avec toutes leurs adresses.",
    reminderNoEmail: {
      before: "",
      strong: (n: number) => String(n),
      after:
        " invités n'ont pas encore répondu. Ajoutez une adresse pour les relancer, ou copiez leur lien d'invitation depuis leur fiche.",
    },
    sendNudge: "Envoyer une relance",
    opening: "Ouverture…",
    reminderSummary: (n: number) =>
      n === 1
        ? "Ouverture de votre messagerie avec 1 destinataire."
        : `Ouverture de votre messagerie avec ${n} destinataires.`,
    reminderFail: "Impossible d'envoyer les relances.",
    emailSubject: (couple: string) => `Petite relance — RSVP pour ${couple}`,
    emailBody: {
      hello: "Bonjour,",
      lead:
        "Un petit mot — nous serions ravis de savoir si vous pouvez vous joindre à nous",
      singleLink: (url: string) => `\nVoici votre lien d'invitation : ${url}\n`,
      multipleLinks:
        "\nVotre lien d'invitation personnel se trouve dans l'e-mail que nous vous avons envoyé — répondez à ce message si vous en avez besoin.\n",
      thanks: "Merci !",
    },
    theCouple: "le couple",

    addTitle: "Ajouter un invité",
    addSubtitle: "Il/elle sera ajouté à votre liste",
    fields: {
      firstName: "Prénom",
      lastName: "Nom",
      email: "E-mail (pour son invitation)",
      phone: "Téléphone",
      group: "Groupes (facultatif)",
      role: "Rôle dans le mariage (facultatif)",
      notes: "Notes (privées)",
    },
    placeholders: {
      firstName: "Priya",
      lastName: "Shah",
      email: "priya@exemple.com",
      phone: "+33 6 12 34 56 78",
      group: "Amis d'école",
      role: "Témoin, officiant·e…",
      notes: "Plus-un confirmé au téléphone, allergique aux fruits de mer…",
    },
    suggestedRoles: [
      "Témoin de la mariée",
      "Témoin du marié",
      "Demoiselle d'honneur",
      "Garçon d'honneur",
      "Officiant·e",
      "Porteur d'alliances",
      "Demoiselle des fleurs",
      "Témoin",
    ],
    submitAdd: "Ajouter",
    errAdd: "Ajout impossible. Réessayez.",
  },

  vendors: {
    title: "Prestataires",
    kicker: "12 prestataires",
    sub: "2 réservés · Union en action sur 3 · 1 attend votre décision",
    addVendor: "Ajouter un prestataire",
    filters: {
      all: "Tous",
      booked: "Réservés",
      comparing: "En cours",
      todo: "À faire",
    },
    unionQuiet: {
      before: "Union avance discrètement sur",
      strong: "3 d'entre eux",
      after: " en ce moment. Vous n'entendrez parler d'elle que pour une décision.",
    },
    setNewSearch: "Lancer une nouvelle recherche →",

    isNegotiating: (category: string) => `${category} · Union est en négociation`,
    openedOnYourBehalf: "Union a ouvert la discussion pour vous · lundi 9h12",
    composerPlaceholder: "Demandez à Union de contre-proposer ou d'ajuster…",
    agreedLabel: "Accord",
    agreedBody: {
      before: "Union a tenu votre budget et trouvé",
      strong: "540 $ d'économies",
      after: ". Validez pour figer l'accord et débloquer l'acompte.",
    },
    approveDeposit: "Valider & envoyer l'acompte",

    searchNewTitle: "Nouvelle recherche",
    searchNewSubtitle: "Photographe",
    searchDemoNotice:
      "Données d'exemple — c'est un aperçu de la façon dont vous briefez Union pour une nouvelle recherche. Ce n'est pas encore relié à votre compte.",
    findPhotographer: "Trouvons votre photographe.",
    searchNote: {
      lead: "Je gère la recherche, la prise de contact et la comparaison.",
      strong:
        "Je ne réserve, ne paie et n'engage jamais rien sans votre accord",
      trail: " — vous validez chaque sélection et chaque devis.",
    },
    styleYouLove: "Le style que vous aimez",
    budget: "Budget",
    budgetRange: "3 700 € – 4 700 €",
    flexible: "flexible",
    unionWillBeat: "Union essaiera de descendre sous le haut de la fourchette.",
    mustHaves: "Indispensables",
    anythingElse: "Autre chose ?",
    anythingElseDefault:
      "Chaleureux et candide — préfère les moments spontanés à la pose. Bonus s'il connaît le Domaine des Fleurs Sauvages.",
    startSearch: "Lancer la recherche",
    searchMyself: "Je préfère chercher moi-même",
    styles: [
      "Documentaire",
      "Heure dorée",
      "Éditorial",
      "Argentique / film",
      "Lumineux & aérien",
      "Sombre & feutré",
    ],
    stylesDefault: ["Documentaire", "Heure dorée"],
    musts: [
      "Couverture toute la journée",
      "Deuxième photographe",
      "Séance d'engagement",
      "Tirages fine art",
    ],
    mustsDefault: ["Couverture toute la journée", "Deuxième photographe"],

    searchActiveTitle: "Recherche photographe",
    searchActiveStarted: "Commencée il y a 2 jours",
    unionIsOnIt: "Union s'en occupe",
    reachedOut: "contactés",
    replied: "réponses",
    finalists: "finalistes",
    oneQuickCall: "Une décision rapide",
    searchAsk: {
      before: "Mes deux préférés sont autour de",
      priceOver: "5 000 €",
      middle:
        " — juste au-dessus de votre fourchette, mais chacun inclut un·e deuxième photographe ",
      italic: "et",
      end: " un album. Je pousse le budget, ou je reste ferme à 4 700 € ?",
    },
    stretchBudget: "Pousser à 5 000 €",
    holdBudget: "Rester à 4 700 €",
    activity: "Activité",
    browseMyself: "Parcourir tous les photographes moi-même →",

    addTitle: "Ajouter un prestataire",
    addSubtitle: "Nouveau chez Union",
    addHeadline: "Ajoutez un prestataire que nous ne connaissons pas encore.",
    addNote: {
      before: "Dès que vous l'ajoutez, il rejoint",
      strong: "l'annuaire Union",
      after:
        ". Je peux entamer la conversation pour vous — et les prochains couples pourront le trouver aussi.",
    },
    vendorName: "Nom du prestataire",
    vendorNameDefault: "Fernwood Film Co.",
    category: "Catégorie",
    categories: ["Photographie", "Vidéo", "Fleurs", "Musique", "Autre"],
    whereBased: "Où sont-ils basés",
    whereBasedDefault: "Vallée de l'Hudson, NY",
    howToReach: "Comment les contacter",
    reachWebsiteDefault: "fernwoodfilm.co",
    reachContactPlaceholder: "E-mail ou téléphone (facultatif)",
    whyYouLove: "Pourquoi vous les adorez",
    whyYouLoveDefault:
      "Ils ont photographié le mariage de ma sœur en argentique — magiques avec la lumière naturelle. Pas sûr qu'ils soient sur d'autres plateformes.",
    addToDirectory:
      "Ajouter à l'annuaire Union pour que d'autres couples puissent les découvrir.",
    addAndReach: "Ajouter & laisser Union les contacter",
    previewOnly: "Aperçu seulement — rien n'a été enregistré sur votre compte.",
  },

  plan: {
    title: "Et ensuite",
    kicker: "J-68",
    budget: "Budget",
    weekend: "Le week-end",
    team: "Planifier à plusieurs",
    unionOrder:
      "Classés par urgence — le moins de marge d'abord. Passez-m'en n'importe lequel.",
    thisWeek: "Cette semaine",
    bookSoon: "À réserver bientôt · suggéré par Union",
    later: "Plus tard — je vous rappellerai",
    ownerYou: "Vous",
    ownerUnion: "Union",

    budgetTitle: "Budget",
    budgetSubtitle: "Chiffres d'exemple",
    committedOf: (total: string) => `Engagé sur ${total}`,
    underCeiling: {
      strong: (amount: string) => `${amount} de moins`,
      trail: " que votre plafond — vous avez de la marge.",
    },
    unionSavings: {
      before: "Union a trouvé",
      strong: "1 180 $ d'économies",
      after: " ce mois-ci grâce à la négociation.",
    },
    byCategory: "Par catégorie",
    notePending: "en attente",
    notePlanned: "planifié",

    weekendTitle: "Le week-end",
    weekendSubtitle: "19 – 21 sept. · déroulé",
    days: {
      fri: { code: "VEN", label: "Accueil" },
      sat: { code: "SAM", label: "Le jour J" },
      sun: { code: "DIM", label: "Brunch" },
    },
    weekendNote:
      "Union envoie à chaque prestataire uniquement sa partie — heure d'arrivée, lieu, contact — une semaine avant.",

    teamTitle: "Planifier à plusieurs",
    teamSubtitle: "Votre équipe · 2",
    inviteHelper: "Invitez quelqu'un à vous aider",
    inviteBody: "Il/elle voit tout et peut agir avec vous.",
    invitePlaceholder: "Adresse e-mail…",
    whoDidWhat: "Qui a fait quoi",
    you: "vous",
    roles: {
      owner: "Propriétaire",
      partner: "Partenaire",
      pending: "En attente",
    },
  },

  settings: {
    title: "Réglages",
    language: "Langue",
    languageHint: "Choisissez la langue de l'application Union.",
    account: "Compte",
    signOut: "Se déconnecter",
  },

  account: {
    kicker: "Compte",
    title: "Vous",
    version: "Union pour le web · v1.0",

    weddingSection: "Votre mariage",
    weddingRowFallback: "Ajoutez votre date et votre lieu",
    teamRowTitle: "Qui organise",
    teamRowSub: (n: number) => `${n} personnes organisent ensemble`,

    plusKicker: "Union Plus",
    plusTitle: "Votre planificateur, sans limites",
    plusBody:
      "Négociations illimitées, toutes les recherches de prestataires, et priorité quand Union les contacte en votre nom.",
    plusRenews: "Renouvellement le 1er sept. · 18 $/mois",
    managePlan: "Gérer l'abonnement",

    accountSection: "Compte",
    billing: "Paiement et facturation",
    settingsRow: "Réglages",
    notificationsRow: "Notifications",
    notificationsSub: "Ce dont Union vous parle, et quand",
    privacyRow: "Confidentialité et vos données",
    helpRow: "Aide et support",

    // Edit profile
    profileTitle: "Votre profil",
    profileSubtitle: "Les informations qui ne concernent que vous.",
    detailsSection: "Vos informations",
    nameLabel: "Votre prénom",
    editOnWedding: "Modifier",
    nameEditsOnWedding:
      "Votre prénom se modifie depuis Votre mariage — c'est celui qu'Union utilise partout où elle vous présente.",
    email: "E-mail",
    emailNote:
      "Vous vous connectez avec un code envoyé par e-mail, il n'y a donc pas de mot de passe ici — contactez le support si cette adresse doit changer.",
    phone: "Téléphone",
    phoneCountry: "Pays",
    phoneLocalPlaceholder: "6 12 34 56 78",
    phoneHint:
      "Utilisé pour les rappels, et pour qu'un prestataire puisse vous joindre rapidement si besoin.",
    saved: "Enregistré.",

    // Your wedding
    weddingTitle: "Votre mariage",
    weddingKicker: "Réglages du mariage",
    partnerNotSet: "…",
    emptyPrompt:
      "Renseignez votre date et votre lieu, et Union commence à bâtir le plan autour d'eux.",
    detailsHeading: "Les informations",
    dateLabel: "Date du mariage",
    venueLabel: "Lieu",
    venueAddressLabel: "Adresse",
    venueAddressPlaceholder: "123 Orchard Rd, Hood River, OR",
    guestTargetLabel: "Nombre d'invités · objectif",
    styleLabel: "Style et ambiance",
    stylePlaceholder: "Jardin · tons neutres chauds · décontracté",
    manageSection: "Gérer",
    deleteWedding: "Supprimer le mariage et les données",
    deleting: "Suppression…",
    deleteConfirmTitle: "Supprimer ce mariage ?",
    deleteConfirmBody: (couple: string) =>
      `Cela supprime définitivement le mariage de ${couple} — invités, RSVP, plan de table, tout. Cette action est irréversible.`,
    deleteConfirmPrompt: "Tapez la phrase ci-dessous pour confirmer.",
    deletePhrase: (name: string) => `supprimer le mariage de ${name}`,
    deleteConfirmAction: "Supprimer définitivement",
    deleteConfirmMismatch: "La phrase ne correspond pas encore.",

    // App settings
    settingsTitle: "Réglages",
    settingsKicker: "Réglages de l'application",
    autonomyLabel: "Ce qu'Union fait seule",
    autonomyAsk: "Demander d'abord",
    autonomySuggest: "Suggérer",
    autonomyAuto: "Automatique",
    autonomyDescAsk:
      "Union vous présente chaque option et attend votre accord avant de réserver, payer ou répondre en votre nom.",
    autonomyDescSuggest:
      "Union recommande la prochaine étape et attend votre feu vert avant d'agir.",
    autonomyDescAuto:
      "Union gère elle-même les démarches courantes, et ne vous sollicite que pour les décisions qui comptent.",
    connectedSection: "Connecté",
    connectedCalendar: "Calendrier",
    connectedCalendarStatus: "Apple · activé",
    connectedEmail: "E-mail pour les prestataires",
    connectedOn: "Connecté",
    connectedContacts: "Contacts",
    connectedOff: "Non connecté",

    // Notifications
    notifTitle: "Notifications",
    notifPreviewNotice:
      "Aperçu — aucun moteur de notifications n'est branché pour l'instant, donc ces réglages n'envoient rien. Les canaux ci-dessous sont là à titre indicatif.",
    notifyWhen: "Me prévenir quand",
    notifVendorReplies: "Un prestataire répond",
    notifVendorRepliesSub: "Devis, questions, confirmations",
    notifGuestRsvps: "Un invité répond au RSVP",
    notifGuestRsvpsSub: "Oui, non, et notes alimentaires",
    notifUnionActions: "Union agit",
    notifUnionActionsSub: "Quand elle réserve ou négocie pour vous",
    notifCoOrganiser: "Un co-organisateur fait quelque chose",
    notifCoOrganiserSub: "Toute personne que vous avez invitée à aider",
    rhythm: "Rythme",
    notifWeeklyDigest: "Résumé hebdomadaire",
    notifWeeklyDigestSub: "Un résumé calme, le dimanche soir",
    notifQuietHours: "Heures calmes",
    notifQuietHoursSub: "Rien entre 21h et 8h",
    channels: "Canaux",
    channelPush: "Notifications push",
    channelOn: "Activé",
    channelEmail: "E-mail",
    channelDigestOnly: "Résumé seulement",

    // Privacy
    privacyTitle: "Confidentialité et vos données",
    privacyIntro:
      "Union ne conserve que ce dont elle a besoin pour planifier votre mariage avec vous — aucun suivi publicitaire, rien n'est vendu. Voici ce qui est conservé, et où.",
    privacyWhatWeKeep: "Ce que nous conservons",
    privacyAccountTitle: "Votre compte",
    privacyAccountBody: "Nom, e-mail et téléphone — utilisés pour vous connecter et vous contacter.",
    privacyWeddingTitle: "Votre mariage",
    privacyWeddingBody:
      "Date, lieu, nombre d'invités visé et style — les informations autour desquelles Union planifie.",
    privacyGuestsTitle: "Votre liste d'invités",
    privacyGuestsBody:
      "Noms, coordonnées, RSVP et notes alimentaires — visibles uniquement par vous et les personnes que vous invitez à aider.",
    privacyDeleteTitle: "Tout supprimer",
    privacyDeleteBody:
      "Supprimer votre mariage le retire définitivement, ainsi que tout ce qu'il contient — invités, RSVP, plan de table, absolument tout.",
  },

  rsvp: {
    invalidTitle: "Invitation introuvable",
    invalidBody:
      "Ce lien est incorrect ou n'est plus valide. Demandez au couple un nouveau lien.",
    joinPrompt: (couple: string) => `${couple} seraient ravis de vous compter parmi eux.`,
    dateAt: (date: string, venue: string) => `${date} · ${venue}`,
    accept: "Oui, je serai là",
    decline: "Hélas, je ne pourrai pas venir",
    dietaryLabel: "Un régime alimentaire particulier ?",
    dietaryPlaceholder: "Végétarien, sans gluten, allergies…",
    messageLabel: "Un mot pour le couple (facultatif)",
    messagePlaceholder: "Hâte de fêter ça avec vous !",
    submit: "Envoyer ma réponse",
    submitting: "Envoi…",
    thanksAccept: (couple: string) =>
      `Merci ! ${couple} ont été prévenus de votre venue.`,
    thanksDecline: (couple: string) =>
      `Votre réponse a été envoyée. ${couple} regretteront votre absence.`,
    update: "Modifier ma réponse",
  },

  // Lien d'accès générique (/join/[code]) — le point d'entrée pour un
  // groupe WhatsApp, où l'invité s'identifie par son nom plutôt que
  // d'ouvrir un lien personnel.
  join: {
    invalidTitle: "Lien introuvable",
    invalidBody:
      "Ce lien d'invitation est incorrect ou n'est plus valide. Demandez au couple un nouveau lien.",
    heroKicker: "Invitation de Mariage",
    namePromptTitle: "Quel est votre nom ?",
    namePromptSubtitle:
      "Entrez votre nom tel que le couple l'a renseigné, et nous retrouverons votre invitation.",
    firstNameLabel: "Prénom",
    lastNameLabel: "Nom",
    continueButton: "Retrouver mon invitation",
    searching: "Recherche…",
    confirmTitle: "C'est bien vous ?",
    yesButton: "Oui, c'est moi",
    noButton: "Non, réessayer",
    contactTitle: "Une dernière vérification",
    contactSubtitle:
      "Plusieurs invités partagent ce nom. Indiquez le numéro de téléphone ou l'email utilisé sur votre invitation.",
    contactLabel: "Téléphone ou email",
    contactPlaceholder: "ex. 06 12 34 56 78 ou vous@email.com",
    contactSubmit: "Confirmer",
    notFoundTitle: "Nous ne vous trouvons pas",
    notFoundBody: (couple: string) =>
      `Nous n'avons pas pu faire correspondre ce nom à une invitation. Contactez ${couple} directement, ils vous aideront.`,
    tryAgainButton: "Réessayer",
    redirecting: "Direction votre invitation…",
    errorGeneric: "Une erreur est survenue. Merci de réessayer.",
  },

  guestJoin: {
    title: "Retrouver votre invitation",
    contactSubtitle:
      "Indiquez l'adresse e-mail ou le numéro de téléphone renseigné par le couple.",
    otpSubtitle:
      "Indiquez l'adresse e-mail de votre invitation. Nous vous enverrons un code de vérification.",
    contactLabel: "E-mail ou numéro de téléphone",
    contactPlaceholder: "vous@email.com ou 06 12 34 56 78",
    emailLabel: "E-mail",
    emailPlaceholder: "vous@email.com",
    continueButton: "Continuer",
    searching: "Recherche…",
    contactSecurityNote:
      "Vos coordonnées servent uniquement à retrouver votre invitation. Union n'affiche jamais de liste d'invités.",
    otpSecurityNote:
      "Ce mariage exige un code à usage unique avant d'ouvrir une invitation.",
    firstNameTitle: "Quel est votre prénom ?",
    firstNameSubtitle:
      "Saisissez-le au plus proche. Cela nous aide à retrouver la bonne invitation.",
    firstNameLabel: "Prénom",
    codeTitle: "Consultez vos e-mails",
    codeSent: (email: string) => `Nous avons envoyé un code de connexion à ${email}.`,
    codeLabel: "Code de connexion",
    codePlaceholder: "12345678",
    verifyButton: "Vérifier",
    verifying: "Vérification…",
    resendButton: "Renvoyer le code",
    useAnotherContact: "Utiliser un autre e-mail ou téléphone",
    emailRequired: "Ce mariage exige actuellement une adresse e-mail.",
    invalidCode: "Ce code n'a pas fonctionné, ou il a expiré.",
    sendCodeError: "Impossible d'envoyer le code. Merci de réessayer.",
    noMatchTitle: "Nous n'avons pas retrouvé votre invitation",
    noMatchBody: (couple: string) =>
      `Vérifiez les informations saisies ou contactez directement ${couple}.`,
    tryAgainButton: "Réessayer",
    accessUnavailable:
      "Cette invitation n'est plus disponible pour ces coordonnées vérifiées.",
    genericError: "Une erreur est survenue. Merci de réessayer.",
    checkingSession: "Vérification de votre compte Union…",
    redirecting: "Direction votre invitation…",
  },

  guestEmailSetup: {
    kicker: "Conservez l'accès à votre invitation",
    title: "Ajoutez votre e-mail",
    subtitle:
      "Une adresse e-mail est nécessaire pour continuer. Nous allons la vérifier afin que vous seul puissiez l'utiliser pour vous reconnecter.",
    emailLabel: "E-mail",
    emailPlaceholder: "vous@email.com",
    sendCode: "Envoyer le code de vérification",
    sending: "Envoi…",
    codeTitle: "Vérifiez votre e-mail",
    codeSent: (email: string) => `Saisissez le code envoyé à ${email}.`,
    codeLabel: "Code de vérification",
    codePlaceholder: "12345678",
    verify: "Vérifier et continuer",
    verifying: "Vérification…",
    resend: "Renvoyer le code",
    changeEmail: "Utiliser un autre e-mail",
    sendError: "Impossible d'envoyer le code. Merci de réessayer.",
    verifyError: "Ce code n'a pas fonctionné, ou l'e-mail n'a pas pu être enregistré.",
  },

  // Connexion invité (/join/[code]) — Supabase Auth vérifie l'e-mail,
  // puis les RPC authentifiés ne révèlent que les invitations associées.
  joinOtp: {
    title: "Retrouver votre invitation",
    subtitle:
      "Indiquez l'adresse e-mail renseignée par le couple sur votre invitation.",
    phoneLabel: "Numéro de téléphone",
    phonePlaceholder: "ex. +33 6 12 34 56 78",
    continueButton: "Continuer",
    searching: "Recherche…",
    emailCollectTitle: "Consultez vos e-mails",
    emailCollectSubtitle:
      "Saisissez le code à usage unique envoyé par Union pour terminer la connexion.",
    emailLabel: "Email",
    emailPlaceholder: "vous@email.com",
    sendCodeButton: "Envoyer le code",
    codeSentTo: (email: string) => `Nous avons envoyé un code de connexion à ${email}.`,
    codeLabel: "Code de connexion",
    codePlaceholder: "12345678",
    verifyButton: "Vérifier",
    verifying: "Vérification…",
    resendButton: "Renvoyer le code",
    startOverButton: "Recommencer",
    savedEmailNotice:
      "Enregistré — vous pourrez vous connecter avec cet email seul la prochaine fois.",
    organiserHintText:
      "Ce contact est aussi lié à un compte organisateur sur Union.",
    organiserHintLink: "Se connecter en tant qu'organisateur",
    matchesTitle: "Choisissez votre invitation",
    matchesSubtitle:
      "Confirmez la personne pour laquelle vous répondez. Union ne choisit jamais automatiquement une identité d’invité.",
    matchLine: (guestName: string) => `Continuer en tant que ${guestName}`,
    invalidOrExpired: "Ce code n'a pas fonctionné, ou il a expiré.",
    cooldown: "Merci de patienter un instant avant de redemander un code.",
    tooManyRequests: "Trop de tentatives — réessayez un peu plus tard.",
    genericError: "Une erreur est survenue. Merci de réessayer.",
    accessUnavailable:
      "Cette invitation n'est plus disponible pour cet e-mail vérifié.",
    checkingSession: "Vérification de votre compte Union…",
    securityNote:
      "Union vérifie cet e-mail avec la même connexion sécurisée que celle des organisateurs.",
    noMatchTitle: "Aucune invitation pour cet e-mail",
    noMatchBody: (couple: string) =>
      `Cet e-mail vérifié ne figure pas sur une invitation pour ${couple}. Essayez une autre adresse ou contactez le couple.`,
    useAnotherEmail: "Utiliser un autre e-mail",
    useEmailInstead: "J'ai déjà un email enregistré — l'utiliser plutôt",
    useNameFallback: "Rechercher par nom à la place",
    backButton: "Retour",
    continueToInvitation: "Accéder à votre invitation",
  },

  // Outil organisateur "Lien de groupe" — la page /guests/group-link.
  groupLink: {
    title: "Lien de groupe",
    subtitle: "Partagez un seul lien avec tout un groupe",
    copyButton: "Copier le lien",
    copied: "Copié !",
    whatsappButton: "Partager sur WhatsApp",
    whatsappMessage: (couple: string, link: string) =>
      `Bonjour à tous ! 👋\n\n${couple} seraient ravis que vous confirmiez votre présence :\n${link}`,
    howItWorksTitle: "Comment ça marche",
    howItWorksBody:
      "Partagez ce lien dans une conversation WhatsApp, un e-mail groupé ou un chat familial. Par défaut, les invités retrouvent leur invitation avec l'e-mail ou le téléphone que vous avez renseigné ; Union demande le prénom uniquement si nécessaire et n'affiche jamais de liste d'invités.",
    authModeTitle: "Vérification des invités",
    contactModeLabel: "Correspondance des coordonnées — recommandé",
    contactModeHint:
      "Les invités utilisent leur e-mail ou téléphone, puis leur prénom uniquement si plusieurs invitations partagent ces coordonnées. Aucun code n'est demandé sauf si l'e-mail a déjà été vérifié comme connexion Union.",
    otpModeLabel: "Exiger un code de vérification",
    otpModeHint:
      "Les invités doivent vérifier l'e-mail de leur invitation. La vérification par téléphone pourra être ajoutée plus tard ; les invités sans e-mail ne peuvent pas encore utiliser ce mode.",
    otpCoverage: (withEmail: number, total: number) =>
      `${withEmail} invité${withEmail > 1 ? "s" : ""} sur ${total} ${total > 1 ? "ont" : "a"} actuellement un e-mail et ${total > 1 ? "peuvent" : "peut"} utiliser ce mode.`,
    allowNameFallbackLabel: "Autoriser aussi une recherche simple par nom",
    allowNameFallbackHint:
      "Saute la vérification de l'e-mail — les invités peuvent se retrouver par leur seul nom. Moins sûr, mais zéro friction pour les invités qui préfèrent éviter le code.",
  },

  offline: {
    title: "Vous êtes hors ligne",
    body: "Union se reconnectera dès que vous serez de retour en ligne.",
  },
  configNotice: {
    title: "Union n'est pas encore configuré",
    body:
      "Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY, puis rechargez.",
  },

  sample: {
    notice:
      "Données d'exemple — un aperçu de cette fonctionnalité. Ce n'est pas encore relié à votre compte.",

    vendors: {
      wildflowerBarn: {
        name: "Domaine des Fleurs Sauvages",
        category: "Lieu",
        blurb: "Acompte payé, il est à vous",
        statusLabel: "Réservé",
      },
      emberOak: {
        name: "Ember & Oak",
        category: "Traiteur",
        blurb: "Union relance pour la signature",
        statusLabel: "Contrat envoyé",
      },
      wildStem: {
        name: "The Wild Stem",
        category: "Fleurs",
        blurb: "540 $ sous le budget",
        statusLabel: "À valider",
      },
      larkLens: {
        name: "Lark & Lens",
        category: "Photographie",
        blurb: "Union en a sélectionné 2",
        statusLabel: "Comparaison",
      },
      astoria: {
        name: "Astoria Quartet",
        category: "Musique",
        blurb: "Cérémonie + cocktail",
        statusLabel: "Réservé",
      },
      mille: {
        name: "Mille-Feuille",
        category: "Gâteau",
        blurb: "Pas encore commencé",
        statusLabel: "À faire",
      },
    },

    negotiation: {
      unionWho: "Union · pour vous",
      rosaWho: "Rosa · The Wild Stem",
      turn1:
        "Bonjour Rosa — Maya & Daniel adorent votre style champêtre. Leur budget fleurs est de 3 200 $. Votre devis est arrivé à 3 840 $. Y a-t-il une marge pour se rapprocher ?",
      turn2:
        "On peut faire 3 500 $ en remplaçant les pivoines importées par des roses de jardin locales — tout aussi luxuriantes à cette saison.",
      turn3:
        "Des roses locales, parfait. On se met d'accord sur 3 300 $ et on vous met en avant sur la page prestataires publique du couple. Marché conclu ?",
      turn4:
        "Marché conclu — 3 300 $. Je vous envoie le contrat mis à jour. 🌿",
    },

    handling: [
      {
        title: "Relance du contrat signé d'Ember & Oak",
        sub: "Traiteur · relance envoyée ce matin",
        tag: "En cours",
      },
      {
        title: "Comparaison de 2 photographes",
        sub: "Tous les deux sous le budget · devis attendus jeudi",
        tag: "En cours",
      },
      {
        title: "Confirmation de l'Astoria Quartet",
        sub: "Heure d'arrivée & répertoire de la cérémonie",
        tag: "En cours",
      },
    ],

    budgetLines: {
      venue: "Lieu",
      catering: "Traiteur",
      florals: "Fleurs",
      photography: "Photographie",
      music: "Musique",
      attire: "Tenues",
    },

    thisWeek: [
      {
        title: "Valider le devis du fleuriste",
        sub: "540 $ sous le budget. Fige le créneau et libère l'acompte.",
        cta: "Voir & valider",
      },
      {
        title: "Relancer 20 invités pour leur RSVP",
        sub: "Le traiteur veut le décompte final dans 3 semaines.",
        cta: "Laisser Union relancer",
      },
    ],

    bookSoon: [
      {
        title: "Commander les faire-parts",
        sub: "6 semaines d'impression + envoi",
      },
      {
        title: "Réserver un essai coiffure & maquillage",
        sub: "Les meilleurs créneaux se remplissent 8 semaines à l'avance",
      },
      {
        title: "Réserver la location — arche & chaises",
        sub: "Stock limité en pleine saison",
      },
    ],

    later: [
      "Finaliser la dégustation du menu",
      "Confirmer le transport des invités",
      "Écrire le déroulé du jour J pour les prestataires",
    ],

    schedule: [
      {
        time: "13:00",
        title: "Arrivée & installation des prestataires",
        sub: "The Wild Stem · Ember & Oak",
        loc: "La grange — entrée de service",
      },
      {
        time: "14:30",
        title: "Fin de la coiffure & du maquillage",
        sub: "Suite de la mariée",
        loc: "Suite de la mariée, maison principale",
      },
      {
        time: "16:00",
        title: "Cérémonie",
        sub: "L'Astoria Quartet joue",
        loc: "La pelouse",
      },
      {
        time: "16:30",
        title: "Cocktail",
        sub: "Amuse-bouches présentés",
        loc: "Le verger",
      },
      {
        time: "18:00",
        title: "Réception & dîner",
        sub: "Ember & Oak au service",
        loc: "La grange",
      },
      {
        time: "23:00",
        title: "Départ aux cierges magiques",
        sub: "Navette n°1 vers l'auberge",
        loc: "Allée d'entrée",
      },
    ],

    team: [
      { name: "Maya", sub: "Accès complet", role: "Owner" },
      {
        name: "Daniel",
        sub: "Rejoint il y a 3 jours · accès complet",
        role: "Partner",
      },
      {
        name: "Line · maman de Maya",
        sub: "Invitée · peut consulter",
        role: "Pending",
      },
    ],
    activity: [
      {
        who: "Daniel",
        text: "a validé le devis de The Wild Stem",
        sub: "Fleurs · il y a 2 heures",
      },
      {
        who: "Union",
        text: "a négocié les fleurs à 3 300 $",
        sub: "540 $ économisés · il y a 2 heures",
      },
      {
        who: "Maya",
        text: "a ajouté Fernwood Film Co.",
        sub: "Nouveau prestataire · hier",
      },
      {
        who: "Daniel",
        text: "a invité Maya à planifier ensemble",
        sub: "il y a 3 jours",
      },
      {
        who: "Maya",
        text: "a défini le budget fleurs à 3 200 $",
        sub: "il y a 3 jours",
      },
    ],

    search: {
      title: "Recherche photographe",
      started: "Commencée il y a 2 jours",
      timeline: [
        {
          text: "Sélection de 6 candidats correspondant à votre style",
          sub: "Filtre documentaire + heure dorée · lundi",
          done: true,
        },
        {
          text: "Prise de contact avec votre date & budget",
          sub: "Message personnalisé à chacun · lundi",
          done: true,
        },
        {
          text: "Lark & Lens a répondu — disponible !",
          sub: "Envoi d'échantillons d'un mariage à la grange · mardi",
          done: true,
        },
        {
          text: "Comparaison de 2 finalistes pour vous",
          sub: "En attente de votre décision budgétaire ci-dessus",
          done: false,
        },
      ],
    },
  },

  smsTemplate: {
    title: "Modèle SMS",
    subtitle:
      "Rédigez votre SMS d'invitation une seule fois — Union personnalise chaque envoi avec le prénom de l'invité et son lien d'accès.",
    apiKeyLabel: "Votre compte Brevo",
    apiKeyField: "Clé API Brevo",
    apiKeyPlaceholder: "xkeysib-…",
    apiKeyShow: "Afficher",
    apiKeyHide: "Masquer",
    apiKeyHint: "L'envoi des SMS utilise votre propre compte Brevo, pas celui d'Union — récupérez votre clé API transactionnelle depuis",
    apiKeyLinkText: "Brevo → Paramètres → Clés API",
    apiKeyCreditsHint:
      "À noter : Brevo exige aussi l'achat d'un pack de crédits SMS avant que l'envoi fonctionne — les crédits email seuls ne suffisent pas.",
    senderLabel: "Expéditeur",
    senderField: "Nom ou numéro d'expéditeur",
    senderPlaceholder: "ex. Maya, ou +33612345678",
    senderHint:
      "Jusqu'à 11 lettres/chiffres pour un nom, ou un numéro au format international. Vos invités voient ce nom comme expéditeur du SMS.",
    templateLabel: "Message",
    templateHint:
      "Utilisez les jetons ci-dessous pour insérer des champs dynamiques. Le reste est envoyé tel quel.",
    placeholderTitle: (key: string) => `Insérer ${key}`,
    previewLabel: "Aperçu en direct",
    previewHint:
      "Rendu du message pour un invité fictif — mis à jour en temps réel.",
    previewEmpty: "Écrivez un message ci-dessus pour voir l'aperçu.",
    charCount: (n: number) => `${n} caractère${n === 1 ? "" : "s"}`,
    segmentCount: (n: number, enc: string) => `${n} SMS · ${enc}`,
    save: "Enregistrer le modèle",
    saved: "Enregistré",
  },
};
