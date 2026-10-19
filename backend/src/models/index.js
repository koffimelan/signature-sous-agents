const sequelize = require('../config/database');

const Utilisateur = require('./Utilisateur')(sequelize);
const SousAgent = require('./SousAgent')(sequelize);
const PieceJustificative = require('./PieceJustificative')(sequelize);
const ModeleContrat = require('./ModeleContrat')(sequelize);
const Contrat = require('./Contrat')(sequelize);
const Validation = require('./Validation')(sequelize);
const CodeOtp = require('./CodeOtp')(sequelize);
const Alerte = require('./Alerte')(sequelize);
const Journal = require('./Journal')(sequelize);

// Relations (diagramme de classes du dossier de conception)
Utilisateur.hasOne(SousAgent, { foreignKey: 'utilisateur_id', as: 'dossier' });
SousAgent.belongsTo(Utilisateur, { foreignKey: 'utilisateur_id', as: 'compte' });
SousAgent.belongsTo(Utilisateur, { foreignKey: 'decide_par', as: 'decideur' });

SousAgent.hasMany(PieceJustificative, { foreignKey: 'sous_agent_id', as: 'pieces', onDelete: 'CASCADE' });
PieceJustificative.belongsTo(SousAgent, { foreignKey: 'sous_agent_id' });

SousAgent.hasMany(Contrat, { foreignKey: 'sous_agent_id', as: 'contrats' });
Contrat.belongsTo(SousAgent, { foreignKey: 'sous_agent_id', as: 'sous_agent' });
Contrat.belongsTo(ModeleContrat, { foreignKey: 'modele_id', as: 'modele' });
Contrat.belongsTo(Utilisateur, { foreignKey: 'cree_par', as: 'auteur' });
Contrat.belongsTo(Contrat, { foreignKey: 'contrat_precedent_id', as: 'precedent' });

Contrat.hasMany(Validation, { foreignKey: 'contrat_id', as: 'validations', onDelete: 'CASCADE' });
Validation.belongsTo(Contrat, { foreignKey: 'contrat_id' });
Validation.belongsTo(Utilisateur, { foreignKey: 'utilisateur_id', as: 'valideur' });

Contrat.hasMany(CodeOtp, { foreignKey: 'contrat_id', as: 'codes', onDelete: 'CASCADE' });
CodeOtp.belongsTo(Contrat, { foreignKey: 'contrat_id' });

Contrat.hasMany(Alerte, { foreignKey: 'contrat_id', as: 'alertes', onDelete: 'CASCADE' });
Alerte.belongsTo(Contrat, { foreignKey: 'contrat_id', as: 'contrat' });

Journal.belongsTo(Utilisateur, { foreignKey: 'utilisateur_id' });

module.exports = {
  sequelize, Utilisateur, SousAgent, PieceJustificative, ModeleContrat, Contrat, Validation, CodeOtp, Alerte, Journal,
};
