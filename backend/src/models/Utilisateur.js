const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../utils/constantes');

// Personne qui se connecte : agent de la banque ou sous-agent
module.exports = (sequelize) => {
  const Utilisateur = sequelize.define('utilisateur', {
    nom: { type: DataTypes.STRING(80), allowNull: false },
    prenoms: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true, validate: { isEmail: true } },
    telephone: { type: DataTypes.STRING(30) },
    mot_de_passe: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING(30), allowNull: false, validate: { isIn: [ROLES] } },
    actif: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    // Le mot de passe n'est jamais renvoyé par défaut dans les requêtes
    defaultScope: { attributes: { exclude: ['mot_de_passe'] } },
    scopes: { avecMotDePasse: { attributes: { include: ['mot_de_passe'] } } },
  });

  // Le mot de passe est haché avec bcrypt avant chaque enregistrement
  const hacher = async (u) => {
    if (u.changed('mot_de_passe')) u.mot_de_passe = await bcrypt.hash(u.mot_de_passe, 10);
  };
  Utilisateur.beforeCreate(hacher);
  Utilisateur.beforeUpdate(hacher);

  Utilisateur.prototype.verifierMotDePasse = function (motDePasse) {
    return bcrypt.compare(motDePasse, this.mot_de_passe);
  };

  Utilisateur.prototype.toJSON = function () {
    const valeurs = { ...this.get() };
    delete valeurs.mot_de_passe;
    return valeurs;
  };

  return Utilisateur;
};
