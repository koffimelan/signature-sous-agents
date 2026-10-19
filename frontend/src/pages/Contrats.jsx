import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ouvrirFichier } from '../api';
import {
  useApi, Chargement, Erreur, EnTete, PastilleContrat, BoutonIcone, Actions, Vide,
} from '../components/Communs';
import { STATUTS_CONTRAT, formatDate, formatDateHeure } from '../libelles';

export default function Contrats() {
  const [statut, setStatut] = useState('');
  const [q, setQ] = useState('');
  const [erreurPdf, setErreurPdf] = useState('');
  const naviguer = useNavigate();
  const params = new URLSearchParams();
  if (statut) params.set('statut', statut);
  if (q.trim().length >= 2) params.set('q', q.trim());
  const { donnees, chargement, erreur } = useApi(`/contrats?${params}`);

  return (
    <>
      <EnTete titre="Contrats" sousTitre={`${donnees?.length ?? 0} contrat(s)`} />
      <div className="carte mb-3">
        <div className="row g-2">
          <div className="col-md-7">
            <label className="form-label mb-1" htmlFor="q">Rechercher</label>
            <input id="q" className="form-control" placeholder="Numéro de contrat, nom ou code du sous-agent" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="col-md-5">
            <label className="form-label mb-1" htmlFor="statut">Statut</label>
            <select id="statut" className="form-select" value={statut} onChange={(e) => setStatut(e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.entries(STATUTS_CONTRAT).map(([k, s]) => <option key={k} value={k}>{s.texte}</option>)}
            </select>
          </div>
        </div>
      </div>
      <Erreur message={erreur || erreurPdf} />
      {chargement && !donnees ? <Chargement /> : (
        <div className="carte p-0">
          <div className="table-responsive">
            <table className="table table-hover table-donnees">
              <thead><tr><th>Numéro</th><th>Sous-agent</th><th>Début</th><th>Fin</th><th>Signé le</th><th>Statut</th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {(donnees || []).map((c) => (
                  <tr key={c.id} className="ligne-cliquable" onClick={() => naviguer(`/contrats/${c.id}`)}>
                    <td className="reference">{c.numero}</td>
                    <td><span className="fw-semibold">{c.sous_agent.prenoms} {c.sous_agent.nom}</span><div className="small text-muted">{c.sous_agent.code}</div></td>
                    <td>{formatDate(c.date_debut)}</td>
                    <td>{formatDate(c.date_fin)}</td>
                    <td>{c.date_signature ? formatDateHeure(c.date_signature) : '-'}</td>
                    <td><PastilleContrat statut={c.statut} /></td>
                    <td>
                      <Actions>
                        <BoutonIcone action="pdf" titre={`Ouvrir le PDF du contrat ${c.numero}`} onClick={() => ouvrirFichier(`/contrats/${c.id}/pdf`).catch((e) => setErreurPdf(e.message))} />
                        <BoutonIcone action="voir" titre={`Ouvrir la fiche du contrat ${c.numero}`} onClick={() => naviguer(`/contrats/${c.id}`)} />
                      </Actions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {donnees?.length === 0 && <Vide />}
          </div>
        </div>
      )}
    </>
  );
}
