import axios from 'axios';

// Toutes les requêtes passent par cette instance : le jeton est ajouté automatiquement
const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const jeton = localStorage.getItem('jeton');
  if (jeton) config.headers.Authorization = `Bearer ${jeton}`;
  return config;
});

// Session expirée : retour à l'écran de connexion
api.interceptors.response.use(
  (reponse) => reponse,
  (erreur) => {
    if (erreur.response?.status === 401 && !erreur.config.url.startsWith('/auth/login')) {
      localStorage.removeItem('jeton');
      window.location.assign('/connexion');
    }
    return Promise.reject(erreur);
  },
);

export function messageErreur(erreur) {
  return erreur?.response?.data?.message || 'Impossible de joindre le serveur';
}

// Ouvre un PDF dans un nouvel onglet ou télécharge un fichier (Excel)
export async function ouvrirFichier(url, nomFichier) {
  // L'onglet est ouvert tout de suite (pendant le clic) pour ne pas être bloqué par le navigateur
  const onglet = nomFichier ? null : window.open('', '_blank');
  try {
    const reponse = await api.get(url, { responseType: 'blob' });
    const lien = URL.createObjectURL(reponse.data);
    if (nomFichier) {
      const a = document.createElement('a');
      a.href = lien;
      a.download = nomFichier;
      a.click();
    } else if (onglet) {
      onglet.location.href = lien;
    } else {
      window.location.assign(lien);
    }
    setTimeout(() => URL.revokeObjectURL(lien), 60000);
  } catch (erreur) {
    onglet?.close();
    // Le message d'erreur arrive sous forme de blob : on le relit en texte
    const texte = await erreur.response?.data?.text?.();
    let message = 'Fichier indisponible';
    try { message = JSON.parse(texte).message || message; } catch { /* réponse non JSON */ }
    throw new Error(message);
  }
}

export default api;
