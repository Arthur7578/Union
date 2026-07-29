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
    demo: "Données de démonstration",
    demoNotice:
      "Cet écran affiche du contenu d'exemple — pas les vraies données de votre mariage. C'est un aperçu d'une fonctionnalité qui n'est pas encore reliée au backend.",
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
      after: " pour vous en ce moment. Rien à craindre aujourd'hui — sauf une jolie décision à prendre.",
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
    kicker: "Votre liste",
    subtitle: (invited: number, coming: number) =>
      `${invited} invités · ${coming} présents`,
    add: "Ajouter un invité",
    empty: "Aucun invité pour l'instant — ajoutez votre première invitation.",
    filterAll: "Tous",
    filterComing: "Viennent",
    filterWaiting: "En attente",
    filterCant: "Ne viennent pas",
    inviteLink: "Lien d'invitation personnel",
    copyLink: "Copier le lien",
    linkCopied: "Copié !",
    status: {
      pending: "En attente",
      accepted: "Vient",
      declined: "Ne vient pas",
    },
    numAttending: (n: number) => (n === 1 ? "1 personne" : `${n} personnes`),
    detailsTitle: "Détails de l'invité",
    fullName: "Nom complet",
    email: "E-mail",
    phone: "Téléphone",
    notes: "Notes",
    plusOnes: "Accompagnants",
    dietary: "Régime alimentaire",
    message: "Message",
    saveGuest: "Enregistrer",
    removeGuest: "Retirer l'invité",
    confirmRemove: "Retirer cet invité ? Cette action est irréversible.",
    invitedOn: "Invité le",
    respondedOn: "Répondu le",
  },

  vendors: {
    title: "Prestataires",
    kicker: "Votre tableau",
    addVendor: "Ajouter un prestataire",
    searchTitle: "Lancer une recherche",
    searchInProgress: "Recherche en cours",
    negotiation: "Négociation",
    newVendor: "Nouveau prestataire",
  },

  plan: {
    title: "Planning",
    kicker: "Et ensuite",
    budget: "Budget",
    weekend: "Le week-end",
    team: "Planifier à plusieurs",
  },

  settings: {
    title: "Réglages",
    language: "Langue",
    languageHint: "Choisissez la langue de l'application Union.",
    account: "Compte",
    signOut: "Se déconnecter",
  },

  rsvp: {
    invalidTitle: "Invitation introuvable",
    invalidBody:
      "Ce lien est incorrect ou n'est plus valide. Demandez au couple un nouveau lien.",
    joinPrompt: (couple: string) => `${couple} seraient ravis de vous compter parmi eux.`,
    dateAt: (date: string, venue: string) => `${date} · ${venue}`,
    accept: "Oui, je serai là",
    decline: "Hélas, je ne pourrai pas venir",
    numAttendingLabel: "Combien serez-vous ?",
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

  offline: {
    title: "Vous êtes hors ligne",
    body: "Union se reconnectera dès que vous serez de retour en ligne.",
  },
  configNotice: {
    title: "Union n'est pas encore configuré",
    body:
      "Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY, puis rechargez.",
  },
};
