const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Fichiers conservés sur le serveur : pièces justificatives et contrats PDF.
// Ils ne sont jamais servis directement : l'API vérifie les droits avant chaque téléchargement.
function dossier(sousDossier) {
  const racine = path.resolve(__dirname, '../..', process.env.STOCKAGE_DIR || 'stockage');
  const d = path.join(racine, sousDossier);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// Empreinte SHA-256 d'un contenu, en hexadécimal (64 caractères)
const empreinte = (contenu) => crypto.createHash('sha256').update(contenu).digest('hex');

// Enregistre un contenu sous un nom aléatoire (le nom d'origine n'est jamais réutilisé)
function enregistrer(sousDossier, contenu, extension) {
  const nom = `${crypto.randomUUID()}${extension}`;
  fs.writeFileSync(path.join(dossier(sousDossier), nom), contenu);
  return nom;
}

function lire(sousDossier, nom) {
  // basename : empêche toute remontée dans l'arborescence (../)
  return fs.readFileSync(path.join(dossier(sousDossier), path.basename(nom)));
}

function supprimer(sousDossier, nom) {
  fs.rmSync(path.join(dossier(sousDossier), path.basename(nom)), { force: true });
}

module.exports = { empreinte, enregistrer, lire, supprimer };
