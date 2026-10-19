const router = require('express').Router();
const { Utilisateur } = require('../models');
const { autoriser } = require('../middlewares/auth');
const { journaliser } = require('../services/journal');
const { introuvable, requete } = require('../utils/erreurs');

const CHAMPS = ['nom', 'prenoms', 'email', 'telephone', 'role', 'actif'];

function extraire(corps) {
  const donnees = {};
  for (const champ of CHAMPS) if (corps[champ] !== undefined) donnees[champ] = corps[champ];
  if (donnees.email) donnees.email = String(donnees.email).trim().toLowerCase();
  return donnees;
}

router.use(autoriser('admin'));

router.get('/', async (req, res) => {
  const where = req.query.role ? { role: req.query.role } : {};
  res.json(await Utilisateur.findAll({ where, order: [['role', 'ASC'], ['nom', 'ASC']] }));
});

router.post('/', async (req, res) => {
  const donnees = extraire(req.body);
  if (!req.body.mot_de_passe || req.body.mot_de_passe.length < 8) {
    throw requete('Le mot de passe doit contenir au moins 8 caractères');
  }
  const utilisateur = await Utilisateur.create({ ...donnees, mot_de_passe: req.body.mot_de_passe });
  await journaliser(req, `Création du compte ${utilisateur.email} (${utilisateur.role})`);
  res.status(201).json(utilisateur);
});

router.put('/:id', async (req, res) => {
  const utilisateur = await Utilisateur.findByPk(req.params.id);
  if (!utilisateur) throw introuvable('Utilisateur');

  utilisateur.set(extraire(req.body));
  // Réinitialisation du mot de passe par l'administrateur (facultative)
  if (req.body.mot_de_passe) {
    if (req.body.mot_de_passe.length < 8) throw requete('Le mot de passe doit contenir au moins 8 caractères');
    utilisateur.mot_de_passe = req.body.mot_de_passe;
  }
  if (utilisateur.id === req.utilisateur.id && (utilisateur.actif === false || utilisateur.role !== 'admin')) {
    throw requete('Vous ne pouvez ni désactiver votre propre compte ni retirer votre rôle d\'administrateur');
  }
  await utilisateur.save();
  await journaliser(req, `Modification du compte ${utilisateur.email}`);
  res.json(utilisateur);
});

module.exports = router;
