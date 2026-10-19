require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });

const app = require('./app');
const { sequelize } = require('./models');
const { cachet } = require('./services/cles');
const { demarrerControleEcheances } = require('./jobs/controleEcheances');

const PORT = Number(process.env.PORT) || 4100;

async function demarrer() {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET manquant : copiez .env.example en .env et renseignez-le.');
    process.exit(1);
  }
  await sequelize.authenticate();
  // Crée les tables manquantes (en production, on passerait plutôt par des migrations)
  await sequelize.sync();
  console.log(`Base de données connectée (${sequelize.getDialect()})`);

  // Le cachet électronique de la banque est créé au premier démarrage s'il n'existe pas
  console.log(`Cachet électronique chargé (certificat n° ${cachet().infos.numero_serie})`);
  demarrerControleEcheances();

  app.listen(PORT, () => console.log(`Plateforme des contrats des sous-agents : http://localhost:${PORT}`));
}

demarrer().catch((err) => {
  console.error('Démarrage impossible :', err.message);
  process.exit(1);
});
