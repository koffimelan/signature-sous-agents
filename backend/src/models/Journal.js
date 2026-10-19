const { DataTypes } = require('sequelize');

// Journal d'audit : qui a fait quoi, quand et depuis quelle adresse
module.exports = (sequelize) => sequelize.define('journal', {
  action: { type: DataTypes.STRING(255), allowNull: false },
  adresse_ip: { type: DataTypes.STRING(60) },
  date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { timestamps: false });
