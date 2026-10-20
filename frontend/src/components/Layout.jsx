import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLES } from '../libelles';
import BarreAccessibilite from './BarreAccessibilite';
import logoAfg from '../assets/logo-afg.png';

const PERSONNEL = ['admin', 'commercial', 'conformite'];

// Menu : chaque entrée n'est visible que pour les rôles indiqués
export const MENU = [
  { lien: '/', icone: 'speedometer2', texte: 'Tableau de bord', roles: PERSONNEL },
  { lien: '/a-valider', icone: 'list-check', texte: 'À traiter', roles: PERSONNEL },
  { lien: '/sous-agents', icone: 'people', texte: 'Sous-agents', roles: PERSONNEL },
  { lien: '/contrats', icone: 'file-earmark-text', texte: 'Contrats', roles: PERSONNEL },
  { lien: '/alertes', icone: 'bell', texte: 'Échéances', roles: PERSONNEL },
  { lien: '/mon-dossier', icone: 'person-vcard', texte: 'Mon dossier', roles: ['sous_agent'] },
  { lien: '/mes-contrats', icone: 'file-earmark-text', texte: 'Mes contrats', roles: ['sous_agent'] },
  { lien: '/verification', icone: 'shield-check', texte: 'Vérifier un contrat', roles: [...PERSONNEL, 'sous_agent'] },
  { lien: '/modeles', icone: 'file-earmark-ruled', texte: 'Modèles de contrat', roles: PERSONNEL },
  { lien: '/utilisateurs', icone: 'person-gear', texte: 'Utilisateurs', roles: ['admin'] },
  { lien: '/journal', icone: 'clock-history', texte: 'Journal d\'audit', roles: ['admin', 'conformite'] },
];

// Page d'accueil selon le rôle
export function accueil(role) {
  return role === 'sous_agent' ? '/mon-dossier' : '/';
}

export default function Layout() {
  const { utilisateur, deconnexion } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const naviguer = useNavigate();
  const entrees = MENU.filter((m) => m.roles.includes(utilisateur.role));

  function quitter() {
    deconnexion();
    naviguer('/connexion');
  }

  return (
    <div className="app">
      <a href="#contenu" className="lien-evitement">Aller au contenu principal</a>
      <aside className={`barre-laterale ${menuOuvert ? 'ouverte' : ''}`}>
        <div className="marque">
          <img src={logoAfg} alt="AFG Bank" className="logo-menu" />
          <div>
            <div className="fw-bold">Contrats des sous-agents</div>
            <div className="small">AFG Bank Côte d&apos;Ivoire</div>
          </div>
        </div>
        <nav className="nav flex-column" aria-label="Menu principal">
          {entrees.map((m) => (
            <NavLink key={m.lien} to={m.lien} end={m.lien === '/'} className="nav-link" onClick={() => setMenuOuvert(false)}>
              <i className={`bi bi-${m.icone} me-2`} aria-hidden="true" />{m.texte}
            </NavLink>
          ))}
        </nav>
        <BarreAccessibilite />
      </aside>
      {menuOuvert && <div className="voile" onClick={() => setMenuOuvert(false)} aria-hidden="true" />}

      <div className="principal">
        <header className="barre-haut">
          <button
            type="button"
            className="btn btn-outline-secondary d-lg-none"
            onClick={() => setMenuOuvert(true)}
            aria-label="Ouvrir le menu"
            title="Ouvrir le menu"
            aria-expanded={menuOuvert}
          >
            <i className="bi bi-list fs-5" aria-hidden="true" />
          </button>
          <div className="ms-auto d-flex align-items-center gap-3">
            <div className="text-end lh-sm">
              <div className="fw-semibold">{utilisateur.prenoms} {utilisateur.nom}</div>
              <div className="text-muted small">{ROLES[utilisateur.role]}</div>
            </div>
            <button type="button" className="btn btn-outline-secondary" onClick={quitter}>
              <i className="bi bi-box-arrow-right" aria-hidden="true" />Déconnexion
            </button>
          </div>
        </header>
        <main className="contenu" id="contenu" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
