const router = require('express').Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { sequelize, Utilisateur, SousAgent } = require('../models');
const { verifierJeton } = require('../middlewares/auth');
const { journaliser } = require('../services/journal');
const { requete, conflit } = require('../utils/erreurs');

// Limite les tentatives pour freiner les attaques par force brute et les inscriptions en masse
const limite = (nombre) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: nombre,
  message: { message: 'Trop de tentatives, réessayez dans quelques minutes' },
  skip: () => process.env.NODE_ENV === 'test',
});

const creerJeton = (u) => jwt.sign(
  { id: u.id, role: u.role, nom: `${u.prenoms} ${u.nom}` },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_DUREE || '8h' },
);

// POST /api/auth/login
router.post('/login', limite(20), async (req, res) => {
  const { email, mot_de_passe: motDePasse } = req.body || {};
  if (!email || !motDePasse) throw requete('E-mail et mot de passe obligatoires');

  const utilisateur = await Utilisateur.scope('avecMotDePasse').findOne({ where: { email: String(email).trim().toLowerCase() } });
  // Même message dans les deux cas pour ne pas révéler si le compte existe
  if (!utilisateur || !(await utilisateur.verifierMotDePasse(motDePasse))) {
    return res.status(401).json({ message: 'E-mail ou mot de passe incorrect' });
  }
  if (!utilisateur.actif) return res.status(403).json({ message: 'Compte désactivé, contactez l\'administrateur' });

  await journaliser(req, 'Connexion', { utilisateurId: utilisateur.id });
  res.json({ jeton: creerJeton(utilisateur), utilisateur: utilisateur.toJSON() });
});

// POST /api/auth/inscription : un candidat crée son compte et ouvre son dossier de sous-agent
router.post('/inscription', limite(10), async (req, res) => {
  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase();
  if (!b.nom || !b.prenoms || !email || !b.telephone) throw requete('Nom, prénoms, e-mail et téléphone sont obligatoires');
  if (!b.mot_de_passe || b.mot_de_passe.length < 8) throw requete('Le mot de passe doit contenir au moins 8 caractères');
  if (await Utilisateur.count({ where: { email } })) throw conflit('Un compte existe déjà avec cette adresse e-mail');

  const utilisateur = await sequelize.transaction(async (transaction) => {
    const u = await Utilisateur.create({
      nom: String(b.nom).trim().toUpperCase(), prenoms: String(b.prenoms).trim(), email, telephone: b.telephone, mot_de_passe: b.mot_de_passe, role: 'sous_agent',
    }, { transaction });
    await SousAgent.create({
      utilisateur_id: u.id, nom: u.nom, prenoms: u.prenoms, email, telephone: b.telephone, statut: 'brouillon',
    }, { transaction });
    return u;
  });
  await journaliser(req, `Ouverture du dossier de candidature de ${utilisateur.prenoms} ${utilisateur.nom}`, { utilisateurId: utilisateur.id });
  res.status(201).json({ jeton: creerJeton(utilisateur), utilisateur: utilisateur.toJSON() });
});

// GET /api/auth/moi : profil de l'utilisateur connecté
router.get('/moi', verifierJeton, async (req, res) => {
  const utilisateur = await Utilisateur.findByPk(req.utilisateur.id);
  if (!utilisateur || !utilisateur.actif) return res.status(401).json({ message: 'Compte indisponible' });
  res.json(utilisateur);
});

// PUT /api/auth/mot-de-passe : changement de son propre mot de passe
router.put('/mot-de-passe', verifierJeton, async (req, res) => {
  const { ancien, nouveau } = req.body || {};
  if (!nouveau || nouveau.length < 8) throw requete('Le nouveau mot de passe doit contenir au moins 8 caractères');

  const utilisateur = await Utilisateur.scope('avecMotDePasse').findByPk(req.utilisateur.id);
  if (!(await utilisateur.verifierMotDePasse(ancien || ''))) throw requete('Ancien mot de passe incorrect');

  utilisateur.mot_de_passe = nouveau;
  await utilisateur.save();
  await journaliser(req, 'Changement de mot de passe');
  res.json({ message: 'Mot de passe modifié' });
});

module.exports = router;
