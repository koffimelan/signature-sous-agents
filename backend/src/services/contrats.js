const { Op } = require('sequelize');
const { Contrat } = require('../models');
const stockage = require('./stockage');
const { cachet, sceller, verifierScellement } = require('./cles');
const { genererContrat, apposerSignature } = require('./pdfContrat');
const { dateFin, remplirModele } = require('../utils/regles');
const { conflit } = require('../utils/erreurs');

const LIBELLES_PIECE = { cni: 'carte nationale d\'identité', passeport: 'passeport', carte_sejour: 'carte de séjour' };
// Date seule (AAAA-MM-JJ) ou date complète (objet Date, affichée à l'heure d'Abidjan)
const formatDate = (d) => {
  if (!d) return '';
  if (d instanceof Date) return d.toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan' });
  return new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
};

// Numéro suivant de l'année : CTR-2026-0001, CTR-2026-0002...
async function prochainNumero(transaction, annee = new Date().getFullYear()) {
  const dernier = await Contrat.findOne({
    where: { numero: { [Op.like]: `CTR-${annee}-%` } }, order: [['numero', 'DESC']], transaction,
  });
  const n = dernier ? Number(dernier.numero.split('-')[2]) + 1 : 1;
  return `CTR-${annee}-${String(n).padStart(4, '0')}`;
}

// Valeurs qui remplacent les champs {{...}} du modèle
function valeursModele({ numero, sousAgent, modele, debut, fin, maintenant }) {
  return {
    numero_contrat: numero,
    code_sous_agent: sousAgent.code || '',
    civilite: sousAgent.civilite || '',
    nom: sousAgent.nom,
    prenoms: sousAgent.prenoms,
    date_naissance: formatDate(sousAgent.date_naissance),
    lieu_naissance: sousAgent.lieu_naissance || '',
    nationalite: sousAgent.nationalite || '',
    type_piece: LIBELLES_PIECE[sousAgent.type_piece] || sousAgent.type_piece || '',
    numero_piece: sousAgent.numero_piece || '',
    adresse: sousAgent.adresse || '',
    ville: sousAgent.ville || '',
    commune: sousAgent.commune || '',
    telephone: sousAgent.telephone,
    email: sousAgent.email,
    zone: sousAgent.zone || '',
    date_debut: formatDate(debut),
    date_fin: formatDate(fin),
    duree_mois: String(modele.duree_mois),
    taux_commission: modele.taux_commission || '',
    date_du_jour: formatDate(maintenant),
  };
}

// Génère le PDF du contrat à partir du modèle et l'enregistre au statut « brouillon »
async function creerContrat({
  sousAgent, modele, debut, auteurId, precedentId, transaction, maintenant = new Date(),
}) {
  const numero = await prochainNumero(transaction, maintenant.getFullYear());
  const fin = dateFin(debut, modele.duree_mois);
  const texte = remplirModele(modele.contenu, valeursModele({ numero, sousAgent, modele, debut, fin, maintenant }));
  const pdf = await genererContrat({ numero, titre: modele.titre, texte, dateGeneration: maintenant });
  const fichier = stockage.enregistrer('contrats', pdf, '.pdf');
  return Contrat.create({
    numero,
    sous_agent_id: sousAgent.id,
    modele_id: modele.id,
    cree_par: auteurId,
    contrat_precedent_id: precedentId || null,
    statut: 'brouillon',
    date_debut: debut,
    date_fin: fin,
    duree_mois: modele.duree_mois,
    fichier,
    empreinte: stockage.empreinte(pdf),
  }, { transaction });
}

// Contrôle d'intégrité du fichier conservé : son empreinte doit être celle enregistrée en base
function controlerFichier(contrat) {
  const signe = Boolean(contrat.fichier_signe);
  const contenu = stockage.lire('contrats', signe ? contrat.fichier_signe : contrat.fichier);
  const calculee = stockage.empreinte(contenu);
  const attendue = signe ? contrat.empreinte_signee : contrat.empreinte;
  return {
    version: signe ? 'signee' : 'generee',
    empreinte_attendue: attendue,
    empreinte_calculee: calculee,
    integre: calculee === attendue,
    scellement_valide: signe ? verifierScellement(contenu, contrat.scellement) : null,
    contenu,
  };
}

// Signature : image du sous-agent, page de preuve, empreinte SHA-256 et scellement RSA de la banque
async function signerContrat(contrat, { image, date, ip, canal, destination }) {
  const original = controlerFichier({ ...contrat.get(), fichier_signe: null });
  if (!original.integre) throw conflit('Le contrat validé a été modifié depuis sa génération : signature impossible');
  const sa = contrat.sous_agent;
  const pdfSigne = await apposerSignature(original.contenu, {
    numero: contrat.numero,
    signataire: `${sa.civilite ? `${sa.civilite} ` : ''}${sa.prenoms} ${sa.nom}`,
    piece: `${LIBELLES_PIECE[sa.type_piece] || sa.type_piece || ''} n° ${sa.numero_piece || ''}`,
    image,
    date,
    ip,
    canal,
    destination,
    empreinteValidee: contrat.empreinte,
    certificat: cachet().infos,
  });
  return {
    fichier_signe: stockage.enregistrer('contrats', pdfSigne, '.pdf'),
    empreinte_signee: stockage.empreinte(pdfSigne),
    scellement: sceller(pdfSigne),
  };
}

// Vérification d'un PDF présenté par un tiers (RG5)
async function verifierDocument(contenu) {
  const empreinte = stockage.empreinte(contenu);
  const signe = await Contrat.findOne({ where: { empreinte_signee: empreinte } });
  if (signe) {
    return {
      resultat: verifierScellement(contenu, signe.scellement) ? 'authentique' : 'scellement_invalide', empreinte, contrat: signe,
    };
  }
  const genere = await Contrat.findOne({ where: { empreinte } });
  if (genere) return { resultat: 'non_signe', empreinte, contrat: genere };
  return { resultat: 'inconnu', empreinte, contrat: null };
}

module.exports = {
  creerContrat, controlerFichier, signerContrat, verifierDocument,
};
