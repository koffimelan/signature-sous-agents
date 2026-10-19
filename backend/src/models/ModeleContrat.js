const { DataTypes } = require('sequelize');

// Modèle de contrat : texte des articles avec des champs à remplir ({{nom}}, {{date_debut}}...)
module.exports = (sequelize) => sequelize.define('modele_contrat', {
  titre: { type: DataTypes.STRING(150), allowNull: false },
  version: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '1.0' },
  duree_mois: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 12, validate: { min: 1, max: 60 } },
  taux_commission: { type: DataTypes.STRING(150) },
  contenu: { type: DataTypes.TEXT, allowNull: false },
  actif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
});
