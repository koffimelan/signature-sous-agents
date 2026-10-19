const router = require('express').Router();
const { ModeleContrat } = require('../models');
const { autoriser } = require('../middlewares/auth');
const { journaliser } = require('../services/journal');
const { introuvable, requete } = require('../utils/erreurs');

// Champs disponibles dans le texte d'un modèle, remplacés à la génération du contrat
const CHAMPS_MODELE = {
  numero_contrat: 'Numéro du contrat',
  code_sous_agent: 'Code du sous-agent',
  civilite: 'Civilité',
  nom: 'Nom',
  prenoms: 'Prénoms',
  date_naissance: 'Date de naissance',
  lieu_naissance: 'Lieu de naissance',
  nationalite: 'Nationalité',
  type_piece: 'Type de pièce d\'identité',
  numero_piece: 'Numéro de la pièce d\'identité',
  adresse: 'Adresse',
  ville: 'Ville',
  commune: 'Commune',
  telephone: 'Téléphone',
  email: 'E-mail',
  zone: 'Zone de prospection',
  date_debut: 'Date de début',
  date_fin: 'Date de fin',
  duree_mois: 'Durée en mois',
  taux_commission: 'Commission',
  date_du_jour: 'Date de génération',
};

const CHAMPS = ['titre', 'version', 'duree_mois', 'taux_commission', 'contenu', 'actif'];
const extraire = (corps) => Object.fromEntries(CHAMPS.filter((c) => corps[c] !== undefined).map((c) => [c, corps[c]]));

router.use(autoriser('admin', 'commercial', 'conformite'));

router.get('/', async (req, res) => {
  const where = req.query.actifs ? { actif: true } : {};
  res.json(await ModeleContrat.findAll({ where, order: [['actif', 'DESC'], ['titre', 'ASC']] }));
});

router.get('/champs', (req, res) => res.json(CHAMPS_MODELE));

router.get('/:id', async (req, res) => {
  const modele = await ModeleContrat.findByPk(req.params.id);
  if (!modele) throw introuvable('Modèle');
  res.json(modele);
});

router.post('/', autoriser('admin', 'commercial'), async (req, res) => {
  const donnees = extraire(req.body);
  if (!donnees.titre || !donnees.contenu) throw requete('Le titre et le texte du modèle sont obligatoires');
  const modele = await ModeleContrat.create(donnees);
  await journaliser(req, `Création du modèle de contrat « ${modele.titre} » v${modele.version}`);
  res.status(201).json(modele);
});

router.put('/:id', autoriser('admin', 'commercial'), async (req, res) => {
  const modele = await ModeleContrat.findByPk(req.params.id);
  if (!modele) throw introuvable('Modèle');
  await modele.update(extraire(req.body));
  await journaliser(req, `Modification du modèle de contrat « ${modele.titre} » v${modele.version}`);
  res.json(modele);
});

module.exports = router;
module.exports.CHAMPS_MODELE = CHAMPS_MODELE;
