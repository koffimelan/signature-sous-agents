const { Journal } = require('../models');

// Adresse IP du client (derrière Nginx, voir « trust proxy » dans app.js)
const adresseIp = (req) => req?.ip?.replace(/^::ffff:/, '') || null;

// Trace une action dans le journal d'audit ; une erreur ici ne bloque jamais l'action principale
async function journaliser(req, action, { utilisateurId, transaction } = {}) {
  try {
    await Journal.create({
      utilisateur_id: utilisateurId ?? req?.utilisateur?.id ?? null,
      action: String(action).slice(0, 255),
      adresse_ip: adresseIp(req),
    }, { transaction });
  } catch (err) {
    console.error('Journal non enregistré :', err.message);
  }
}

module.exports = { journaliser, adresseIp };
