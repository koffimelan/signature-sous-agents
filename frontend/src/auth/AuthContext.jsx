import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [chargement, setChargement] = useState(true);

  // Au démarrage, on vérifie si un jeton valide est déjà enregistré
  useEffect(() => {
    if (!localStorage.getItem('jeton')) {
      setChargement(false);
      return;
    }
    api.get('/auth/moi')
      .then((r) => setUtilisateur(r.data))
      .catch(() => localStorage.removeItem('jeton'))
      .finally(() => setChargement(false));
  }, []);

  async function connexion(email, motDePasse) {
    const { data } = await api.post('/auth/login', { email, mot_de_passe: motDePasse });
    localStorage.setItem('jeton', data.jeton);
    setUtilisateur(data.utilisateur);
    return data.utilisateur;
  }

  // Dépôt d'une candidature : le compte est créé et la session ouverte aussitôt
  async function inscription(donnees) {
    const { data } = await api.post('/auth/inscription', donnees);
    localStorage.setItem('jeton', data.jeton);
    setUtilisateur(data.utilisateur);
    return data.utilisateur;
  }

  function deconnexion() {
    localStorage.removeItem('jeton');
    setUtilisateur(null);
  }

  const aLeRole = (...roles) => !!utilisateur && roles.includes(utilisateur.role);

  return (
    <AuthContext.Provider value={{
      utilisateur, chargement, connexion, inscription, deconnexion, aLeRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
