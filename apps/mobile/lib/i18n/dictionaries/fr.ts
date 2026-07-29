import type { Dictionary } from "./en";

// Typed against `Dictionary`, so this file must expose exactly the same
// keys and function signatures as `en.ts`. If a new English key ships
// without a French translation, typecheck fails — French can never
// silently lag behind the app.

export const fr: Dictionary = {
  lang: {
    en: "Anglais",
    fr: "Français",
    switchTo: "Langue",
    description: "Choisissez la langue de l'application Union.",
  },

  common: {
    loading: "Chargement…",
    oneMoment: "Un instant…",
    save: "Enregistrer",
    saved: "Enregistré",
    cancel: "Annuler",
    signIn: "Se connecter",
    signOut: "Se déconnecter",
    signOutConfirm: "Voulez-vous vraiment vous déconnecter ?",
    signOutTitle: "Déconnexion",
    couldNotSave: "Enregistrement impossible",
    error: "Une erreur est survenue.",
    add: "Ajouter",
    invalidDate: "Date invalide",
    invalidDateBody: "Utilisez le format AAAA-MM-JJ.",
  },

  signIn: {
    tagline: "Organisez votre mariage, sereinement.",
    emailLabel: "Adresse e-mail",
    emailPlaceholder: "vous@exemple.com",
    codeLabel: "Code à 8 chiffres",
    codePlaceholder: "12345678",
    sendCode: "Recevoir un code par e-mail",
    submit: "Se connecter",
    resend: "Renvoyer le code",
    useDifferentEmail: "Utiliser une autre adresse",
    codeHelper: (email: string) =>
      `Nous avons envoyé un code à 8 chiffres à ${email}. Saisissez-le ci-dessous pour terminer la connexion.`,
    errEmail: "Veuillez saisir votre adresse e-mail.",
    errCodeLength: "Saisissez le code à 8 chiffres reçu par e-mail.",
    errSend: "Impossible d'envoyer le code.",
    errVerify: "Ce code n'a pas fonctionné — réessayez.",
  },

  onboarding: {
    title: "Préparons le décor",
    subtitle: "Quelques détails pour qu'Union vous aide à préparer le grand jour.",
    partnerOne: "Partenaire 1",
    partnerOnePlaceholder: "ex. Alex",
    partnerTwo: "Partenaire 2",
    partnerTwoPlaceholder: "ex. Sam",
    weddingDate: "Date du mariage (facultatif)",
    weddingDatePlaceholder: "2026-09-12",
    dateHint: "Format : AAAA-MM-JJ",
    venue: "Lieu (facultatif)",
    venuePlaceholder: "ex. Domaine du Ruisseau",
    submit: "Commencer à planifier",
    errMissingPartners: "Ajoutez les prénoms des deux partenaires.",
    errDate: "La date du mariage doit être au format AAAA-MM-JJ.",
    errSession: "Votre session a expiré. Reconnectez-vous.",
    errSave: "Enregistrement impossible. Réessayez.",
  },

  tabs: {
    home: "Accueil",
    guests: "Invités",
    settings: "Réglages",
  },

  home: {
    dateTBD: "Date à définir",
    countdownDay: "jour restant",
    countdownDays: "jours restants",
    rsvpOverview: "Récapitulatif RSVP",
    attending: "Présents",
    awaiting: "En attente",
    declined: "Absents",
    invitedParties: "Foyers invités",
    confirmedHeadcount: "Total confirmé",
  },

  guests: {
    emptyTitle: "Aucun invité pour l'instant",
    emptyBody: "Ajoutez votre premier invité pour commencer à suivre les RSVP.",
    addGuest: "Ajouter un invité",
    partyOne: "1 invité",
    party: (n: number) => `${n} invités`,
    status: {
      attending: "Vient",
      declined: "Ne vient pas",
      pending: "En attente",
    },
  },

  settings: {
    weddingDetails: "Détails du mariage",
    partnerOne: "Partenaire 1",
    partnerTwo: "Partenaire 2",
    weddingDate: "Date du mariage",
    dateHint: "Format : AAAA-MM-JJ",
    venue: "Lieu",
    venueAddress: "Adresse du lieu",
    save: "Enregistrer",
    signedInAs: "Connecté·e en tant que",
    language: "Langue",
    languageHint: "Choisissez la langue de l'application Union.",
  },
};
