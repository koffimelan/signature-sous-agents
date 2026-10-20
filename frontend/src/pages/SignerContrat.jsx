import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SignaturePad from 'signature_pad';
import api, { messageErreur } from '../api';
import {
  useApi, Chargement, Erreur, EnTete, Succes,
} from '../components/Communs';
import ApercuPdf from '../components/ApercuPdf';
import { formatDate } from '../libelles';

// Zone où le sous-agent trace sa signature (souris, doigt ou stylet)
function ZoneSignature({ onChange }) {
  const canevas = useRef(null);
  const pad = useRef(null);

  // Le canevas est redimensionné à la taille réelle de l'écran pour un tracé net
  const ajuster = useCallback(() => {
    const c = canevas.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const donnees = pad.current?.toData();
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    c.getContext('2d').scale(ratio, ratio);
    pad.current?.clear();
    if (donnees?.length) pad.current.fromData(donnees);
  }, []);

  useEffect(() => {
    pad.current = new SignaturePad(canevas.current, { penColor: '#001051', minWidth: 0.8, maxWidth: 2.6 });
    ajuster();
    pad.current.addEventListener('endStroke', () => onChange(pad.current.toDataURL('image/png')));
    window.addEventListener('resize', ajuster);
    return () => {
      window.removeEventListener('resize', ajuster);
      pad.current.off();
    };
  }, [ajuster, onChange]);

  return (
    <>
      <div className="zone-signature">
        <canvas ref={canevas} role="img" aria-label="Zone de signature : tracez votre signature avec la souris ou le doigt" />
      </div>
      <button type="button" className="btn btn-link px-0" onClick={() => { pad.current.clear(); onChange(''); }}>
        <i className="bi bi-eraser me-1" aria-hidden="true" />Effacer et recommencer
      </button>
    </>
  );
}

export default function SignerContrat() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const { donnees: contrat, chargement, erreur } = useApi(`/contrats/${id}`);
  const [accepte, setAccepte] = useState(false);
  const [envoi, setEnvoi] = useState(null); // réponse de l'envoi du code
  const [code, setCode] = useState('');
  const [signature, setSignature] = useState('');
  const [echec, setEchec] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(null);
  const surSignature = useCallback((image) => setSignature(image), []);

  if (chargement && !contrat) return <Chargement />;
  if (erreur) return <Erreur message={erreur} />;
  if (!contrat) return null;

  async function demanderCode() {
    setEchec('');
    try {
      const { data } = await api.post(`/contrats/${id}/otp`);
      setEnvoi(data);
      setCode('');
    } catch (err) {
      setEchec(messageErreur(err));
    }
  }

  async function signer(e) {
    e.preventDefault();
    setEchec('');
    setEnCours(true);
    try {
      const { data } = await api.post(`/contrats/${id}/signer`, { code, signature, accepte });
      setFait(data);
    } catch (err) {
      setEchec(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  if (fait) {
    return (
      <>
        <EnTete titre="Contrat signé" sousTitre={`Contrat ${fait.numero}`} />
        <div className="verdict ok mb-3">
          <h2><i className="bi bi-check-circle me-2" aria-hidden="true" />Votre contrat est signé</h2>
          <p className="mb-2">Il a été scellé par le cachet électronique de la Banque. Une confirmation vous a été envoyée par e-mail.</p>
          <div className="small text-muted mb-1">Empreinte SHA-256 du document signé :</div>
          <div className="empreinte">{fait.empreinte_signee}</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => naviguer('/mes-contrats')}>Retour à mes contrats</button>
      </>
    );
  }

  if (contrat.statut !== 'a_signer') {
    return <div className="alert alert-info">Ce contrat n&apos;est pas en attente de signature. <Link to="/mes-contrats">Retour à mes contrats</Link></div>;
  }

  const pret = accepte && envoi && /^\d{6}$/.test(code) && signature;

  return (
    <>
      <EnTete titre="Lire et signer mon contrat" sousTitre={`Contrat ${contrat.numero} - du ${formatDate(contrat.date_debut)} au ${formatDate(contrat.date_fin)}`} />
      <div className="row g-3">
        <div className="col-xl-7">
          <div className="carte">
            <h2 className="carte-titre">1. Lisez votre contrat</h2>
            <ApercuPdf url={`/contrats/${id}/pdf`} titre={`Contrat ${contrat.numero}`} />
          </div>
        </div>
        <div className="col-xl-5">
          <form className="carte" onSubmit={signer}>
            <Erreur message={echec} />
            <h2 className="carte-titre">2. Acceptez les termes du contrat</h2>
            <div className="form-check mb-3">
              <input id="accepte" type="checkbox" className="form-check-input" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} />
              <label htmlFor="accepte" className="form-check-label">J&apos;ai lu le contrat et j&apos;en accepte les termes.</label>
            </div>

            <h2 className="carte-titre">3. Recevez votre code de signature</h2>
            {!envoi ? (
              <button type="button" className="btn btn-outline-primary mb-3" onClick={demanderCode} disabled={!accepte}>
                <i className="bi bi-envelope me-1" aria-hidden="true" />Recevoir le code par e-mail
              </button>
            ) : (
              <>
                <Succes message={`Un code à 6 chiffres a été envoyé à ${envoi.destination}. Il est valable ${envoi.duree_minutes} minutes.`} />
                {envoi.code_demo && (
                  <div className="alert alert-warning py-2 small" role="note">
                    Démonstration sans serveur de messagerie : le code envoyé est <strong className="reference">{envoi.code_demo}</strong>.
                  </div>
                )}
                <label htmlFor="code" className="form-label">Code reçu</label>
                <input
                  id="code"
                  className="form-control code-otp mb-1"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <button type="button" className="btn btn-link px-0 mb-3" onClick={demanderCode}>Je n&apos;ai rien reçu : envoyer un nouveau code</button>
              </>
            )}

            <h2 className="carte-titre">4. Tracez votre signature</h2>
            <ZoneSignature onChange={surSignature} />

            <button type="submit" className="btn btn-primary w-100 mt-3" disabled={!pret || enCours}>
              <i className="bi bi-pen me-1" aria-hidden="true" />{enCours ? 'Signature en cours...' : 'Signer le contrat'}
            </button>
            <p className="small text-muted mt-2 mb-0">
              En signant, vous apposez une signature électronique sur ce contrat. Le document signé est scellé par la Banque :
              toute modification ultérieure serait détectée.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
