import { useState } from 'react';
import {
  useApi, Chargement, Erreur, EnTete, Vide,
} from '../components/Communs';
import { ROLES, formatDateHeure } from '../libelles';

// Journal d'audit : qui a fait quoi, quand et depuis quelle adresse (exigence de la conformité)
export default function Journal() {
  const { donnees, chargement, erreur } = useApi('/journal?limite=1000');
  const [filtre, setFiltre] = useState('');
  const mot = filtre.trim().toLowerCase();
  const lignes = (donnees || []).filter((l) => !mot
    || l.action.toLowerCase().includes(mot)
    || `${l.utilisateur?.prenoms} ${l.utilisateur?.nom}`.toLowerCase().includes(mot));

  return (
    <>
      <EnTete titre="Journal d'audit" sousTitre="Traçabilité de toutes les opérations - 1 000 dernières actions">
        <div>
          <label className="form-label mb-1" htmlFor="f-journal">Filtrer le journal</label>
          <input id="f-journal" className="form-control" style={{ width: 300 }} placeholder="Action, numéro de contrat, nom" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
        </div>
      </EnTete>
      <Erreur message={erreur} />
      {chargement && !donnees ? <Chargement /> : (
        <div className="carte p-0">
          <div className="table-responsive">
            <table className="table table-sm table-donnees">
              <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Adresse IP</th></tr></thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id}>
                    <td className="text-nowrap small">{formatDateHeure(l.date)}</td>
                    <td className="small">{l.utilisateur ? `${l.utilisateur.prenoms} ${l.utilisateur.nom} (${ROLES[l.utilisateur.role]})` : <span className="text-muted">Système</span>}</td>
                    <td>{l.action}</td>
                    <td className="small reference">{l.adresse_ip || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lignes.length === 0 && <Vide />}
          </div>
        </div>
      )}
    </>
  );
}
