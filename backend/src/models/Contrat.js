const { DataTypes } = require('sequelize');
const { STATUTS_CONTRAT } = require('../utils/constantes');

// Contrat d'un sous-agent : version générée, puis version signée et scellée
module.exports = (sequelize) => sequelize.define('contrat', {
  numero: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  statut: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'brouillon', validate: { isIn: [STATUTS_CONTRAT] } },
  date_debut: { type: DataTypes.DATEONLY, allowNull: false },
  date_fin: { type: DataTypes.DATEONLY, allowNull: false },
  duree_mois: { type: DataTypes.INTEGER, allowNull: false },
  // Version générée (avant signature)
  fichier: { type: DataTypes.STRING(255), allowNull: false },
  empreinte: { type: DataTypes.STRING(64), allowNull: false },
  // Version signée : empreinte SHA-256 et scellement RSA par la clé de la banque
  fichier_signe: { type: DataTypes.STRING(255) },
  empreinte_signee: { type: DataTypes.STRING(64), unique: true },
  scellement: { type: DataTypes.TEXT },
  date_signature: { type: DataTypes.DATE },
  ip_signature: { type: DataTypes.STRING(60) },
  motif: { type: DataTypes.STRING(255) }, // motif du rejet ou de la résiliation
});
