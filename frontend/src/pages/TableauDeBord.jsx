import { Link } from 'react-router-dom';
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  useApi, Chargement, Erreur, EnTete, Vide,
} from '../components/Communs';
import {
  STATUTS_CONTRAT, formatDate, formatDateHeure, formatDelai,
} from '../libelles';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
ChartJS.defaults.font.family = '"Segoe UI Variable Text", "Segoe UI", system-ui, Arial, sans-serif';
ChartJS.defaults.font.size = 13;
ChartJS.defaults.color = '#353535';

const COULEURS = {
  brouillon: '#e0a100', validation_conformite: '#f0c24b', a_signer: '#3d5bb5', signe: '#007a3d', rejete: '#c40000', expire: '#5c6670', resilie: '#9aa5b1',
};
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function Indicateur({ valeur, libelle, icone, couleur, lien }) {
  const contenu = (
    <div className="carte indicateur h-100 d-flex align-items-center gap-3">
      <div className={`rounded-3 p-2 bg-${couleur}-subtle text-${couleur}-emphasis`}><i className={`bi bi-${icone} fs-4`} aria-hidden="true" /></div>
      <div><div className="valeur">{valeur}</div><div className="libelle">{libelle}</div></div>
    </div>
  );
  return lien ? <Link to={lien} className="text-reset text-decoration-none">{contenu}</Link> : contenu;
}

export default function TableauDeBord() {
  const { donnees: d, chargement, erreur } = useApi('/tableau-de-bord');
  if (chargement && !d) return <Chargement />;
  if (erreur) return <Erreur message={erreur} />;

  const statuts = Object.keys(STATUTS_CONTRAT).filter((s) => d.contrats[s] > 0);
  const aValider = d.contrats.brouillon + d.contrats.validation_conformite;

  return (
    <>
      <EnTete titre="Tableau de bord" sousTitre={`Contrats des sous-agents au ${new Date().toLocaleDateString('fr-FR')}`} />
      <div className="row g-3 mb-3">
        <div className="col-6 col-xl-3"><Indicateur valeur={d.total_contrats_en_vigueur} libelle="Contrats en vigueur" icone="file-earmark-check" couleur="success" lien="/contrats" /></div>
        <div className="col-6 col-xl-3"><Indicateur valeur={d.sous_agents.soumis + aValider} libelle="Dossiers et contrats à traiter" icone="list-check" couleur="warning" lien="/a-valider" /></div>
        <div className="col-6 col-xl-3"><Indicateur valeur={d.contrats.a_signer} libelle="En attente de signature" icone="pen" couleur="primary" lien="/contrats" /></div>
        <div className="col-6 col-xl-3"><Indicateur valeur={formatDelai(d.delai_moyen_heures)} libelle="Délai moyen candidature - signature" icone="stopwatch" couleur="info" /></div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-4">
          <div className="carte h-100">
            <h2 className="carte-titre">Contrats par statut</h2>
            <div style={{ maxWidth: 280, margin: '0 auto' }} role="img" aria-label={`Répartition des contrats : ${statuts.map((s) => `${STATUTS_CONTRAT[s].texte} ${d.contrats[s]}`).join(', ')}`}>
              <Doughnut
                data={{ labels: statuts.map((s) => STATUTS_CONTRAT[s].texte), datasets: [{ data: statuts.map((s) => d.contrats[s]), backgroundColor: statuts.map((s) => COULEURS[s]), borderWidth: 2 }] }}
                options={{ plugins: { legend: { position: 'bottom', labels: { boxWidth: 14, padding: 10 } } }, cutout: '58%' }}
              />
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="carte h-100">
            <h2 className="carte-titre">Contrats signés en ligne (6 derniers mois)</h2>
            <div role="img" aria-label={`Signatures par mois : ${d.mois.map((m) => `${MOIS[Number(m.mois.slice(5)) - 1]} ${m.signatures}`).join(', ')}`}>
              <Bar
                data={{ labels: d.mois.map((m) => MOIS[Number(m.mois.slice(5)) - 1]), datasets: [{ data: d.mois.map((m) => m.signatures), backgroundColor: '#001051', borderRadius: 4 }] }}
                options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }}
              />
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="carte h-100">
            <h2 className="carte-titre">Sous-agents</h2>
            <ul className="list-group list-group-flush">
              <li className="list-group-item d-flex justify-content-between px-0"><span>Actifs (contrat en vigueur)</span><strong>{d.sous_agents.actif}</strong></li>
              <li className="list-group-item d-flex justify-content-between px-0"><span>Candidatures à étudier</span><strong>{d.sous_agents.soumis}</strong></li>
              <li className="list-group-item d-flex justify-content-between px-0"><span>Admis, contrat en préparation</span><strong>{d.sous_agents.admis}</strong></li>
              <li className="list-group-item d-flex justify-content-between px-0"><span>Dossiers en cours de saisie</span><strong>{d.sous_agents.brouillon}</strong></li>
              <li className="list-group-item d-flex justify-content-between px-0"><span>Inactifs</span><strong>{d.sous_agents.inactif}</strong></li>
            </ul>
            <div className="small text-muted mt-2">{d.signes_ce_mois} contrat(s) signé(s) ce mois-ci, sans impression ni déplacement.</div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-xl-6">
          <div className="carte h-100">
            <div className="d-flex justify-content-between align-items-baseline mb-2">
              <h2 className="carte-titre mb-0">Contrats arrivant à échéance (30 jours)</h2>
              <Link to="/alertes">Voir les échéances</Link>
            </div>
            {d.echeances.length === 0 ? <Vide texte="Aucune échéance dans les 30 prochains jours" /> : (
              <table className="table table-sm table-donnees">
                <thead><tr><th>Contrat</th><th>Sous-agent</th><th>Fin</th><th>Reste</th></tr></thead>
                <tbody>
                  {d.echeances.map((e) => (
                    <tr key={e.id}>
                      <td><Link to={`/contrats/${e.id}`} className="reference">{e.numero}</Link></td>
                      <td>{e.sous_agent.prenoms} {e.sous_agent.nom}</td>
                      <td>{formatDate(e.date_fin)}</td>
                      <td><strong>{e.jours_restants} j</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="col-xl-6">
          <div className="carte h-100">
            <h2 className="carte-titre">Dernières signatures</h2>
            {d.derniers_signes.length === 0 ? <Vide texte="Aucun contrat signé" /> : (
              <table className="table table-sm table-donnees">
                <thead><tr><th>Contrat</th><th>Sous-agent</th><th>Signé le</th></tr></thead>
                <tbody>
                  {d.derniers_signes.map((c) => (
                    <tr key={c.id}>
                      <td><Link to={`/contrats/${c.id}`} className="reference">{c.numero}</Link></td>
                      <td>{c.sous_agent.prenoms} {c.sous_agent.nom}</td>
                      <td>{formatDateHeure(c.date_signature)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
