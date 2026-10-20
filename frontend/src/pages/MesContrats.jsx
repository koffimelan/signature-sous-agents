import { useNavigate } from 'react-router-dom';
import { ouvrirFichier } from '../api';
import {
  useApi, Chargement, Erreur, EnTete, PastilleContrat, Vide,
} from '../components/Communs';
import { formatDate, formatDateHeure } from '../libelles';

export default function MesContrats() {
  const { donnees, chargement, erreur } = useApi('/contrats');
  const naviguer = useNavigate();

  return (
    <>
      <EnTete titre="Mes contrats" sousTitre="Contrats établis par AFG Bank Côte d'Ivoire à votre nom" />
      <Erreur message={erreur} />
      {chargement && !donnees ? <Chargement /> : (
        <div className="d-flex flex-column gap-3">
          {(donnees || []).length === 0 && <div className="carte"><Vide texte="Aucun contrat pour le moment : il apparaîtra ici dès qu'il sera prêt à être signé." /></div>}
          {(donnees || []).map((c) => (
            <div className="carte d-flex flex-wrap align-items-center gap-3" key={c.id}>
              <i className="bi bi-file-earmark-text fs-1 text-primary" aria-hidden="true" />
              <div className="flex-grow-1">
                <div className="fw-semibold">Contrat <span className="reference">{c.numero}</span> <PastilleContrat statut={c.statut} /></div>
                <div className="text-muted">Du {formatDate(c.date_debut)} au {formatDate(c.date_fin)}</div>
                {c.date_signature && <div className="small text-muted">Signé électroniquement le {formatDateHeure(c.date_signature)}</div>}
              </div>
              <div className="d-flex gap-2">
                {c.statut === 'a_signer' ? (
                  <button type="button" className="btn btn-primary" onClick={() => naviguer(`/mes-contrats/${c.id}/signer`)}>
                    <i className="bi bi-pen me-1" aria-hidden="true" />Lire et signer
                  </button>
                ) : (
                  <button type="button" className="btn btn-outline-primary" onClick={() => ouvrirFichier(`/contrats/${c.id}/pdf`).catch(() => {})}>
                    <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />Ouvrir le contrat
                  </button>
                )}
                {c.date_signature && (
                  <button type="button" className="btn btn-outline-secondary" onClick={() => ouvrirFichier(`/contrats/${c.id}/pdf`, `${c.numero}-signe.pdf`).catch(() => {})}>
                    <i className="bi bi-download me-1" aria-hidden="true" />Télécharger
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
