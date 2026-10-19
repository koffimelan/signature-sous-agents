import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Layout, { MENU, accueil } from './components/Layout';
import { Chargement } from './components/Communs';
import Connexion from './pages/Connexion';
import Inscription from './pages/Inscription';
import TableauDeBord from './pages/TableauDeBord';
import ATraiter from './pages/ATraiter';
import SousAgents from './pages/SousAgents';
import FicheSousAgent from './pages/FicheSousAgent';
import Contrats from './pages/Contrats';
import FicheContrat from './pages/FicheContrat';
import Alertes from './pages/Alertes';
import MonDossier from './pages/MonDossier';
import MesContrats from './pages/MesContrats';
import SignerContrat from './pages/SignerContrat';
import Verification from './pages/Verification';
import Modeles from './pages/Modeles';
import Utilisateurs from './pages/Utilisateurs';
import Journal from './pages/Journal';

const PAGES = {
  '/': TableauDeBord,
  '/a-valider': ATraiter,
  '/sous-agents': SousAgents,
  '/contrats': Contrats,
  '/alertes': Alertes,
  '/mon-dossier': MonDossier,
  '/mes-contrats': MesContrats,
  '/verification': Verification,
  '/modeles': Modeles,
  '/utilisateurs': Utilisateurs,
  '/journal': Journal,
};
const PERSONNEL = ['admin', 'commercial', 'conformite'];

// Protège une page : connexion obligatoire et rôle autorisé
function Protegee({ roles, children }) {
  const { utilisateur, chargement } = useAuth();
  const location = useLocation();
  if (chargement) return <Chargement />;
  if (!utilisateur) return <Navigate to="/connexion" replace state={{ depuis: location.pathname }} />;
  if (roles && !roles.includes(utilisateur.role)) return <Navigate to={accueil(utilisateur.role)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route path="/candidature" element={<Inscription />} />
      <Route element={<Protegee><Layout /></Protegee>}>
        {MENU.map(({ lien, roles }) => {
          const Page = PAGES[lien];
          return <Route key={lien} path={lien} element={<Protegee roles={roles}><Page /></Protegee>} />;
        })}
        <Route path="/sous-agents/:id" element={<Protegee roles={PERSONNEL}><FicheSousAgent /></Protegee>} />
        <Route path="/contrats/:id" element={<Protegee roles={PERSONNEL}><FicheContrat /></Protegee>} />
        <Route path="/mes-contrats/:id/signer" element={<Protegee roles={['sous_agent']}><SignerContrat /></Protegee>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
