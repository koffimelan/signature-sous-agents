const { DataTypes } = require('sequelize');

// Code à usage unique envoyé au sous-agent pour signer ; seul son hachage est conservé
module.exports = (sequelize) => sequelize.define('code_otp', {
  code_hache: { type: DataTypes.STRING(64), allowNull: false },
  canal: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'email' },
  destination: { type: DataTypes.STRING(150), allowNull: false },
  expire_le: { type: DataTypes.DATE, allowNull: false },
  tentatives: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  utilise: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});
