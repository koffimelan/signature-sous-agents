import { useState } from 'react';
import api, { messageErreur } from '../api';
import {
  useApi, Erreur, EnTete, Info,
} from '../components/Communs';
import { STATUTS_CONTRAT, formatDate, formatDateHeure } from '../libelles';

const VERDICTS = {
  authentique: ['ok', 'shield-check', 'Contrat authentique', 'Ce document est identique, octet pour octet, au contrat signé et scellé par AFG Bank Côte d\'Ivoire.'],
  non_signe: ['neutre', 'hourglass-split', 'Contrat non signé', 'Ce document correspond à un contrat généré par la plateforme, mais pas à sa version signée.'],
  scellement_invalide: ['ko', 'shield-x', 'Scellement invalide', 'Le document est connu mais le scellement de la Banque ne peut pas être vérifié.'],
  inconnu: ['ko', 'shield-x', 'Document non reconnu', 'Ce document ne correspond à aucun contrat émis par la plateforme : il a pu être modifié, même légèrement, ou ne provient pas de la Banque.'],
};

// Vérification d'un contrat PDF présenté (par un agent, un partenaire ou le sous-agent lui-même)
export default function Verification() {
  const { donnees: certificat } = useApi('/contrats/certificat');
  const [fichier, setFichier] = useState(null);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  async function verifier(e) {
    e.preventDefault();
    if (!fichier) return;
    setErreur('');
    setResultat(null);
    setEnvoi(true);
    try {
      const donnees = new FormData();
      donnees.append('fichier', fichier);
      const { data } = await api.post('/contrats/verifier', donnees);
      setResultat(data);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  const [classe, icone, titre, texte] = resultat ? VERDICTS[resultat.resultat] : [];

  return (
    <>
      <EnTete titre="Vérifier un contrat" sousTitre="Contrôle de l'authenticité et de l'intégrité d'un contrat PDF" />
      <div className="row g-3">
        <div className="col-xl-7">
          <form className="carte" onSubmit={verifier}>
            <p>
              Déposez le fichier PDF du contrat à contrôler. La plateforme calcule son empreinte SHA-256 et la compare à celle
              des contrats signés ; elle vérifie ensuite le scellement de la Banque. La modification d&apos;un seul caractère suffit
              à rendre le document non reconnu.
            </p>
            <Erreur message={erreur} />
            <label htmlFor="fichier" className="form-label">Contrat à vérifier (PDF)</label>
            <input id="fichier" type="file" className="form-control mb-3" accept="application/pdf" onChange={(e) => { setFichier(e.target.files[0] || null); setResultat(null); }} />
            <button type="submit" className="btn btn-primary" disabled={!fichier || envoi}>
              <i className="bi bi-shield-check me-1" aria-hidden="true" />{envoi ? 'Vérification...' : 'Vérifier le document'}
            </button>
          </form>

          {resultat && (
            <div className={`verdict ${classe} mt-3`} role="status" aria-live="polite">
              <h2><i className={`bi bi-${icone} me-2`} aria-hidden="true" />{titre}</h2>
              <p>{texte}</p>
              {resultat.contrat && (
                <dl className="mb-2">
                  <Info libelle="Contrat"><span className="reference">{resultat.contrat.numero}</span></Info>
                  <Info libelle="Sous-agent">{resultat.contrat.signataire ? `${resultat.contrat.signataire} (${resultat.contrat.code_sous_agent || ''})` : ''}</Info>
                  <Info libelle="Période">{`${formatDate(resultat.contrat.date_debut)} au ${formatDate(resultat.contrat.date_fin)}`}</Info>
                  <Info libelle="Signé le">{resultat.contrat.date_signature ? formatDateHeure(resultat.contrat.date_signature) : ''}</Info>
                  <Info libelle="Statut actuel">{STATUTS_CONTRAT[resultat.contrat.statut]?.texte}</Info>
                </dl>
              )}
              <div className="small text-muted mb-1">Empreinte SHA-256 du fichier « {resultat.nom_fichier} »</div>
              <div className="empreinte">{resultat.empreinte}</div>
            </div>
          )}
        </div>
        <div className="col-xl-5">
          <div className="carte">
            <h2 className="carte-titre">Cachet électronique de la Banque</h2>
            {certificat && (
              <dl className="mb-2">
                <Info libelle="Titulaire">{certificat.titulaire}</Info>
                <Info libelle="Organisation">{certificat.organisation}</Info>
                <Info libelle="Numéro de série"><span className="reference">{certificat.numero_serie}</span></Info>
                <Info libelle="Valable du">{`${formatDate(certificat.valable_du)} au ${formatDate(certificat.valable_jusqu_au)}`}</Info>
                <Info libelle="Algorithme">{certificat.algorithme}</Info>
              </dl>
            )}
            <p className="small text-muted mb-0">
              Prototype : le certificat est émis par la plateforme elle-même. En production, il serait délivré par un prestataire
              de certification agréé par l&apos;ARTCI et la clé privée serait conservée dans un module matériel sécurisé.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
