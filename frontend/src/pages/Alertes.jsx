import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { messageErreur } from '../api';
import { useAuth } from '../auth/AuthContext';
import {
  useApi, Chargement, Erreur, Succes, EnTete, PastilleAlerte, BoutonIcone, Actions, Vide,
} from '../components/Communs';
import { formatDate, formatDateHeure } from '../libelles';

export default function Alertes() {
  const [toutes, setToutes] = useState(false);
  const { donnees, chargement, erreur, recharger } = useApi(`/alertes${toutes ? '' : '?lue=false'}`);
  const { aLeRole } = useAuth();
  const [message, setMessage] = useState('');
  const [echec, setEchec] = useState('');

  async function controler() {
    setEchec('');
    try {
      const { data } = await api.post('/alertes/controler');
      setMessage(`Contrôle effectué : ${data.alertes} nouvelle(s) alerte(s), ${data.expires} contrat(s) passé(s) au statut expiré.`);
      recharger();
    } catch (err) {
      setEchec(messageErreur(err));
    }
  }

  async function marquerLue(a) {
    await api.put(`/alertes/${a.id}/lue`);
    recharger();
  }

  return (
    <>
      <EnTete titre="Échéances des contrats" sousTitre="Alertes envoyées 30 et 7 jours avant la fin de chaque contrat signé (contrôle automatique chaque matin)">
        <div className="form-check align-self-center">
          <input id="toutes" type="checkbox" className="form-check-input" checked={toutes} onChange={(e) => setToutes(e.target.checked)} />
          <label htmlFor="toutes" className="form-check-label">Afficher aussi les alertes traitées</label>
        </div>
        {aLeRole('commercial', 'admin') && (
          <button type="button" className="btn btn-outline-primary" onClick={controler}>
            <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />Lancer le contrôle maintenant
          </button>
        )}
      </EnTete>
      <Succes message={message} />
      <Erreur message={erreur || echec} />
      {chargement && !donnees ? <Chargement /> : (
        <div className="carte p-0">
          <div className="table-responsive">
            <table className="table table-donnees">
              <thead><tr><th>Niveau</th><th>Contrat</th><th>Sous-agent</th><th>Fin du contrat</th><th>Message</th><th>Créée le</th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {(donnees || []).map((a) => (
                  <tr key={a.id} className={a.lue ? 'text-muted' : ''}>
                    <td><PastilleAlerte niveau={a.niveau} /></td>
                    <td><Link className="reference" to={`/contrats/${a.contrat.id}`}>{a.contrat.numero}</Link></td>
                    <td>{a.contrat.sous_agent.prenoms} {a.contrat.sous_agent.nom}<div className="small text-muted">{a.contrat.sous_agent.telephone}</div></td>
                    <td>{formatDate(a.contrat.date_fin)}</td>
                    <td>{a.message}</td>
                    <td className="small">{formatDateHeure(a.createdAt)}</td>
                    <td><Actions>{!a.lue && <BoutonIcone action="lu" titre="Marquer l'alerte comme traitée" onClick={() => marquerLue(a)} />}</Actions></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {donnees?.length === 0 && <Vide texte="Aucune alerte en cours" />}
          </div>
        </div>
      )}
    </>
  );
}
