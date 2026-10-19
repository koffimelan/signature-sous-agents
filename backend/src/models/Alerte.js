const { DataTypes } = require('sequelize');
const { NIVEAUX_ALERTE } = require('../utils/constantes');

// Alerte d'échéance d'un contrat signé (une seule par contrat et par niveau)
module.exports = (sequelize) => sequelize.define('alerte', {
  niveau: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [NIVEAUX_ALERTE] } },
  message: { type: DataTypes.STRING(255), allowNull: false },
  lue: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { indexes: [{ unique: true, fields: ['contrat_id', 'niveau'] }] });
