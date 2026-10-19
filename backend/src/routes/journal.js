const router = require('express').Router();
const { Journal, Utilisateur } = require('../models');
const { autoriser } = require('../middlewares/auth');

// GET /api/journal?limite=500 : dernières actions (contrôle de la conformité)
router.get('/', autoriser('admin', 'conformite'), async (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 500, 2000);
  res.json(await Journal.findAll({
    include: [{ model: Utilisateur, attributes: ['nom', 'prenoms', 'role'] }],
    order: [['date', 'DESC'], ['id', 'DESC']],
    limit: limite,
  }));
});

module.exports = router;
