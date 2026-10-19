import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { accueil } from '../components/Layout';
import { messageErreur } from '../api';
import BarreAccessibilite from '../components/BarreAccessibilite';

export function Logo() {
  return (
    <span className="logo-afg" style={{ width: '4rem', height: '4rem', fontSize: '1.4rem', border: '2px solid var(--bleu-nuit)' }} aria-hidden="true">
      <span className="a">A</span><span className="fg">FG</span>
    </span>
  );
}

export default function Connexion() {
  const { utilisateur, connexion } = useAuth();
  const naviguer = useNavigate();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  if (utilisateur) return <Navigate to={accueil(utilisateur.role)} replace />;

  async function valider(e) {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const u = await connexion(email, motDePasse);
      naviguer(accueil(u.role), { replace: true });
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="page-connexion">
      <div style={{ width: '100%', maxWidth: 440 }}>
        <form className="carte shadow" onSubmit={valider}>
          <div className="text-center mb-4">
            <Logo />
            <h1 className="h5 mt-2 mb-0">Contrats des sous-agents</h1>
            <div className="text-muted small">AFG Bank Côte d&apos;Ivoire</div>
          </div>

          {erreur && <div className="alert alert-danger py-2" role="alert"><strong>Erreur : </strong>{erreur}</div>}

          <div className="mb-3">
            <label htmlFor="email" className="form-label">Adresse e-mail</label>
            <input id="email" type="email" className="form-control" autoComplete="username" required
              value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="mb-4">
            <label htmlFor="mdp" className="form-label">Mot de passe</label>
            <input id="mdp" type="password" className="form-control" autoComplete="current-password" required
              value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={envoi}>
            {envoi ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <div className="carte mt-3 text-center">
          <div className="fw-semibold">Vous souhaitez devenir sous-agent d&apos;AFG Bank ?</div>
          <p className="small text-muted mb-2">Déposez votre candidature en ligne et signez votre contrat sans vous déplacer.</p>
          <Link to="/candidature" className="btn btn-outline-primary w-100">
            <i className="bi bi-person-plus me-1" aria-hidden="true" />Déposer ma candidature
          </Link>
        </div>
      </div>
      <BarreAccessibilite flottante />
    </div>
  );
}
