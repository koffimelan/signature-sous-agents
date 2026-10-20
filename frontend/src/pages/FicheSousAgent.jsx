import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { messageErreur } from '../api';
import { useAuth } from '../auth/AuthContext';
import {
  useApi, Chargement, Erreur, Succes, EnTete, Modale, Champ, Info, PastilleSousAgent, PastilleContrat, Vide,
} from '../components/Communs';
import Pieces from '../components/Pieces';
import FormulaireDossier, { CHAMPS_DOSSIER } from '../components/FormulaireDossier';
import {
  TYPES_IDENTITE, formatDate, formatDateHeure,
} from '../libelles';

// Génération du contrat à partir d'un modèle actif
function ModaleGeneration({ sousAgent, onFermer, onFait }) {
  const { donnees: modeles } = useApi('/modeles?actifs=1');
  const demain = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const [choix, setChoix] = useState({ modele_id: '', date_debut: demain });
  const [erreur, setErreur] = useState('');
  const modele = (modeles || []).find((m) => String(m.id) === String(choix.modele_id)) || modeles?.[0];

  async function generer(e) {
    e.preventDefault();
    try {
      const { data } = await api.post('/contrats', { sous_agent_id: sousAgent.id, modele_id: modele.id, date_debut: choix.date_debut });
      onFait(data);
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  return (
    <Modale
      titre={`Générer le contrat de ${sousAgent.prenoms} ${sousAgent.nom}`}
      onFermer={onFermer}
      pied={<><button type="button" className="btn btn-outline-secondary" onClick={onFermer}>Annuler</button><button type="submit" form="form-gen" className="btn btn-primary" disabled={!modele}>Générer le contrat</button></>}
    >
      <form id="form-gen" onSubmit={generer}>
        <Erreur message={erreur} />
        <Champ libelle="Modèle de contrat">
          <select className="form-select" value={modele?.id || ''} onChange={(e) => setChoix({ ...choix, modele_id: e.target.value })}>
            {(modeles || []).map((m) => <option key={m.id} value={m.id}>{m.titre} - version {m.version} ({m.duree_mois} mois)</option>)}
          </select>
        </Champ>
        <Champ libelle="Date de début du contrat"><input type="date" className="form-control" required value={choix.date_debut} onChange={(e) => setChoix({ ...choix, date_debut: e.target.value })} /></Champ>
        {modele && <p className="small text-muted mb-0">Commission prévue : {modele.taux_commission}. Le contrat sera pré-rempli avec les informations du dossier, puis soumis à la validation commerciale et à la conformité.</p>}
      </form>
    </Modale>
  );
}

export default function FicheSousAgent() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const { aLeRole } = useAuth();
  const { donnees: s, chargement, erreur, recharger } = useApi(`/sous-agents/${id}`);
  const [message, setMessage] = useState('');
  const [echec, setEchec] = useState('');
  const [modale, setModale] = useState(null); // 'rejet' | 'generation' | 'modifier'
  const [motif, setMotif] = useState('');
  const [valeurs, setValeurs] = useState(null);
  const gestionnaire = aLeRole('commercial', 'admin');

  if (chargement && !s) return <Chargement />;
  if (erreur) return <Erreur message={erreur} />;
  if (!s) return null;

  const enCours = s.contrats.some((c) => ['brouillon', 'validation_conformite', 'a_signer'].includes(c.statut));

  async function action(url, corps, texte) {
    setEchec('');
    try {
      await api.post(url, corps);
      setMessage(texte);
      setModale(null);
      recharger();
    } catch (err) {
      setEchec(messageErreur(err));
    }
  }

  async function enregistrer(e) {
    e.preventDefault();
    try {
      await api.put(`/sous-agents/${s.id}`, valeurs);
      setModale(null);
      setMessage('Dossier modifié');
      recharger();
    } catch (err) {
      setEchec(messageErreur(err));
    }
  }

  return (
    <>
      <EnTete titre={`${s.prenoms} ${s.nom}`} sousTitre={s.code ? `Sous-agent ${s.code}` : 'Candidat sous-agent'}>
        <div className="align-self-center"><PastilleSousAgent statut={s.statut} /></div>
        {gestionnaire && s.statut === 'soumis' && (
          <>
            <button type="button" className="btn btn-primary" onClick={() => action(`/sous-agents/${s.id}/admettre`, {}, 'Candidature admise : le contrat peut être généré')}>
              <i className="bi bi-check-lg me-1" aria-hidden="true" />Admettre
            </button>
            <button type="button" className="btn btn-outline-primary" onClick={() => { setMotif(''); setModale('rejet'); }}>
              <i className="bi bi-x-lg me-1" aria-hidden="true" />Rejeter
            </button>
          </>
        )}
        {gestionnaire && s.statut === 'admis' && !enCours && (
          <button type="button" className="btn btn-primary" onClick={() => setModale('generation')}>
            <i className="bi bi-file-earmark-plus me-1" aria-hidden="true" />Générer le contrat
          </button>
        )}
        {gestionnaire && (
          <button type="button" className="btn btn-outline-secondary" onClick={() => { setValeurs(Object.fromEntries(CHAMPS_DOSSIER.map((c) => [c, s[c] ?? '']))); setModale('modifier'); }}>
            <i className="bi bi-pencil-square me-1" aria-hidden="true" />Modifier
          </button>
        )}
      </EnTete>
      <Succes message={message} />
      <Erreur message={echec} />
      {s.statut === 'rejete' && <div className="alert alert-danger">Candidature rejetée le {formatDateHeure(s.date_decision)} : {s.motif_rejet}</div>}

      <div className="row g-3">
        <div className="col-xl-6">
          <div className="carte h-100">
            <h2 className="carte-titre">Identité et coordonnées</h2>
            <dl className="mb-0">
              <Info libelle="Civilité, nom et prénoms">{`${s.civilite || ''} ${s.nom} ${s.prenoms}`}</Info>
              <Info libelle="Né(e) le">{s.date_naissance ? `${formatDate(s.date_naissance)}${s.lieu_naissance ? ` à ${s.lieu_naissance}` : ''}` : ''}</Info>
              <Info libelle="Nationalité">{s.nationalite}</Info>
              <Info libelle="Pièce d'identité">{s.numero_piece ? `${TYPES_IDENTITE[s.type_piece] || s.type_piece} n° ${s.numero_piece}` : ''}</Info>
              <Info libelle="Téléphone">{s.telephone}</Info>
              <Info libelle="E-mail">{s.email}</Info>
              <Info libelle="Adresse">{[s.adresse, s.commune, s.ville].filter(Boolean).join(', ')}</Info>
              <Info libelle="Activité actuelle">{s.activite}</Info>
              <Info libelle="Zone de prospection">{s.zone}</Info>
              <Info libelle="Candidature soumise le">{s.date_soumission ? formatDateHeure(s.date_soumission) : ''}</Info>
              <Info libelle="Décision">{s.date_decision ? `${formatDateHeure(s.date_decision)}${s.decideur ? ` par ${s.decideur.prenoms} ${s.decideur.nom}` : ''}` : ''}</Info>
            </dl>
          </div>
        </div>
        <div className="col-xl-6 d-flex flex-column gap-3">
          <div className="carte">
            <h2 className="carte-titre">Pièces justificatives</h2>
            <Pieces pieces={s.pieces} urlEnvoi={`/sous-agents/${s.id}/pieces`} modifiable={gestionnaire} onChange={recharger} />
          </div>
          <div className="carte">
            <h2 className="carte-titre">Contrats</h2>
            {s.contrats.length === 0 ? <Vide texte="Aucun contrat" /> : (
              <table className="table table-sm table-donnees">
                <thead><tr><th>Numéro</th><th>Période</th><th>Statut</th></tr></thead>
                <tbody>
                  {[...s.contrats].sort((a, b) => b.id - a.id).map((c) => (
                    <tr key={c.id}>
                      <td><Link className="reference" to={`/contrats/${c.id}`}>{c.numero}</Link></td>
                      <td>{formatDate(c.date_debut)} - {formatDate(c.date_fin)}</td>
                      <td><PastilleContrat statut={c.statut} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modale === 'rejet' && (
        <Modale
          titre="Rejeter la candidature"
          onFermer={() => setModale(null)}
          pied={<><button type="button" className="btn btn-outline-secondary" onClick={() => setModale(null)}>Annuler</button><button type="button" className="btn btn-primary" disabled={!motif.trim()} onClick={() => action(`/sous-agents/${s.id}/rejeter`, { motif }, 'Candidature rejetée : le candidat a été informé par e-mail')}>Rejeter</button></>}
        >
          <Champ libelle="Motif communiqué au candidat *" aide="Indiquez ce qu'il doit corriger : il pourra compléter son dossier et le soumettre à nouveau.">
            <textarea className="form-control" rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} />
          </Champ>
        </Modale>
      )}
      {modale === 'generation' && (
        <ModaleGeneration sousAgent={s} onFermer={() => setModale(null)} onFait={(c) => naviguer(`/contrats/${c.id}`)} />
      )}
      {modale === 'modifier' && valeurs && (
        <Modale
          titre="Modifier le dossier"
          large
          onFermer={() => setModale(null)}
          pied={<><button type="button" className="btn btn-outline-secondary" onClick={() => setModale(null)}>Annuler</button><button type="submit" form="form-dossier" className="btn btn-primary">Enregistrer</button></>}
        >
          <form id="form-dossier" onSubmit={enregistrer}><FormulaireDossier valeurs={valeurs} onChange={setValeurs} emailModifiable /></form>
        </Modale>
      )}
    </>
  );
}
