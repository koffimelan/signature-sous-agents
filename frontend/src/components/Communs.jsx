import {
  useEffect, useState, useCallback, useId, cloneElement, isValidElement,
} from 'react';
import api, { messageErreur } from '../api';
import { STATUTS_SOUS_AGENT, STATUTS_CONTRAT, NIVEAUX_ALERTE } from '../libelles';

// Pastilles de statut : le texte est toujours affiché, la couleur ne fait que l'appuyer
export function Pastille({ couleur = 'secondary', children }) {
  return <span className={`badge rounded-pill text-bg-${couleur}`}>{children}</span>;
}

const pastille = (liste, cle) => {
  const s = liste[cle];
  return <Pastille couleur={s?.couleur}>{s?.texte || cle}</Pastille>;
};
export const PastilleSousAgent = ({ statut }) => pastille(STATUTS_SOUS_AGENT, statut);
export const PastilleContrat = ({ statut }) => pastille(STATUTS_CONTRAT, statut);
export const PastilleAlerte = ({ niveau }) => pastille(NIVEAUX_ALERTE, niveau);

// Bouton d'action à icône utilisé dans les tableaux.
// Le libellé apparaît en infobulle au survol et il est lu par les lecteurs d'écran.
const VARIANTES = {
  voir: { icone: 'eye', classe: 'neutre' },
  modifier: { icone: 'pencil-square', classe: 'neutre' },
  supprimer: { icone: 'trash3', classe: 'danger' },
  pdf: { icone: 'file-earmark-pdf', classe: 'neutre' },
  valider: { icone: 'check-lg', classe: 'succes' },
  rejeter: { icone: 'x-lg', classe: 'danger' },
  signer: { icone: 'pen', classe: 'succes' },
  lu: { icone: 'check2', classe: 'neutre' },
};

export function BoutonIcone({ action, titre, onClick, disabled }) {
  const { icone, classe } = VARIANTES[action];
  return (
    <button
      type="button"
      className={`btn-icone ${classe}`}
      title={titre}
      aria-label={titre}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
    >
      <i className={`bi bi-${icone}`} aria-hidden="true" />
    </button>
  );
}

export function Actions({ children }) {
  return <div className="actions">{children}</div>;
}

export function Chargement() {
  return (
    <div className="text-center text-muted py-5">
      <div className="spinner-border spinner-border-sm me-2" role="status" />
      Chargement...
    </div>
  );
}

export function Erreur({ message, details }) {
  if (!message) return null;
  const lignes = details ? [...(details.informations || []), ...(details.pieces || [])] : [];
  return (
    <div className="alert alert-danger py-2" role="alert">
      <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" /><strong>Erreur : </strong>{message}
      {lignes.length > 0 && <ul className="mb-0 mt-1">{lignes.map((l) => <li key={l}>{l}</li>)}</ul>}
    </div>
  );
}

export function Succes({ message }) {
  if (!message) return null;
  return <div className="alert alert-success py-2" role="status"><i className="bi bi-check-circle me-2" aria-hidden="true" />{message}</div>;
}

export function EnTete({ titre, sousTitre, children }) {
  return (
    <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
      <div>
        <h1 className="titre-page mb-1">{titre}</h1>
        {sousTitre && <p className="text-muted mb-0">{sousTitre}</p>}
      </div>
      <div className="d-flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// Fenêtre modale simple (sans dépendance au JavaScript de Bootstrap)
export function Modale({ titre, onFermer, children, pied, large }) {
  useEffect(() => {
    const echap = (e) => e.key === 'Escape' && onFermer();
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [onFermer]);

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
        <div className={`modal-dialog modal-dialog-scrollable ${large ? 'modal-lg' : ''}`}>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5">{titre}</h2>
              <button type="button" className="btn-close" aria-label="Fermer la fenêtre" title="Fermer" onClick={onFermer} />
            </div>
            <div className="modal-body">{children}</div>
            {pied && <div className="modal-footer">{pied}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

// Charge une ressource de l'API et expose { donnees, chargement, erreur, recharger }
export function useApi(url) {
  const [etat, setEtat] = useState({ donnees: null, chargement: true, erreur: '' });

  const recharger = useCallback(async () => {
    if (!url) return;
    setEtat((e) => ({ ...e, chargement: true }));
    try {
      const { data } = await api.get(url);
      setEtat({ donnees: data, chargement: false, erreur: '' });
    } catch (err) {
      setEtat({ donnees: null, chargement: false, erreur: messageErreur(err) });
    }
  }, [url]);

  useEffect(() => { recharger(); }, [recharger]);
  return { ...etat, recharger };
}

// Champ de formulaire : le libellé est relié au contrôle (htmlFor / id), l'aide aussi (aria-describedby)
export function Champ({ libelle, children, aide }) {
  const id = useId();
  const idAide = `${id}-aide`;
  const valide = isValidElement(children);
  const idControle = valide ? (children.props.id || id) : undefined;
  const controle = valide
    ? cloneElement(children, { id: idControle, 'aria-describedby': aide ? idAide : undefined })
    : children;
  return (
    <div className="mb-3">
      <label className="form-label mb-1" htmlFor={idControle}>{libelle}</label>
      {controle}
      {aide && <div id={idAide} className="form-text">{aide}</div>}
    </div>
  );
}

export function Vide({ texte = 'Aucun élément à afficher' }) {
  return <div className="text-center text-muted py-4"><i className="bi bi-inbox me-2" aria-hidden="true" />{texte}</div>;
}

// Ligne « libellé : valeur » des fiches de détail
export function Info({ libelle, children }) {
  return (
    <div className="row py-1">
      <dt className="col-sm-5 text-muted fw-normal">{libelle}</dt>
      <dd className="col-sm-7 mb-0">{children || '-'}</dd>
    </div>
  );
}
