import { useState } from 'react';
import api, { messageErreur } from '../api';
import { useAuth } from '../auth/AuthContext';
import {
  useApi, Chargement, Erreur, Succes, EnTete, Modale, Champ, Pastille, BoutonIcone, Actions,
} from '../components/Communs';
import { formatDateHeure } from '../libelles';

const VIDE = { titre: 'Contrat de sous-agent bancaire', version: '1.0', duree_mois: 12, taux_commission: '', contenu: '', actif: true };

function FormulaireModele({ initial, onFermer, onFait }) {
  const { donnees: champs } = useApi('/modeles/champs');
  const [m, setM] = useState({ ...VIDE, ...initial });
  const [erreur, setErreur] = useState('');
  const maj = (champ) => (e) => setM({ ...m, [champ]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function enregistrer(e) {
    e.preventDefault();
    try {
      if (initial?.id) await api.put(`/modeles/${initial.id}`, m);
      else await api.post('/modeles', m);
      onFait(initial?.id ? 'Modèle modifié' : 'Modèle créé');
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  return (
    <Modale
      large
      titre={initial?.id ? 'Modifier le modèle' : 'Nouveau modèle de contrat'}
      onFermer={onFermer}
      pied={<><button type="button" className="btn btn-outline-secondary" onClick={onFermer}>Annuler</button><button type="submit" form="form-modele" className="btn btn-primary">Enregistrer</button></>}
    >
      <form id="form-modele" onSubmit={enregistrer}>
        <Erreur message={erreur} />
        <div className="row">
          <div className="col-md-6"><Champ libelle="Titre *"><input className="form-control" required value={m.titre} onChange={maj('titre')} /></Champ></div>
          <div className="col-md-3"><Champ libelle="Version"><input className="form-control" value={m.version} onChange={maj('version')} /></Champ></div>
          <div className="col-md-3"><Champ libelle="Durée (mois)"><input type="number" min={1} max={60} className="form-control" value={m.duree_mois} onChange={maj('duree_mois')} /></Champ></div>
        </div>
        <Champ libelle="Commission"><input className="form-control" value={m.taux_commission || ''} onChange={maj('taux_commission')} placeholder="2 000 FCFA par compte ouvert..." /></Champ>
        <Champ libelle="Texte du contrat *" aide="Une ligne commençant par « Article » devient un titre ; une ligne vide sépare deux paragraphes.">
          <textarea className="form-control" rows={14} required value={m.contenu} onChange={maj('contenu')} style={{ fontFamily: 'var(--police-code)', fontSize: '0.8125rem' }} />
        </Champ>
        {champs && (
          <details className="mb-3">
            <summary>Champs disponibles (remplacés à la génération du contrat)</summary>
            <div className="d-flex flex-wrap gap-2 mt-2">
              {Object.entries(champs).map(([k, l]) => <span key={k} className="badge text-bg-light border" title={l}>{`{{${k}}}`}</span>)}
            </div>
          </details>
        )}
        <div className="form-check">
          <input id="actif" type="checkbox" className="form-check-input" checked={m.actif} onChange={maj('actif')} />
          <label htmlFor="actif" className="form-check-label">Modèle utilisable pour les nouveaux contrats</label>
        </div>
      </form>
    </Modale>
  );
}

export default function Modeles() {
  const { donnees, chargement, erreur, recharger } = useApi('/modeles');
  const { aLeRole } = useAuth();
  const [modale, setModale] = useState(null);
  const [message, setMessage] = useState('');
  const modifiable = aLeRole('admin', 'commercial');

  return (
    <>
      <EnTete titre="Modèles de contrat" sousTitre="Textes à partir desquels les contrats sont générés">
        {modifiable && <button type="button" className="btn btn-primary" onClick={() => setModale({})}><i className="bi bi-plus-lg me-1" aria-hidden="true" />Nouveau modèle</button>}
      </EnTete>
      <Succes message={message} />
      <Erreur message={erreur} />
      {chargement && !donnees ? <Chargement /> : (
        <div className="carte p-0">
          <div className="table-responsive">
            <table className="table table-hover table-donnees">
              <thead><tr><th>Titre</th><th>Version</th><th>Durée</th><th>Commission</th><th>Modifié le</th><th>État</th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {(donnees || []).map((m) => (
                  <tr key={m.id}>
                    <td className="fw-semibold">{m.titre}</td>
                    <td>{m.version}</td>
                    <td>{m.duree_mois} mois</td>
                    <td>{m.taux_commission}</td>
                    <td className="small">{formatDateHeure(m.updatedAt)}</td>
                    <td>{m.actif ? <Pastille couleur="success">En vigueur</Pastille> : <Pastille couleur="secondary">Archivé</Pastille>}</td>
                    <td><Actions><BoutonIcone action={modifiable ? 'modifier' : 'voir'} titre={`${modifiable ? 'Modifier' : 'Consulter'} le modèle ${m.titre} v${m.version}`} onClick={() => setModale(m)} /></Actions></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {modale && (
        <FormulaireModele
          initial={modale.id ? modale : null}
          onFermer={() => setModale(null)}
          onFait={(t) => { setModale(null); setMessage(t); recharger(); }}
        />
      )}
    </>
  );
}
