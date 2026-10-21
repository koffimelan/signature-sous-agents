// Libellés affichés à l'écran pour les valeurs enregistrées en base

export const ROLES = {
  admin: 'Administrateur',
  commercial: 'Chargé commercial',
  conformite: 'Agent de conformité',
  sous_agent: 'Sous-agent',
};

// Chaque statut est écrit en toutes lettres, en vert (en règle), ambre (attend une action),
// rouge (problème) ou gris (neutre ou terminé) : vert, rouge et gris viennent du logo d'AFG Bank
export const STATUTS_SOUS_AGENT = {
  brouillon: { texte: 'Dossier en cours', ton: 'gris' },
  soumis: { texte: 'À étudier', ton: 'ambre' },
  admis: { texte: 'Admis', ton: 'vert' },
  rejete: { texte: 'Rejeté', ton: 'rouge' },
  actif: { texte: 'Actif', ton: 'vert' },
  inactif: { texte: 'Inactif', ton: 'gris' },
};

export const STATUTS_CONTRAT = {
  brouillon: { texte: 'Validation commerciale', ton: 'ambre' },
  validation_conformite: { texte: 'Validation conformité', ton: 'ambre' },
  a_signer: { texte: 'À signer', ton: 'ambre' },
  signe: { texte: 'Signé', ton: 'vert' },
  rejete: { texte: 'Rejeté', ton: 'rouge' },
  expire: { texte: 'Expiré', ton: 'gris' },
  resilie: { texte: 'Résilié', ton: 'gris' },
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
  'J-30': { texte: 'Échéance dans 30 jours', ton: 'ambre' },
  'J-7': { texte: 'Échéance dans 7 jours', ton: 'rouge' },
  echu: { texte: 'Expiré', ton: 'gris' },
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
