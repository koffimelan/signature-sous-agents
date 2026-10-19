const { DataTypes } = require('sequelize');
const { STATUTS_SOUS_AGENT, TYPES_IDENTITE } = require('../utils/constantes');

// Dossier d'un candidat sous-agent, puis d'un sous-agent en activité
module.exports = (sequelize) => sequelize.define('sous_agent', {
  code: { type: DataTypes.STRING(20), unique: true },
  civilite: { type: DataTypes.STRING(10) },
  nom: { type: DataTypes.STRING(80), allowNull: false },
  prenoms: { type: DataTypes.STRING(120), allowNull: false },
  date_naissance: { type: DataTypes.DATEONLY },
  lieu_naissance: { type: DataTypes.STRING(80) },
  nationalite: { type: DataTypes.STRING(50), defaultValue: 'Ivoirienne' },
  type_piece: { type: DataTypes.STRING(20), defaultValue: 'cni', validate: { isIn: [TYPES_IDENTITE] } },
  // RG10 : un même numéro de pièce d'identité ne peut servir qu'à un seul dossier
  numero_piece: { type: DataTypes.STRING(40), unique: true },
  telephone: { type: DataTypes.STRING(30), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false, validate: { isEmail: true } },
  adresse: { type: DataTypes.STRING(200) },
  ville: { type: DataTypes.STRING(80) },
  commune: { type: DataTypes.STRING(80) },
  activite: { type: DataTypes.STRING(150) }, // activité exercée actuellement (commerce, cabine...)
  zone: { type: DataTypes.STRING(150) }, // zone de prospection prévue
  statut: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'brouillon', validate: { isIn: [STATUTS_SOUS_AGENT] } },
  motif_rejet: { type: DataTypes.STRING(255) },
  date_soumission: { type: DataTypes.DATE },
  date_decision: { type: DataTypes.DATE },
});
