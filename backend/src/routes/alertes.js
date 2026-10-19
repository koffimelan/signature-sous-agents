const router = require('express').Router();
const { Alerte, Contrat, SousAgent } = require('../models');
const { autoriser } = require('../middlewares/auth');
const { controlerEcheances } = require('../services/alertes');
const { journaliser } = require('../services/journal');
const { introuvable } = require('../utils/erreurs');

router.use(autoriser('admin', 'commercial', 'conformite'));

router.get('/', async (req, res) => {
  const where = {};
  if (req.query.lue !== undefined) where.lue = req.query.lue === 'true';
  res.json(await Alerte.findAll({
    where,
    include: [{
      model: Contrat, as: 'contrat', attributes: ['id', 'numero', 'statut', 'date_fin'], include: [{ model: SousAgent, as: 'sous_agent', attributes: ['id', 'code', 'nom', 'prenoms', 'telephone'] }],
    }],
    order: [['lue', 'ASC'], ['createdAt', 'DESC']],
  }));
});

router.put('/:id/lue', async (req, res) => {
  const alerte = await Alerte.findByPk(req.params.id);
  if (!alerte) throw introuvable('Alerte');
  await alerte.update({ lue: true });
  res.json(alerte);
});

// Lancement manuel du contrôle quotidien (utile pour la démonstration)
router.post('/controler', autoriser('admin', 'commercial'), async (req, res) => {
  const resultat = await controlerEcheances();
  await journaliser(req, `Contrôle manuel des échéances : ${resultat.alertes} alerte(s), ${resultat.expires} contrat(s) expiré(s)`);
  res.json(resultat);
});

module.exports = router;
