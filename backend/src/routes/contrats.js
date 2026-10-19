const router = require('express').Router();
const multer = require('multer');
const { Op } = require('sequelize');
const {
  sequelize, Contrat, SousAgent, ModeleContrat, Validation, CodeOtp, Utilisateur, Alerte,
} = require('../models');
const { autoriser } = require('../middlewares/auth');
const { journaliser, adresseIp } = require('../services/journal');
const { envoyerEmail } = require('../services/mail');
const stockage = require('../services/stockage');
const otp = require('../services/otp');
const { cachet } = require('../services/cles');
const {
  creerContrat, controlerFichier, signerContrat, verifierDocument,
} = require('../services/contrats');
const {
  transition, etatOtp, renouvelable, aujourdhui,
} = require('../utils/regles');
const {
  introuvable, requete, interdit, conflit, ErreurMetier,
} = require('../utils/erreurs');

const PERSONNEL = ['admin', 'commercial', 'conformite'];
// Le sous-agent ne voit pas les contrats en cours de préparation interne
const VISIBLES_SOUS_AGENT = ['a_signer', 'signe', 'expire', 'resilie'];
const verifierEnvoi = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, f, ok) => ok(null, f.mimetype === 'application/pdf'),
});

const inclureDetail = [
  { model: SousAgent, as: 'sous_agent' },
  { model: ModeleContrat, as: 'modele', attributes: ['id', 'titre', 'version', 'duree_mois', 'actif'] },
  { model: Utilisateur, as: 'auteur', attributes: ['nom', 'prenoms'] },
  { model: Contrat, as: 'precedent', attributes: ['id', 'numero', 'date_fin', 'statut'] },
  { model: Validation, as: 'validations', include: [{ model: Utilisateur, as: 'valideur', attributes: ['nom', 'prenoms', 'role'] }] },
];

// Réponse sans les noms des fichiers stockés ni le scellement complet
function enClair(contrat) {
  const c = contrat.toJSON();
  delete c.fichier;
  delete c.fichier_signe;
  c.scelle = Boolean(c.scellement);
  delete c.scellement;
  return c;
}

const estPersonnel = (req) => PERSONNEL.includes(req.utilisateur.role);

async function charger(req, id = req.params.id) {
  const contrat = await Contrat.findByPk(id, { include: inclureDetail, order: [[{ model: Validation, as: 'validations' }, 'date', 'ASC']] });
  if (!contrat) throw introuvable('Contrat');
  const proprietaire = contrat.sous_agent?.utilisateur_id === req.utilisateur.id;
  if (!estPersonnel(req) && !(proprietaire && VISIBLES_SOUS_AGENT.includes(contrat.statut))) throw introuvable('Contrat');
  return { contrat, proprietaire };
}

const contratEnCours = (sousAgentId, saufId, transaction) => Contrat.findOne({
  where: { sous_agent_id: sousAgentId, statut: { [Op.in]: ['brouillon', 'validation_conformite', 'a_signer'] }, ...(saufId ? { id: { [Op.ne]: saufId } } : {}) },
  transaction,
});

// --- Liste ---
router.get('/', async (req, res) => {
  const where = {};
  if (estPersonnel(req)) {
    if (req.query.statut) where.statut = req.query.statut.split(',');
    if (req.query.sous_agent_id) where.sous_agent_id = req.query.sous_agent_id;
  } else {
    const dossier = await SousAgent.findOne({ where: { utilisateur_id: req.utilisateur.id } });
    if (!dossier) return res.json([]);
    where.sous_agent_id = dossier.id;
    where.statut = VISIBLES_SOUS_AGENT;
  }
  const inclure = [{ model: SousAgent, as: 'sous_agent', attributes: ['id', 'code', 'nom', 'prenoms', 'ville', 'telephone'] }];
  if (req.query.q && estPersonnel(req)) {
    const q = `%${String(req.query.q).trim()}%`;
    where[Op.or] = [{ numero: { [Op.like]: q } }, { '$sous_agent.nom$': { [Op.like]: q } }, { '$sous_agent.prenoms$': { [Op.like]: q } }, { '$sous_agent.code$': { [Op.like]: q } }];
  }
  const contrats = await Contrat.findAll({ where, include: inclure, order: [['createdAt', 'DESC']] });
  res.json(contrats.map(enClair));
});

// Certificat du cachet de la banque (affiché sur la page de vérification)
router.get('/certificat', (req, res) => res.json({ ...cachet().infos, pem: cachet().certificatPem }));

// --- Vérification d'un PDF présenté (RG5) ---
router.post('/verifier', verifierEnvoi.single('fichier'), async (req, res) => {
  if (!req.file) throw requete('Joindre le contrat au format PDF (10 Mo au plus)');
  const r = await verifierDocument(req.file.buffer);
  await journaliser(req, `Vérification d'un document : ${r.resultat}${r.contrat ? ` (${r.contrat.numero})` : ''}`);
  let contrat = null;
  if (r.contrat) {
    const sa = await SousAgent.findByPk(r.contrat.sous_agent_id);
    // Un sous-agent ne peut obtenir de détail que sur ses propres contrats
    if (estPersonnel(req) || sa?.utilisateur_id === req.utilisateur.id) {
      contrat = {
        numero: r.contrat.numero, statut: r.contrat.statut, date_debut: r.contrat.date_debut, date_fin: r.contrat.date_fin,
        date_signature: r.contrat.date_signature, signataire: sa ? `${sa.prenoms} ${sa.nom}` : null, code_sous_agent: sa?.code,
      };
    }
  }
  res.json({
    resultat: r.resultat, empreinte: r.empreinte, nom_fichier: req.file.originalname, contrat, certificat: r.resultat === 'authentique' ? cachet().infos : null,
  });
});

router.get('/:id', async (req, res) => {
  const { contrat } = await charger(req);
  const c = enClair(contrat);
  c.renouvelable = estPersonnel(req) && renouvelable(contrat);
  if (!estPersonnel(req)) delete c.validations;
  res.json(c);
});

// --- Génération (chargé commercial) : RG2 sous-agent admis, RG10 un seul contrat en cours ---
router.post('/', autoriser('admin', 'commercial'), async (req, res) => {
  const { sous_agent_id: sousAgentId, modele_id: modeleId } = req.body || {};
  const debut = req.body?.date_debut || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(debut)) throw requete('Date de début invalide');
  const sousAgent = await SousAgent.findByPk(sousAgentId);
  if (!sousAgent) throw introuvable('Sous-agent');
  if (sousAgent.statut !== 'admis') throw conflit('Un contrat ne peut être généré que pour une candidature admise');
  const modele = await ModeleContrat.findByPk(modeleId);
  if (!modele || !modele.actif) throw requete('Choisir un modèle de contrat actif');

  const contrat = await sequelize.transaction(async (transaction) => {
    if (await contratEnCours(sousAgent.id, null, transaction)) throw conflit('Un contrat est déjà en préparation pour ce sous-agent');
    return creerContrat({ sousAgent, modele, debut, auteurId: req.utilisateur.id, transaction });
  });
  await journaliser(req, `Génération du contrat ${contrat.numero} pour ${sousAgent.prenoms} ${sousAgent.nom}`);
  res.status(201).json(enClair((await charger(req, contrat.id)).contrat));
});

// --- Téléchargement du PDF (version signée si elle existe) ---
router.get('/:id/pdf', async (req, res) => {
  const { contrat } = await charger(req);
  const signee = contrat.fichier_signe && req.query.version !== 'generee';
  const contenu = stockage.lire('contrats', signee ? contrat.fichier_signe : contrat.fichier);
  await journaliser(req, `Consultation du contrat ${contrat.numero} (${signee ? 'version signée' : 'version générée'})`);
  res.type('application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${contrat.numero}${signee ? '-signe' : ''}.pdf"`);
  res.send(contenu);
});

// --- Circuit de validation (RG3) : commercial puis conformité ---
async function decider(req, res, action) {
  const { contrat } = await charger(req);
  const t = transition(action, contrat.statut, req.utilisateur.role);
  if (!t) throw interdit('Cette décision n\'est pas possible à cette étape ou pour votre profil');
  const commentaire = String(req.body?.commentaire || req.body?.motif || '').trim();
  if (action === 'rejeter' && !commentaire) throw requete('Le motif du rejet est obligatoire');
  if (action === 'valider' && !controlerFichier(contrat).integre) throw conflit('Le fichier du contrat a été modifié depuis sa génération : il doit être régénéré');

  await sequelize.transaction(async (transaction) => {
    await Validation.create({
      contrat_id: contrat.id, etape: t.etape, decision: action === 'valider' ? 'valide' : 'rejete', commentaire: commentaire || null, utilisateur_id: req.utilisateur.id,
    }, { transaction });
    await contrat.update({ statut: t.vers, motif: action === 'rejeter' ? commentaire : contrat.motif }, { transaction });
  });
  const etape = t.etape === 'commercial' ? 'commerciale' : 'de conformité';
  await journaliser(req, `${action === 'valider' ? 'Validation' : 'Rejet'} ${etape} du contrat ${contrat.numero}${commentaire ? ` : ${commentaire}` : ''}`);

  const sa = contrat.sous_agent;
  if (t.vers === 'a_signer') {
    await envoyerEmail({
      a: sa.email,
      sujet: `Votre contrat ${contrat.numero} est prêt à être signé`,
      html: `<p>Bonjour ${sa.prenoms},</p><p>Votre contrat de sous-agent est prêt. Connectez-vous à votre espace pour le lire et le signer électroniquement, sans vous déplacer.</p>`,
    });
  } else if (t.vers === 'validation_conformite') {
    const conformite = await Utilisateur.findAll({ where: { role: 'conformite', actif: true } });
    await envoyerEmail({ a: conformite.map((u) => u.email), sujet: `Contrat ${contrat.numero} à valider`, html: `<p>Le contrat ${contrat.numero} de ${sa.prenoms} ${sa.nom} attend la validation de la conformité.</p>` });
  } else if (t.vers === 'rejete' && contrat.auteur) {
    const auteur = await Utilisateur.findByPk(contrat.cree_par);
    await envoyerEmail({ a: auteur?.email, sujet: `Contrat ${contrat.numero} rejeté`, html: `<p>Le contrat ${contrat.numero} a été rejeté : ${commentaire}</p>` });
  }
  res.json(enClair((await charger(req)).contrat));
}

router.post('/:id/valider', autoriser('admin', 'commercial', 'conformite'), (req, res) => decider(req, res, 'valider'));
router.post('/:id/rejeter', autoriser('admin', 'commercial', 'conformite'), (req, res) => decider(req, res, 'rejeter'));

// --- Signature par le sous-agent (RG4) ---
async function contratASigner(req) {
  const { contrat, proprietaire } = await charger(req);
  if (!proprietaire) throw interdit('Seul le sous-agent titulaire peut signer ce contrat');
  if (contrat.statut !== 'a_signer') throw conflit('Ce contrat n\'est pas en attente de signature');
  return contrat;
}

// POST /:id/otp : envoie un code à usage unique (le précédent devient inutilisable)
router.post('/:id/otp', autoriser('sous_agent'), async (req, res) => {
  const contrat = await contratASigner(req);
  const recents = await CodeOtp.count({ where: { contrat_id: contrat.id, createdAt: { [Op.gte]: new Date(Date.now() - 15 * 60 * 1000) } } });
  if (recents >= 5) throw new ErreurMetier(429, 'Trop de codes demandés : patientez quelques minutes');

  const code = otp.genererCode();
  const destination = contrat.sous_agent.email;
  const expire = new Date(Date.now() + otp.DUREE_MINUTES() * 60 * 1000);
  await CodeOtp.update({ utilise: true }, { where: { contrat_id: contrat.id, utilise: false } });
  await CodeOtp.create({ contrat_id: contrat.id, code_hache: otp.hacherCode(code), canal: 'email', destination, expire_le: expire });
  await envoyerEmail({
    a: destination,
    sujet: `Code de signature du contrat ${contrat.numero}`,
    html: `<p>Votre code de signature est : <b style="font-size:20px">${code}</b></p><p>Il est valable ${otp.DUREE_MINUTES()} minutes et ne peut servir qu'une fois. Ne le communiquez à personne.</p>`,
  });
  await journaliser(req, `Envoi d'un code de signature pour le contrat ${contrat.numero}`);

  const reponse = { destination: otp.masquer(destination), canal: 'email', expire_le: expire, duree_minutes: otp.DUREE_MINUTES() };
  // Démonstration sans serveur de messagerie : le code est renvoyé à l'écran (jamais en production)
  if (process.env.OTP_AFFICHER_CODE === 'oui' && process.env.NODE_ENV !== 'production') reponse.code_demo = code;
  res.json(reponse);
});

// POST /:id/signer { code, signature (image PNG), accepte }
router.post('/:id/signer', autoriser('sous_agent'), async (req, res) => {
  const { code, signature, accepte } = req.body || {};
  if (accepte !== true) throw requete('Vous devez déclarer avoir lu et accepté le contrat');
  const correspondance = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(signature || ''));
  const image = correspondance ? Buffer.from(correspondance[1], 'base64') : null;
  if (!image || image.length < 200 || image.length > 1024 * 1024 || image.subarray(0, 4).toString('hex') !== '89504e47') {
    throw requete('Tracez votre signature dans le cadre prévu');
  }
  if (!/^\d{6}$/.test(String(code || '').trim())) throw requete('Le code reçu comporte 6 chiffres');

  const contrat = await contratASigner(req);
  const dernier = await CodeOtp.findOne({ where: { contrat_id: contrat.id }, order: [['createdAt', 'DESC'], ['id', 'DESC']] });
  const etat = etatOtp(dernier, Date.now(), otp.MAX_TENTATIVES());
  const messages = {
    absent: 'Demandez d\'abord un code de signature', utilise: 'Ce code a déjà servi : demandez un nouveau code', expire: 'Ce code a expiré : demandez un nouveau code', bloque: 'Trop d\'essais avec ce code : demandez un nouveau code',
  };
  if (etat !== 'valide') throw requete(messages[etat]);
  if (!otp.codeCorrect(code, dernier.code_hache)) {
    dernier.tentatives += 1;
    await dernier.save();
    const reste = otp.MAX_TENTATIVES() - dernier.tentatives;
    await journaliser(req, `Code de signature erroné pour le contrat ${contrat.numero}`);
    throw requete(reste > 0 ? `Code incorrect : il vous reste ${reste} essai(s)` : 'Code incorrect : demandez un nouveau code');
  }

  // Le code est consommé avant la signature : il ne pourra jamais resservir
  dernier.utilise = true;
  await dernier.save();
  const date = new Date();
  const ip = adresseIp(req);
  const signe = await signerContrat(contrat, {
    image, date, ip, canal: dernier.canal, destination: otp.masquer(dernier.destination),
  });

  await sequelize.transaction(async (transaction) => {
    await contrat.update({ ...signe, statut: 'signe', date_signature: date, ip_signature: ip }, { transaction });
    await contrat.sous_agent.update({ statut: 'actif' }, { transaction });
    // Renouvellement : les alertes de l'ancien contrat sont closes
    if (contrat.contrat_precedent_id) await Alerte.update({ lue: true }, { where: { contrat_id: contrat.contrat_precedent_id }, transaction });
  });
  await journaliser(req, `Signature électronique du contrat ${contrat.numero} (empreinte ${signe.empreinte_signee.slice(0, 16)}...)`);

  const sa = contrat.sous_agent;
  const auteur = await Utilisateur.findByPk(contrat.cree_par);
  await envoyerEmail({
    a: [sa.email, auteur?.email].filter(Boolean),
    sujet: `Contrat ${contrat.numero} signé`,
    html: `<p>Le contrat ${contrat.numero} de ${sa.prenoms} ${sa.nom} a été signé électroniquement le ${date.toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan' })}.</p><p>Empreinte SHA-256 : <code>${signe.empreinte_signee}</code></p>`,
  });
  res.json(enClair((await charger(req)).contrat));
});

// --- Contrôle d'intégrité du fichier conservé (personnel) ---
router.get('/:id/integrite', autoriser(...PERSONNEL), async (req, res) => {
  const { contrat } = await charger(req);
  const { contenu, ...resultat } = controlerFichier(contrat);
  await journaliser(req, `Contrôle d'intégrité du contrat ${contrat.numero} : ${resultat.integre && resultat.scellement_valide !== false ? 'intègre' : 'ALTÉRÉ'}`);
  res.json({ ...resultat, controle_le: new Date() });
});

// --- Renouvellement (RG7) : nouveau contrat à partir de la fin du précédent ---
router.post('/:id/renouveler', autoriser('admin', 'commercial'), async (req, res) => {
  const { contrat } = await charger(req);
  if (!renouvelable(contrat)) throw conflit('Ce contrat ne peut être renouvelé que dans les 60 jours qui précèdent sa fin, ou après son expiration');
  const modele = await ModeleContrat.findByPk(req.body?.modele_id || contrat.modele_id);
  if (!modele || !modele.actif) throw requete('Choisir un modèle de contrat actif');

  // Début : le lendemain de la fin de l'ancien contrat, ou aujourd'hui s'il est déjà expiré
  const lendemain = new Date(`${contrat.date_fin}T00:00:00Z`);
  lendemain.setUTCDate(lendemain.getUTCDate() + 1);
  const debut = new Date(Math.max(lendemain.getTime(), aujourdhui())).toISOString().slice(0, 10);

  const nouveau = await sequelize.transaction(async (transaction) => {
    if (await contratEnCours(contrat.sous_agent_id, null, transaction)) throw conflit('Un renouvellement est déjà en préparation');
    return creerContrat({
      sousAgent: contrat.sous_agent, modele, debut, auteurId: req.utilisateur.id, precedentId: contrat.id, transaction,
    });
  });
  await journaliser(req, `Renouvellement du contrat ${contrat.numero} : nouveau contrat ${nouveau.numero}`);
  res.status(201).json(enClair((await charger(req, nouveau.id)).contrat));
});

// --- Résiliation d'un contrat signé ---
router.post('/:id/resilier', autoriser('admin', 'commercial'), async (req, res) => {
  const motif = String(req.body?.motif || '').trim();
  if (!motif) throw requete('Le motif de la résiliation est obligatoire');
  const { contrat } = await charger(req);
  if (contrat.statut !== 'signe') throw conflit('Seul un contrat signé peut être résilié');
  await contrat.update({ statut: 'resilie', motif });
  const autres = await Contrat.count({ where: { sous_agent_id: contrat.sous_agent_id, statut: 'signe' } });
  if (!autres) await contrat.sous_agent.update({ statut: 'inactif' });
  await journaliser(req, `Résiliation du contrat ${contrat.numero} : ${motif}`);
  res.json(enClair((await charger(req)).contrat));
});

module.exports = router;
