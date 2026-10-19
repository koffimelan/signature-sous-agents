import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { messageErreur } from '../api';
import {
  useApi, Chargement, Erreur, Succes, EnTete, PastilleSousAgent,
} from '../components/Communs';
import FormulaireDossier, { CHAMPS_DOSSIER } from '../components/FormulaireDossier';
import Pieces from '../components/Pieces';
import { PIECES_OBLIGATOIRES, TYPES_PIECE, formatDateHeure } from '../libelles';

const OBLIGATOIRES = {
  date_naissance: 'Date de naissance', numero_piece: 'Numéro de la pièce d\'identité', adresse: 'Adresse', ville: 'Ville', zone: 'Zone de prospection',
};

// Les pièces manquantes renvoyées par l'API sont des codes (cni, photo...) : on affiche leur libellé
const lisible = (d) => (d ? { ...d, pieces: (d.pieces || []).map((t) => TYPES_PIECE[t] || t) } : null);

// Message affiché selon l'avancement du dossier
function Avancement({ dossier }) {
  const textes = {
    brouillon: ['info', 'Complétez vos informations et déposez les pièces obligatoires, puis soumettez votre candidature.'],
    soumis: ['warning', `Candidature soumise le ${formatDateHeure(dossier.date_soumission)} : elle est en cours d'étude par la Banque. Vous serez informé(e) par e-mail.`],
    admis: ['success', 'Votre candidature est acceptée. Votre contrat est en préparation : vous recevrez un e-mail dès qu\'il sera prêt à être signé.'],
    rejete: ['danger', `Votre candidature n'a pas été acceptée en l'état. Motif : ${dossier.motif_rejet}. Corrigez votre dossier puis soumettez-le à nouveau.`],
    actif: ['success', 'Vous êtes sous-agent d\'AFG Bank Côte d\'Ivoire : votre contrat est signé et en vigueur.'],
    inactif: ['secondary', 'Vous n\'avez plus de contrat en vigueur. Contactez votre chargé commercial pour un renouvellement.'],
  };
  const [couleur, texte] = textes[dossier.statut];
  const aSigner = dossier.contrats?.some((c) => c.statut === 'a_signer');
  return (
    <div className={`alert alert-${couleur}`} role="status">
      {aSigner ? <><strong>Votre contrat est prêt à être signé.</strong> <Link to="/mes-contrats">Lire et signer mon contrat</Link></> : texte}
    </div>
  );
}

export default function MonDossier() {
  const { donnees: dossier, chargement, erreur, recharger } = useApi('/sous-agents/moi');
  const [valeurs, setValeurs] = useState(null);
  const [message, setMessage] = useState('');
  const [echec, setEchec] = useState({ message: '', details: null });

  useEffect(() => {
    if (dossier) setValeurs(Object.fromEntries(CHAMPS_DOSSIER.map((c) => [c, dossier[c] ?? ''])));
  }, [dossier]);

  if (chargement && !dossier) return <Chargement />;
  if (erreur) return <Erreur message={erreur} />;
  if (!dossier || !valeurs) return null;

  const modifiable = ['brouillon', 'rejete'].includes(dossier.statut);
  const manquants = Object.entries(OBLIGATOIRES).filter(([c]) => !dossier[c]).map(([, l]) => l);
  const piecesManquantes = PIECES_OBLIGATOIRES.filter((t) => !dossier.pieces.some((p) => p.type === t)).map((t) => TYPES_PIECE[t]);

  async function enregistrer(e) {
    e?.preventDefault();
    setMessage('');
    setEchec({ message: '' });
    try {
      await api.put('/sous-agents/moi', valeurs);
      setMessage('Informations enregistrées');
      await recharger();
      return true;
    } catch (err) {
      setEchec({ message: messageErreur(err), details: lisible(err.response?.data?.details) });
      return false;
    }
  }

  async function soumettre() {
    if (!(await enregistrer())) return;
    try {
      await api.post('/sous-agents/moi/soumettre');
      setMessage('Votre candidature a été soumise. Elle va être étudiée par un chargé commercial.');
      recharger();
    } catch (err) {
      setEchec({ message: messageErreur(err), details: lisible(err.response?.data?.details) });
    }
  }

  return (
    <>
      <EnTete titre="Mon dossier" sousTitre={`Candidature de sous-agent ${dossier.code ? `- code ${dossier.code}` : ''}`}>
        <div className="align-self-center"><PastilleSousAgent statut={dossier.statut} /></div>
      </EnTete>
      <Avancement dossier={dossier} />
      <Succes message={message} />
      <Erreur message={echec.message} details={echec.details} />

      <div className="row g-3">
        <div className="col-xl-7">
          <form className="carte" onSubmit={enregistrer}>
            {valeurs && <FormulaireDossier valeurs={valeurs} onChange={setValeurs} desactive={!modifiable} />}
            {modifiable && <button type="submit" className="btn btn-outline-primary"><i className="bi bi-save me-1" aria-hidden="true" />Enregistrer</button>}
          </form>
        </div>
        <div className="col-xl-5 d-flex flex-column gap-3">
          <div className="carte">
            <h2 className="carte-titre">Pièces justificatives</h2>
            <Pieces pieces={dossier.pieces} urlEnvoi="/sous-agents/moi/pieces" modifiable={modifiable} onChange={recharger} />
          </div>
          {modifiable && (
            <div className="carte">
              <h2 className="carte-titre">Soumettre ma candidature</h2>
              {manquants.length + piecesManquantes.length > 0 ? (
                <>
                  <p className="mb-1">Il reste à fournir :</p>
                  <ul>{[...manquants, ...piecesManquantes].map((m) => <li key={m}>{m}</li>)}</ul>
                </>
              ) : <p>Votre dossier est complet. Après soumission, il ne pourra plus être modifié pendant son étude.</p>}
              <button type="button" className="btn btn-primary w-100" onClick={soumettre}>
                <i className="bi bi-send me-1" aria-hidden="true" />Soumettre ma candidature
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
