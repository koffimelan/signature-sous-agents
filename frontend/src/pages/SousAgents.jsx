import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useApi, Chargement, Erreur, EnTete, PastilleSousAgent, BoutonIcone, Actions, Vide,
} from '../components/Communs';
import { STATUTS_SOUS_AGENT, PIECES_OBLIGATOIRES, formatDate } from '../libelles';

export default function SousAgents() {
  const [statut, setStatut] = useState('');
  const [q, setQ] = useState('');
  const naviguer = useNavigate();
  const params = new URLSearchParams();
  if (statut) params.set('statut', statut);
  if (q.trim().length >= 2) params.set('q', q.trim());
  const { donnees, chargement, erreur } = useApi(`/sous-agents?${params}`);

  return (
    <>
      <EnTete titre="Sous-agents" sousTitre={`${donnees?.length ?? 0} dossier(s)`} />
      <div className="carte mb-3">
        <div className="row g-2">
          <div className="col-md-7">
            <label className="form-label mb-1" htmlFor="q">Rechercher</label>
            <input id="q" className="form-control" placeholder="Nom, code, téléphone, numéro de pièce, ville" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="col-md-5">
            <label className="form-label mb-1" htmlFor="statut">Statut du dossier</label>
            <select id="statut" className="form-select" value={statut} onChange={(e) => setStatut(e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.entries(STATUTS_SOUS_AGENT).map(([k, s]) => <option key={k} value={k}>{s.texte}</option>)}
            </select>
          </div>
        </div>
      </div>
      <Erreur message={erreur} />
      {chargement && !donnees ? <Chargement /> : (
        <div className="carte p-0">
          <div className="table-responsive">
            <table className="table table-hover table-donnees">
              <thead><tr><th>Code</th><th>Nom et prénoms</th><th>Téléphone</th><th>Ville</th><th>Pièces</th><th>Contrat</th><th>Statut</th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {(donnees || []).map((s) => {
                  const fournies = PIECES_OBLIGATOIRES.filter((t) => s.pieces.some((p) => p.type === t)).length;
                  const contrat = [...s.contrats].sort((a, b) => b.id - a.id)[0];
                  return (
                    <tr key={s.id} className="ligne-cliquable" onClick={() => naviguer(`/sous-agents/${s.id}`)}>
                      <td className="reference">{s.code || '-'}</td>
                      <td className="fw-semibold">{s.nom} {s.prenoms}</td>
                      <td>{s.telephone}</td>
                      <td>{s.ville || '-'}</td>
                      <td>{fournies} / {PIECES_OBLIGATOIRES.length}</td>
                      <td>{contrat ? <><span className="reference">{contrat.numero}</span><div className="small text-muted">jusqu&apos;au {formatDate(contrat.date_fin)}</div></> : '-'}</td>
                      <td><PastilleSousAgent statut={s.statut} /></td>
                      <td><Actions><BoutonIcone action="voir" titre={`Ouvrir le dossier de ${s.prenoms} ${s.nom}`} onClick={() => naviguer(`/sous-agents/${s.id}`)} /></Actions></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {donnees?.length === 0 && <Vide />}
          </div>
        </div>
      )}
    </>
  );
}
