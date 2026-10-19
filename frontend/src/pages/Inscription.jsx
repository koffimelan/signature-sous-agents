import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { accueil } from '../components/Layout';
import { messageErreur } from '../api';
import { Champ, Erreur } from '../components/Communs';
import BarreAccessibilite from '../components/BarreAccessibilite';
import { Logo } from './Connexion';

// Première étape de la candidature : création du compte du futur sous-agent
export default function Inscription() {
  const { utilisateur, inscription } = useAuth();
  const naviguer = useNavigate();
  const [f, setF] = useState({ nom: '', prenoms: '', email: '', telephone: '', mot_de_passe: '', confirmation: '' });
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const maj = (champ) => (e) => setF({ ...f, [champ]: e.target.value });

  if (utilisateur) return <Navigate to={accueil(utilisateur.role)} replace />;

  async function valider(e) {
    e.preventDefault();
    setErreur('');
    if (f.mot_de_passe !== f.confirmation) {
      setErreur('Les deux mots de passe ne sont pas identiques');
      return;
    }
    setEnvoi(true);
    try {
      await inscription({
        nom: f.nom, prenoms: f.prenoms, email: f.email, telephone: f.telephone, mot_de_passe: f.mot_de_passe,
      });
      naviguer('/mon-dossier', { replace: true });
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="page-connexion">
      <form className="carte shadow" style={{ maxWidth: 560 }} onSubmit={valider}>
        <div className="text-center mb-3">
          <Logo />
          <h1 className="h5 mt-2 mb-0">Candidature de sous-agent</h1>
          <div className="text-muted small">AFG Bank Côte d&apos;Ivoire</div>
        </div>
        <ol className="small text-muted ps-3">
          <li>Créez votre compte (cette page).</li>
          <li>Complétez votre dossier et déposez vos pièces : pièce d&apos;identité, photo, justificatif de domicile.</li>
          <li>Après étude de votre dossier, signez votre contrat en ligne avec un code reçu par e-mail.</li>
        </ol>
        <Erreur message={erreur} />
        <div className="row">
          <div className="col-sm-5"><Champ libelle="Nom *"><input className="form-control" required autoComplete="family-name" value={f.nom} onChange={maj('nom')} /></Champ></div>
          <div className="col-sm-7"><Champ libelle="Prénoms *"><input className="form-control" required autoComplete="given-name" value={f.prenoms} onChange={maj('prenoms')} /></Champ></div>
        </div>
        <div className="row">
          <div className="col-sm-7"><Champ libelle="Adresse e-mail *" aide="Elle servira à vous connecter et à recevoir le code de signature."><input type="email" className="form-control" required autoComplete="email" value={f.email} onChange={maj('email')} /></Champ></div>
          <div className="col-sm-5"><Champ libelle="Téléphone *"><input type="tel" className="form-control" required autoComplete="tel" placeholder="07 07 00 00 00" value={f.telephone} onChange={maj('telephone')} /></Champ></div>
        </div>
        <div className="row">
          <div className="col-sm-6"><Champ libelle="Mot de passe *" aide="8 caractères minimum"><input type="password" className="form-control" required minLength={8} autoComplete="new-password" value={f.mot_de_passe} onChange={maj('mot_de_passe')} /></Champ></div>
          <div className="col-sm-6"><Champ libelle="Confirmer le mot de passe *"><input type="password" className="form-control" required minLength={8} autoComplete="new-password" value={f.confirmation} onChange={maj('confirmation')} /></Champ></div>
        </div>
        <p className="small text-muted">
          Vos données sont utilisées par AFG Bank Côte d&apos;Ivoire pour étudier votre candidature et établir votre contrat,
          conformément à la loi n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel.
        </p>
        <button type="submit" className="btn btn-primary w-100" disabled={envoi}>{envoi ? 'Création du compte...' : 'Créer mon compte et ouvrir mon dossier'}</button>
        <div className="text-center mt-3"><Link to="/connexion">J&apos;ai déjà un compte : me connecter</Link></div>
      </form>
      <BarreAccessibilite flottante />
    </div>
  );
}
