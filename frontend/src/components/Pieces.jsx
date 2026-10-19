import { useRef, useState } from 'react';
import api, { messageErreur, ouvrirFichier } from '../api';
import { BoutonIcone, Erreur, Pastille } from './Communs';
import {
  TYPES_PIECE, PIECES_OBLIGATOIRES, formatDateHeure, tailleFichier,
} from '../libelles';

// Liste des pièces justificatives d'un dossier, avec dépôt et remplacement si le dossier est modifiable
export default function Pieces({ pieces, urlEnvoi, modifiable, onChange }) {
  const [erreur, setErreur] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState('');
  const champs = useRef({});

  async function envoyer(type, fichier) {
    if (!fichier) return;
    setErreur('');
    setEnvoiEnCours(type);
    try {
      const donnees = new FormData();
      donnees.append('type', type);
      donnees.append('fichier', fichier);
      await api.post(urlEnvoi, donnees);
      onChange?.();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoiEnCours('');
      if (champs.current[type]) champs.current[type].value = '';
    }
  }

  async function supprimer(piece) {
    if (!window.confirm(`Retirer la pièce « ${TYPES_PIECE[piece.type]} » ?`)) return;
    try {
      await api.delete(`/sous-agents/pieces/${piece.id}`);
      onChange?.();
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  async function voir(piece) {
    try {
      await ouvrirFichier(`/sous-agents/pieces/${piece.id}/fichier`);
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <>
      <Erreur message={erreur} />
      <div className="liste-pieces">
        {Object.entries(TYPES_PIECE).map(([type, libelle]) => {
          const piece = pieces.find((p) => p.type === type);
          const obligatoire = PIECES_OBLIGATOIRES.includes(type);
          return (
            <div className="piece" key={type}>
              <i className={`bi ${piece ? 'bi-file-earmark-check text-success' : 'bi-file-earmark'} fs-4`} aria-hidden="true" />
              <div className="flex-grow-1">
                <div className="fw-semibold">
                  {libelle}{' '}
                  {obligatoire ? <Pastille couleur={piece ? 'success' : 'warning'}>{piece ? 'Fournie' : 'Obligatoire'}</Pastille>
                    : <span className="text-muted small">(facultative)</span>}
                </div>
                {piece && <div className="small text-muted">{piece.nom_origine} - {tailleFichier(piece.taille)} - déposée le {formatDateHeure(piece.createdAt)}</div>}
              </div>
              {piece && <BoutonIcone action="voir" titre={`Ouvrir la pièce « ${libelle} »`} onClick={() => voir(piece)} />}
              {modifiable && (
                <>
                  <label className="btn btn-outline-primary mb-0" htmlFor={`piece-${type}`}>
                    {envoiEnCours === type ? 'Envoi...' : (piece ? 'Remplacer' : 'Déposer')}
                  </label>
                  <input
                    id={`piece-${type}`}
                    ref={(el) => { champs.current[type] = el; }}
                    type="file"
                    className="visually-hidden"
                    accept="application/pdf,image/jpeg,image/png"
                    aria-label={`${piece ? 'Remplacer' : 'Déposer'} la pièce « ${libelle} »`}
                    onChange={(e) => envoyer(type, e.target.files[0])}
                  />
                  {piece && <BoutonIcone action="supprimer" titre={`Retirer la pièce « ${libelle} »`} onClick={() => supprimer(piece)} />}
                </>
              )}
            </div>
          );
        })}
      </div>
      {modifiable && <div className="form-text">Formats acceptés : PDF, JPEG ou PNG, 5 Mo au plus par pièce.</div>}
    </>
  );
}
