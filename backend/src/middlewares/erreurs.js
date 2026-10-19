const { ErreurMetier } = require('../utils/erreurs');

// Dernier middleware : transforme toute erreur en réponse JSON lisible
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (err instanceof ErreurMetier) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ message: 'Données invalides', details: err.errors.map((e) => e.message) });
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ message: 'Cette valeur existe déjà', details: err.errors.map((e) => e.path) });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: `Fichier refusé : ${err.message}` });
  }

  console.error(err);
  res.status(500).json({ message: 'Erreur interne du serveur' });
};
