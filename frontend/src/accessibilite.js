// Préférences d'affichage (taille du texte, contraste élevé), conservées dans le navigateur

// Clé renouvelée : les anciens réglages (base 18 px) ne sont pas repris
const CLE = 'preferences-accessibilite-v2';

export const TAILLES = [
  { niveau: 1, pourcentage: 100 }, // réglage par défaut : tailles du site AFG Bank
  { niveau: 2, pourcentage: 112.5 },
  { niveau: 3, pourcentage: 125 },
  { niveau: 4, pourcentage: 150 },
];
export const TAILLE_DEFAUT = 1;

const DEFAUT = { taille: TAILLE_DEFAUT, contraste: false };

export function lirePreferences() {
  try {
    const p = JSON.parse(localStorage.getItem(CLE) || '{}');
    const taille = TAILLES.some((t) => t.niveau === p.taille) ? p.taille : DEFAUT.taille;
    return { taille, contraste: p.contraste === true };
  } catch {
    return { ...DEFAUT };
  }
}

export function enregistrerPreferences(preferences) {
  try {
    localStorage.setItem(CLE, JSON.stringify(preferences));
  } catch {
    // Stockage indisponible (navigation privée...) : le réglage reste valable pour la session
  }
}

// Applique les préférences à la racine du document (lues par styles.css)
export function appliquerPreferences({ taille, contraste }) {
  const racine = document.documentElement;
  racine.dataset.taille = String(taille);
  racine.classList.toggle('contraste-eleve', contraste);
}
