const path = require('path');
const { Sequelize } = require('sequelize');

// Options communes : noms de colonnes en snake_case (date_debut, site_id...)
const options = {
  logging: false,
  define: { underscored: true, freezeTableName: true },
};

let sequelize;

if (process.env.DB_DIALECT === 'postgres') {
  sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    ...options,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
  });
} else {
  // SQLite pour le développement et les tests : aucune installation de serveur
  const stockage = process.env.DB_STORAGE || 'data/contrats.sqlite';
  sequelize = new Sequelize({
    ...options,
    dialect: 'sqlite',
    storage: stockage === ':memory:' ? stockage : path.resolve(__dirname, '../..', stockage),
  });
}

module.exports = sequelize;
