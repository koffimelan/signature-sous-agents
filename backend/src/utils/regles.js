// Règles de gestion sous forme de fonctions pures (testées sans base de données)
const { PIECES_OBLIGATOIRES } = require('./constantes');

const JOUR = 24 * 60 * 60 * 1000;

// Date du jour à minuit (UTC), pour comparer des dates sans tenir compte de l'heure
function aujourdhui(reference = Date.now()) {
  const d = new Date(reference);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function versJour(date) {
  const d = new Date(date);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// RG1 : pièces obligatoires encore manquantes dans un dossier
function piecesManquantes(typesFournis) {
  const fournis = new Set(typesFournis);
  return PIECES_OBLIGATOIRES.filter((t) => !fournis.has(t));
}

// Date de fin d'un contrat : date de début + durée en mois, moins un jour (format AAAA-MM-JJ)
function dateFin(debut, mois) {
  const d = new Date(`${debut}T00:00:00Z`);
  const jour = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + Number(mois));
  // 31 janvier + 1 mois : on reste à la fin de février au lieu de déborder sur mars
  if (d.getUTCDate() !== jour) d.setUTCDate(0);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function joursRestants(date, reference = Date.now()) {
  return Math.round((versJour(date) - aujourdhui(reference)) / JOUR);
}

// RG6 : niveau d'alerte d'un contrat signé selon sa date de fin
function niveauAlerte(fin, reference = Date.now(), seuil1 = 30, seuil2 = 7) {
  const jours = joursRestants(fin, reference);
  if (jours < 0) return 'echu';
  if (jours <= seuil2) return 'J-7';
  if (jours <= seuil1) return 'J-30';
  return null;
}

// RG3 : transitions autorisées du circuit de validation, selon le rôle
const TRANSITIONS = {
  valider: { brouillon: { role: 'commercial', vers: 'validation_conformite' }, validation_conformite: { role: 'conformite', vers: 'a_signer' } },
  rejeter: { brouillon: { role: 'commercial', vers: 'rejete' }, validation_conformite: { role: 'conformite', vers: 'rejete' } },
};

// Renvoie l'étape franchie et le nouveau statut, ou null si l'action n'est pas permise
function transition(action, statut, role) {
  const t = TRANSITIONS[action]?.[statut];
  if (!t) return null;
  if (role !== t.role && role !== 'admin') return null;
  return { etape: statut === 'brouillon' ? 'commercial' : 'conformite', vers: t.vers };
}

// RG4 : un code OTP n'est accepté qu'une fois, avant expiration et dans la limite des tentatives
function etatOtp(otp, reference = Date.now(), maxTentatives = 3) {
  if (!otp) return 'absent';
  if (otp.utilise) return 'utilise';
  if (new Date(otp.expire_le).getTime() < reference) return 'expire';
  if (otp.tentatives >= maxTentatives) return 'bloque';
  return 'valide';
}

// RG7 : un contrat peut être renouvelé dans les 60 jours qui précèdent sa fin, ou après son expiration
function renouvelable(contrat, reference = Date.now()) {
  if (!['signe', 'expire'].includes(contrat.statut)) return false;
  return joursRestants(contrat.date_fin, reference) <= 60;
}

// Remplace les champs {{nom}}, {{prenoms}}... d'un modèle de contrat
function remplirModele(texte, valeurs) {
  return String(texte).replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (tout, cle) => (valeurs[cle] ?? `[${cle}]`));
}

module.exports = {
  aujourdhui, piecesManquantes, dateFin, joursRestants, niveauAlerte, transition, etatOtp, renouvelable, remplirModele,
};
