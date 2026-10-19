const { DataTypes } = require('sequelize');
const { TYPES_PIECE } = require('../utils/constantes');

// Pièce du dossier KYC (copie de la pièce d'identité, photo, justificatif de domicile...)
module.exports = (sequelize) => sequelize.define('piece_justificative', {
  type: { type: DataTypes.STRING(30), allowNull: false, validate: { isIn: [TYPES_PIECE] } },
  nom_origine: { type: DataTypes.STRING(200), allowNull: false },
  fichier: { type: DataTypes.STRING(255), allowNull: false }, // nom du fichier stocké sur le serveur
  type_mime: { type: DataTypes.STRING(80), allowNull: false },
  taille: { type: DataTypes.INTEGER, allowNull: false },
  empreinte: { type: DataTypes.STRING(64), allowNull: false }, // SHA-256 du fichier reçu
});
