const { DataTypes } = require('sequelize');
const { ETAPES_VALIDATION } = require('../utils/constantes');

// Décision prise à une étape du circuit (commercial, puis conformité)
module.exports = (sequelize) => sequelize.define('validation', {
  etape: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [ETAPES_VALIDATION] } },
  decision: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [['valide', 'rejete']] } },
  commentaire: { type: DataTypes.STRING(255) },
  date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { timestamps: false });
