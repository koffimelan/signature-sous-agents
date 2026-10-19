// Erreur « métier » : une règle de gestion n'est pas respectée.
// Le gestionnaire d'erreurs la renvoie au client avec son code HTTP et son message.
class ErreurMetier extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const requete = (message, details) => new ErreurMetier(400, message, details);
const introuvable = (quoi = 'Élément') => new ErreurMetier(404, `${quoi} introuvable`);
const conflit = (message, details) => new ErreurMetier(409, message, details);
const interdit = (message = 'Action non autorisée pour votre profil') => new ErreurMetier(403, message);

module.exports = { ErreurMetier, requete, introuvable, conflit, interdit };
