import { useState } from 'react';
import api, { messageErreur } from '../api';
import {
  useApi, Chargement, Erreur, Succes, EnTete, Modale, Champ, Pastille, BoutonIcone, Actions,
} from '../components/Communs';
import { ROLES } from '../libelles';

const VIDE = { nom: '', prenoms: '', email: '', telephone: '', role: 'commercial', actif: true, mot_de_passe: '' };

function FormulaireUtilisateur({ initial, onFermer, onFait }) {
  const [u, setU] = useState({ ...VIDE, ...initial, mot_de_passe: '' });
  const [erreur, setErreur] = useState('');
  const maj = (champ) => (e) => setU({ ...u, [champ]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function enregistrer(e) {
    e.preventDefault();
    try {
      const corps = { ...u };
      if (!corps.mot_de_passe) delete corps.mot_de_passe;
      if (initial?.id) await api.put(`/utilisateurs/${initial.id}`, corps);
      else await api.post('/utilisateurs', corps);
      onFait(initial?.id ? 'Compte modifié' : 'Compte créé');
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  return (
    <Modale
      titre={initial?.id ? 'Modifier le compte' : 'Nouveau compte'}
      onFermer={onFermer}
      pied={<><button type="button" className="btn btn-outline-secondary" onClick={onFermer}>Annuler</button><button type="submit" form="form-user" className="btn btn-primary">Enregistrer</button></>}
    >
      <form id="form-user" onSubmit={enregistrer}>
        <Erreur message={erreur} />
        <div className="row">
          <div className="col-md-5"><Champ libelle="Nom *"><input className="form-control" required value={u.nom} onChange={maj('nom')} /></Champ></div>
          <div className="col-md-7"><Champ libelle="Prénoms *"><input className="form-control" required value={u.prenoms} onChange={maj('prenoms')} /></Champ></div>
        </div>
        <Champ libelle="E-mail (identifiant de connexion) *"><input type="email" className="form-control" required value={u.email} onChange={maj('email')} /></Champ>
        <div className="row">
          <div className="col-md-6"><Champ libelle="Téléphone"><input className="form-control" value={u.telephone || ''} onChange={maj('telephone')} /></Champ></div>
          <div className="col-md-6">
            <Champ libelle="Rôle" aide={u.role === 'sous_agent' ? 'Les sous-agents créent normalement leur compte en déposant leur candidature.' : ''}>
              <select className="form-select" value={u.role} onChange={maj('role')}>
                {Object.entries(ROLES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </Champ>
          </div>
        </div>
        <Champ libelle={initial?.id ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe *'} aide="8 caractères minimum">
          <input type="password" className="form-control" autoComplete="new-password" minLength={8} required={!initial?.id} value={u.mot_de_passe} onChange={maj('mot_de_passe')} />
        </Champ>
        <div className="form-check">
          <input id="actif" type="checkbox" className="form-check-input" checked={u.actif} onChange={maj('actif')} />
          <label htmlFor="actif" className="form-check-label">Compte actif</label>
        </div>
      </form>
    </Modale>
  );
}

export default function Utilisateurs() {
  const [role, setRole] = useState('');
  const { donnees, chargement, erreur, recharger } = useApi(`/utilisateurs${role ? `?role=${role}` : ''}`);
  const [modale, setModale] = useState(null);
  const [message, setMessage] = useState('');

  return (
    <>
      <EnTete titre="Utilisateurs" sousTitre="Comptes de connexion et rôles">
        <div>
          <label className="form-label mb-1" htmlFor="f-role">Rôle</label>
          <select id="f-role" className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Tous les rôles</option>
            {Object.entries(ROLES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-primary align-self-end" onClick={() => setModale({})}><i className="bi bi-person-plus me-1" aria-hidden="true" />Nouveau compte</button>
      </EnTete>
      <Succes message={message} />
      <Erreur message={erreur} />
      {chargement && !donnees ? <Chargement /> : (
        <div className="carte p-0">
          <div className="table-responsive">
            <table className="table table-hover table-donnees">
              <thead><tr><th>Nom</th><th>E-mail</th><th>Téléphone</th><th>Rôle</th><th>État</th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {(donnees || []).map((u) => (
                  <tr key={u.id}>
                    <td className="fw-semibold">{u.nom} {u.prenoms}</td>
                    <td>{u.email}</td>
                    <td>{u.telephone || '-'}</td>
                    <td>{ROLES[u.role]}</td>
                    <td>{u.actif ? <Pastille ton="vert">Actif</Pastille> : <Pastille ton="gris">Désactivé</Pastille>}</td>
                    <td><Actions><BoutonIcone action="modifier" titre={`Modifier le compte de ${u.prenoms} ${u.nom}`} onClick={() => setModale(u)} /></Actions></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {modale && (
        <FormulaireUtilisateur
          initial={modale.id ? {
            id: modale.id, nom: modale.nom, prenoms: modale.prenoms, email: modale.email, telephone: modale.telephone, role: modale.role, actif: modale.actif,
          } : null}
          onFermer={() => setModale(null)}
          onFait={(texte) => { setModale(null); setMessage(texte); recharger(); }}
        />
      )}
    </>
  );
}
