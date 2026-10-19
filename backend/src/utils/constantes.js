// Valeurs autorisées, reprises du dossier de conception (fiche PSI, section 2.3)

const ROLES = ['admin', 'commercial', 'conformite', 'sous_agent'];

// Dossier du sous-agent : brouillon (en cours de saisie) -> soumis -> admis ou rejeté -> actif (contrat signé) -> inactif
const STATUTS_SOUS_AGENT = ['brouillon', 'soumis', 'admis', 'rejete', 'actif', 'inactif'];

// Pièces justificatives (KYC) ; les trois premières sont obligatoires (RG1)
const TYPES_PIECE = ['cni', 'photo', 'justificatif_domicile', 'casier_judiciaire', 'registre_commerce'];
const PIECES_OBLIGATOIRES = ['cni', 'photo', 'justificatif_domicile'];

// Cycle de vie d'un contrat (RG3) :
// brouillon (généré) -> validation_conformite (validé par le commercial) -> a_signer (validé par la conformité) -> signe
// Un rejet à l'une des deux étapes fait passer le contrat à « rejete » ; un contrat signé devient « expire » à sa date de fin
const STATUTS_CONTRAT = ['brouillon', 'validation_conformite', 'a_signer', 'signe', 'rejete', 'expire', 'resilie'];
const CONTRATS_EN_COURS = ['brouillon', 'validation_conformite', 'a_signer', 'signe'];

const ETAPES_VALIDATION = ['commercial', 'conformite'];
const NIVEAUX_ALERTE = ['J-30', 'J-7', 'echu'];
const TYPES_IDENTITE = ['cni', 'passeport', 'carte_sejour'];

module.exports = {
  ROLES, STATUTS_SOUS_AGENT, TYPES_PIECE, PIECES_OBLIGATOIRES, STATUTS_CONTRAT, CONTRATS_EN_COURS,
  ETAPES_VALIDATION, NIVEAUX_ALERTE, TYPES_IDENTITE,
};
