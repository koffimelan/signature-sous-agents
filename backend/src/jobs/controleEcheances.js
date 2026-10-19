const cron = require('node-cron');
const { controlerEcheances } = require('../services/alertes');

// Tâche planifiée : chaque jour (7h par défaut, heure d'Abidjan) le système contrôle les échéances
function demarrerControleEcheances() {
  const expression = process.env.CRON_ALERTES || '0 7 * * *';
  if (!cron.validate(expression)) {
    console.error(`Expression CRON_ALERTES invalide : ${expression}`);
    return;
  }

  cron.schedule(expression, async () => {
    try {
      const r = await controlerEcheances();
      console.log(`Contrôle des échéances : ${r.alertes} nouvelle(s) alerte(s), ${r.expires} contrat(s) expiré(s)`);
    } catch (err) {
      console.error('Contrôle des échéances en échec :', err.message);
    }
  }, { timezone: 'Africa/Abidjan' });

  console.log(`Contrôle des échéances planifié (${expression})`);
}

module.exports = { demarrerControleEcheances };
