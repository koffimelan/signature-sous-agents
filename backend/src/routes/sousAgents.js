const router = require('express').Router();
const path = require('path');
const multer = require('multer');
const { Op } = require('sequelize');
const {
  SousAgent, PieceJustificative, Contrat, Utilisateur,
} = require('../models');
const { autoriser } = require('../middlewares/auth');
const { journaliser } = require('../services/journal');
const { envoyerEmail } = require('../services/mail');
const stockage = require('../services/stockage');
const { piecesManquantes } = require('../utils/regles');
const { TYPES_PIECE } = require('../utils/constantes');
const {
  introuvable, requete, interdit, conflit,
} = require('../utils/erreurs');

const PERSONNEL = ['admin', 'commercial', 'conformite'];
const CHAMPS = ['civilite', 'nom', 'prenoms', 'date_naissance', 'lieu_naissance', 'nationalite', 'type_piece', 'numero_piece',
  'telephone', 'email', 'adresse', 'ville', 'commune', 'activite', 'zone'];
// Informations à renseigner avant de soumettre la candidature (RG1)
const CHAMPS_OBLIGATOIRES = { date_naissance: 'date de naissance', numero_piece: 'numéro de la pièce d\'identité', adresse: 'adresse', ville: 'ville', zone: 'zone de prospection' };
const MODIFIABLE = ['brouillon', 'rejete'];

// Pièces acceptées : PDF, JPEG ou PNG, 5 Mo au plus ; le contenu est contrôlé, pas seulement l'extension
const TYPES_FICHIER = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };
const envoi = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, fichier, ok) => ok(null, Boolean(TYPES_FICHIER[fichier.mimetype])),
});
const SIGNATURES = { '.pdf': '25504446', '.jpg': 'ffd8ff', '.png': '89504e47' };

function extraire(corps) {
  const donnees = {};
  for (const champ of CHAMPS) if (corps[champ] !== undefined) donnees[champ] = corps[champ] === '' ? null : corps[champ];
  if (donnees.email) donnees.email = String(donnees.email).trim().toLowerCase();
  if (donnees.nom) donnees.nom = String(donnees.nom).trim().toUpperCase();
  if (donnees.numero_piece) donnees.numero_piece = String(donnees.numero_piece).replace(/\s+/g, '').toUpperCase();
  return donnees;
}

const inclure = [
  { model: PieceJustificative, as: 'pieces', attributes: { exclude: ['fichier'] } },
  { model: Contrat, as: 'contrats', attributes: ['id', 'numero', 'statut', 'date_debut', 'date_fin', 'date_signature'] },
  { model: Utilisateur, as: 'decideur', attributes: ['nom', 'prenoms'] },
];

async function dossierDe(req) {
  const dossier = await SousAgent.findOne({ where: { utilisateur_id: req.utilisateur.id }, include: inclure });
  if (!dossier) throw introuvable('Dossier');
  return dossier;
}

async function dossierParId(id) {
  const dossier = await SousAgent.findByPk(id, { include: inclure });
  if (!dossier) throw introuvable('Dossier');
  return dossier;
}

// --- Liste et consultation (personnel de la banque) ---
router.get('/', autoriser(...PERSONNEL), async (req, res) => {
  const where = {};
  if (req.query.statut) where.statut = req.query.statut;
  if (req.query.q) {
    const q = `%${String(req.query.q).trim()}%`;
    where[Op.or] = ['nom', 'prenoms', 'code', 'telephone', 'numero_piece', 'ville'].map((c) => ({ [c]: { [Op.like]: q } }));
  }
  res.json(await SousAgent.findAll({ where, include: inclure, order: [['updatedAt', 'DESC']] }));
});

// --- Espace du sous-agent : son propre dossier ---
router.get('/moi', autoriser('sous_agent'), async (req, res) => res.json(await dossierDe(req)));

router.put('/moi', autoriser('sous_agent'), async (req, res) => {
  const dossier = await dossierDe(req);
  if (!MODIFIABLE.includes(dossier.statut)) throw interdit('Votre dossier a été soumis : il ne peut plus être modifié');
  const donnees = extraire(req.body);
  delete donnees.email; // l'e-mail est celui du compte de connexion
  await dossier.update(donnees);
  await journaliser(req, 'Mise à jour de son dossier de candidature');
  res.json(await dossierDe(req));
});

// RG1 : la candidature n'est soumise que si le dossier est complet
router.post('/moi/soumettre', autoriser('sous_agent'), async (req, res) => {
  const dossier = await dossierDe(req);
  if (!MODIFIABLE.includes(dossier.statut)) throw conflit('Ce dossier a déjà été soumis');
  const manquants = Object.entries(CHAMPS_OBLIGATOIRES).filter(([c]) => !dossier[c]).map(([, libelle]) => libelle);
  const pieces = piecesManquantes(dossier.pieces.map((p) => p.type));
  if (manquants.length || pieces.length) {
    throw requete('Dossier incomplet : la candidature ne peut pas être soumise', { informations: manquants, pieces });
  }
  await dossier.update({ statut: 'soumis', date_soumission: new Date(), motif_rejet: null });
  await journaliser(req, `Soumission de la candidature de ${dossier.prenoms} ${dossier.nom}`);

  const commerciaux = await Utilisateur.findAll({ where: { role: 'commercial', actif: true } });
  await envoyerEmail({
    a: commerciaux.map((u) => u.email),
    sujet: `Nouvelle candidature de sous-agent : ${dossier.prenoms} ${dossier.nom}`,
    html: `<p>Une candidature complète vient d'être déposée par <b>${dossier.prenoms} ${dossier.nom}</b> (${dossier.ville || ''}). Elle est à étudier dans la plateforme.</p>`,
  });
  res.json(await dossierDe(req));
});

// --- Décision du chargé commercial ---
router.post('/:id/admettre', autoriser('admin', 'commercial'), async (req, res) => {
  const dossier = await dossierParId(req.params.id);
  if (dossier.statut !== 'soumis') throw conflit('Seule une candidature soumise peut être admise');
  await dossier.update({
    statut: 'admis', code: `SA-${String(dossier.id).padStart(5, '0')}`, date_decision: new Date(), decide_par: req.utilisateur.id, motif_rejet: null,
  });
  await journaliser(req, `Admission de la candidature de ${dossier.prenoms} ${dossier.nom} (${dossier.code})`);
  await envoyerEmail({
    a: dossier.email,
    sujet: 'Votre candidature de sous-agent AFG Bank a été retenue',
    html: `<p>Bonjour ${dossier.prenoms},</p><p>Votre dossier a été accepté. Votre contrat sera bientôt disponible pour signature dans votre espace.</p>`,
  });
  res.json(await dossierParId(dossier.id));
});

router.post('/:id/rejeter', autoriser('admin', 'commercial'), async (req, res) => {
  const motif = String(req.body?.motif || '').trim();
  if (!motif) throw requete('Le motif du rejet est obligatoire');
  const dossier = await dossierParId(req.params.id);
  if (dossier.statut !== 'soumis') throw conflit('Seule une candidature soumise peut être rejetée');
  await dossier.update({ statut: 'rejete', motif_rejet: motif, date_decision: new Date(), decide_par: req.utilisateur.id });
  await journaliser(req, `Rejet de la candidature de ${dossier.prenoms} ${dossier.nom} : ${motif}`);
  await envoyerEmail({
    a: dossier.email,
    sujet: 'Votre candidature de sous-agent AFG Bank',
    html: `<p>Bonjour ${dossier.prenoms},</p><p>Votre dossier n'a pas pu être accepté en l'état pour le motif suivant : <b>${motif}</b>.</p><p>Vous pouvez le compléter puis le soumettre à nouveau depuis votre espace.</p>`,
  });
  res.json(await dossierParId(dossier.id));
});

router.get('/:id', autoriser(...PERSONNEL), async (req, res) => {
  const dossier = await SousAgent.findByPk(req.params.id, {
    include: [...inclure, { model: Utilisateur, as: 'compte', attributes: ['email', 'actif', 'createdAt'] }],
  });
  if (!dossier) throw introuvable('Dossier');
  res.json(dossier);
});

router.put('/:id', autoriser('admin', 'commercial'), async (req, res) => {
  const dossier = await dossierParId(req.params.id);
  await dossier.update(extraire(req.body));
  await journaliser(req, `Modification du dossier de ${dossier.prenoms} ${dossier.nom}`);
  res.json(await dossierParId(dossier.id));
});

// --- Pièces justificatives ---
async function ajouterPiece(req, dossier) {
  if (!req.file) throw requete('Fichier manquant ou format refusé (PDF, JPEG ou PNG, 5 Mo au plus)');
  const type = req.body?.type;
  if (!TYPES_PIECE.includes(type)) throw requete('Type de pièce inconnu');
  const extension = TYPES_FICHIER[req.file.mimetype];
  if (!req.file.buffer.subarray(0, 4).toString('hex').startsWith(SIGNATURES[extension])) {
    throw requete('Le contenu du fichier ne correspond pas à son format');
  }

  // Une seule pièce par type : la nouvelle remplace l'ancienne
  const ancienne = await PieceJustificative.findOne({ where: { sous_agent_id: dossier.id, type } });
  const fichier = stockage.enregistrer('pieces', req.file.buffer, extension);
  const piece = await PieceJustificative.create({
    sous_agent_id: dossier.id,
    type,
    nom_origine: path.basename(req.file.originalname).slice(0, 200),
    fichier,
    type_mime: req.file.mimetype,
    taille: req.file.size,
    empreinte: stockage.empreinte(req.file.buffer),
  });
  if (ancienne) {
    stockage.supprimer('pieces', ancienne.fichier);
    await ancienne.destroy();
  }
  await journaliser(req, `Dépôt de la pièce « ${type} » au dossier de ${dossier.prenoms} ${dossier.nom}`);
  const { fichier: _f, ...reponse } = piece.toJSON();
  return reponse;
}

router.post('/moi/pieces', autoriser('sous_agent'), envoi.single('fichier'), async (req, res) => {
  const dossier = await dossierDe(req);
  if (!MODIFIABLE.includes(dossier.statut)) throw interdit('Votre dossier a été soumis : les pièces ne peuvent plus être modifiées');
  res.status(201).json(await ajouterPiece(req, dossier));
});

router.post('/:id/pieces', autoriser('admin', 'commercial'), envoi.single('fichier'), async (req, res) => {
  res.status(201).json(await ajouterPiece(req, await dossierParId(req.params.id)));
});

// Accès à une pièce : le personnel de la banque, ou le sous-agent pour son propre dossier
async function pieceAccessible(req) {
  const piece = await PieceJustificative.findByPk(req.params.pieceId, { include: [SousAgent] });
  if (!piece) throw introuvable('Pièce');
  const proprietaire = piece.sous_agent.utilisateur_id === req.utilisateur.id;
  if (!PERSONNEL.includes(req.utilisateur.role) && !proprietaire) throw interdit();
  return { piece, proprietaire };
}

router.get('/pieces/:pieceId/fichier', async (req, res) => {
  const { piece } = await pieceAccessible(req);
  res.type(piece.type_mime);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(piece.nom_origine)}"`);
  res.send(stockage.lire('pieces', piece.fichier));
});

router.delete('/pieces/:pieceId', async (req, res) => {
  const { piece, proprietaire } = await pieceAccessible(req);
  const gestionnaire = ['admin', 'commercial'].includes(req.utilisateur.role);
  if (!gestionnaire && !(proprietaire && MODIFIABLE.includes(piece.sous_agent.statut))) throw interdit();
  stockage.supprimer('pieces', piece.fichier);
  await piece.destroy();
  await journaliser(req, `Suppression de la pièce « ${piece.type} » du dossier de ${piece.sous_agent.prenoms} ${piece.sous_agent.nom}`);
  res.status(204).end();
});

module.exports = router;
