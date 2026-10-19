import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  useApi, Chargement, Erreur, EnTete, Vide, BoutonIcone, Actions,
} from '../components/Communs';
import { formatDateHeure } from '../libelles';

// File de travail : ce qui attend une décision de l'utilisateur connecté
function Bloc({ titre, aide, lignes, colonnes, ouvrir }) {
  return (
    <div className="carte p-0 mb-3">
      <div className="p-3 pb-2">
        <h2 className="carte-titre mb-1">{titre} <span className="badge rounded-pill text-bg-primary ms-1">{lignes.length}</span></h2>
        <div className="small text-muted">{aide}</div>
      </div>
      {lignes.length === 0 ? <Vide texte="Rien à traiter" /> : (
        <div className="table-responsive">
          <table className="table table-hover table-donnees">
            <thead><tr>{colonnes.map(([t]) => <th key={t}>{t}</th>)}<th className="text-end">Actions</th></tr></thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="ligne-cliquable" onClick={() => ouvrir(l)}>
                  {colonnes.map(([t, rendu]) => <td key={t}>{rendu(l)}</td>)}
                  <td><Actions><BoutonIcone action="voir" titre="Ouvrir pour décider" onClick={() => ouvrir(l)} /></Actions></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ATraiter() {
  const { aLeRole } = useAuth();
  const naviguer = useNavigate();
  const commercial = aLeRole('commercial', 'admin');
  const conformite = aLeRole('conformite', 'admin');
  const candidatures = useApi(commercial ? '/sous-agents?statut=soumis' : null);
  const admis = useApi(commercial ? '/sous-agents?statut=admis' : null);
  const contrats = useApi('/contrats?statut=brouillon,validation_conformite');

  if (contrats.chargement && !contrats.donnees) return <Chargement />;
  const nom = (sa) => `${sa.prenoms} ${sa.nom}`;
  const sansContrat = (admis.donnees || []).filter((s) => !s.contrats.some((c) => ['brouillon', 'validation_conformite', 'a_signer', 'signe'].includes(c.statut)));
  const parStatut = (s) => (contrats.donnees || []).filter((c) => c.statut === s);

  return (
    <>
      <EnTete titre="À traiter" sousTitre="Candidatures et contrats qui attendent votre décision" />
      <Erreur message={contrats.erreur || candidatures.erreur} />
      {commercial && (
        <>
          <Bloc
            titre="Candidatures à étudier"
            aide="Vérifier les pièces du dossier, puis admettre ou rejeter la candidature."
            lignes={candidatures.donnees || []}
            colonnes={[['Candidat', (s) => <span className="fw-semibold">{nom(s)}</span>], ['Ville', (s) => s.ville], ['Zone', (s) => s.zone], ['Soumise le', (s) => formatDateHeure(s.date_soumission)]]}
            ouvrir={(s) => naviguer(`/sous-agents/${s.id}`)}
          />
          <Bloc
            titre="Candidats admis sans contrat"
            aide="Générer le contrat à partir du modèle en vigueur."
            lignes={sansContrat}
            colonnes={[['Sous-agent', (s) => <span className="fw-semibold">{nom(s)}</span>], ['Code', (s) => <span className="reference">{s.code}</span>], ['Admis le', (s) => formatDateHeure(s.date_decision)]]}
            ouvrir={(s) => naviguer(`/sous-agents/${s.id}`)}
          />
          <Bloc
            titre="Contrats à valider (étape commerciale)"
            aide="Relire le contrat généré avant de le transmettre à la conformité."
            lignes={parStatut('brouillon')}
            colonnes={[['Contrat', (c) => <span className="reference">{c.numero}</span>], ['Sous-agent', (c) => nom(c.sous_agent)], ['Généré le', (c) => formatDateHeure(c.createdAt)]]}
            ouvrir={(c) => naviguer(`/contrats/${c.id}`)}
          />
        </>
      )}
      {conformite && (
        <Bloc
          titre="Contrats à valider (conformité)"
          aide="Contrôler le dossier (connaissance du client, lutte contre le blanchiment) avant l'envoi en signature."
          lignes={parStatut('validation_conformite')}
          colonnes={[['Contrat', (c) => <span className="reference">{c.numero}</span>], ['Sous-agent', (c) => nom(c.sous_agent)], ['Ville', (c) => c.sous_agent.ville], ['Validé par le commercial', (c) => formatDateHeure(c.updatedAt)]]}
          ouvrir={(c) => naviguer(`/contrats/${c.id}`)}
        />
      )}
    </>
  );
}
