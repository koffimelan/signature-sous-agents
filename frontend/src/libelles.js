// Libellés affichés à l'écran pour les valeurs enregistrées en base

export const ROLES = {
  admin: 'Administrateur',
  commercial: 'Chargé commercial',
  conformite: 'Agent de conformité',
  sous_agent: 'Sous-agent',
};

// Chaque statut a un texte et une couleur (l'information ne repose jamais sur la couleur seule)
export const STATUTS_SOUS_AGENT = {
  brouillon: { texte: 'Dossier en cours', couleur: 'secondary' },
  soumis: { texte: 'À étudier', couleur: 'warning' },
  admis: { texte: 'Admis', couleur: 'info' },
  rejete: { texte: 'Rejeté', couleur: 'danger' },
  actif: { texte: 'Actif', couleur: 'success' },
  inactif: { texte: 'Inactif', couleur: 'secondary' },
};

export const STATUTS_CONTRAT = {
  brouillon: { texte: 'Validation commerciale', couleur: 'warning' },
  validation_conformite: { texte: 'Validation conformité', couleur: 'warning' },
  a_signer: { texte: 'À signer', couleur: 'info' },
  signe: { texte: 'Signé', couleur: 'success' },
  rejete: { texte: 'Rejeté', couleur: 'danger' },
  expire: { texte: 'Expiré', couleur: 'secondary' },
  resilie: { texte: 'Résilié', couleur: 'secondary' },
};

export const TYPES_PIECE = {
  cni: 'Copie de la pièce d\'identité',
  photo: 'Photo d\'identité',
  justificatif_domicile: 'Justificatif de domicile',
  casier_judiciaire: 'Extrait de casier judiciaire',
  registre_commerce: 'Registre du commerce',
};
export const PIECES_OBLIGATOIRES = ['cni', 'photo', 'justificatif_domicile'];

export const TYPES_IDENTITE = { cni: 'Carte nationale d\'identité', passeport: 'Passeport', carte_sejour: 'Carte de séjour' };

export const NIVEAUX_ALERTE = {
  'J-30': { texte: 'Échéance dans 30 jours', couleur: 'warning' },
  'J-7': { texte: 'Échéance dans 7 jours', couleur: 'danger' },
  echu: { texte: 'Expiré', couleur: 'secondary' },
};

export const ETAPES = { commercial: 'Validation commerciale', conformite: 'Validation de conformité' };

export function formatDate(d) {
  if (!d) return '-';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00Z`) : new Date(d);
  return date.toLocaleDateString('fr-FR', { timeZone: /^\d{4}-\d{2}-\d{2}$/.test(d) ? 'UTC' : 'Africa/Abidjan' });
}

export function formatDateHeure(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', dateStyle: 'short', timeStyle: 'short' });
}

export function tailleFichier(octets) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

// Délai en heures affiché en heures ou en jours
export function formatDelai(heures) {
  if (heures === null || heures === undefined) return '-';
  if (heures < 48) return `${String(Math.round(heures * 10) / 10).replace('.', ',')} h`;
  return `${String(Math.round((heures / 24) * 10) / 10).replace('.', ',')} jours`;
}
