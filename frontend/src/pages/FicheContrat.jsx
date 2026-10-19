import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { messageErreur, ouvrirFichier } from '../api';
import { useAuth } from '../auth/AuthContext';
import {
  useApi, Chargement, Erreur, Succes, EnTete, Modale, Champ, Info, PastilleContrat,
} from '../components/Communs';
import ApercuPdf from '../components/ApercuPdf';
import { ETAPES, formatDate, formatDateHeure } from '../libelles';

// Étapes du circuit : génération, validation commerciale, validation de conformité, signature
function Circuit({ contrat }) {
  const decision = (etape) => contrat.validations.filter((v) => v.etape === etape).at(-1);
  const etapes = [
    { titre: 'Contrat généré', fait: true, detail: `${formatDateHeure(contrat.createdAt)}${contrat.auteur ? ` par ${contrat.auteur.prenoms} ${contrat.auteur.nom}` : ''}` },
    ...['commercial', 'conformite'].map((etape) => {
      const v = decision(etape);
      return {
        titre: ETAPES[etape],
        fait: v?.decision === 'valide',
        refusee: v?.decision === 'rejete',
        courante: !v && ((etape === 'commercial' && contrat.statut === 'brouillon') || (etape === 'conformite' && contrat.statut === 'validation_conformite')),
        detail: v ? `${v.decision === 'valide' ? 'Validé' : 'Rejeté'} le ${formatDateHeure(v.date)} par ${v.valideur.prenoms} ${v.valideur.nom}${v.commentaire ? ` : « ${v.commentaire} »` : ''}` : 'En attente',
      };
    }),
    {
      titre: 'Signature du sous-agent',
      fait: Boolean(contrat.date_signature),
      courante: contrat.statut === 'a_signer',
      detail: contrat.date_signature ? `Signé le ${formatDateHeure(contrat.date_signature)} (adresse IP ${contrat.ip_signature || 'inconnue'})` : 'En attente',
    },
  ];
  return (
    <ol className="etapes">
      {etapes.map((e) => (
        <li key={e.titre} className={e.refusee ? 'refusee' : e.fait ? 'faite' : e.courante ? 'courante' : ''}>
          <span className="rond" aria-hidden="true"><i className={`bi bi-${e.refusee ? 'x-lg' : e.fait ? 'check-lg' : 'circle'}`} /></span>
          <div>
            <div className="titre-etape">{e.titre} <span className="visually-hidden">{e.refusee ? '(rejeté)' : e.fait ? '(fait)' : e.courante ? '(étape en cours)' : '(à venir)'}</span></div>
            <div className="small text-muted">{e.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function FicheContrat() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const { utilisateur, aLeRole } = useAuth();
  const { donnees: c, chargement, erreur, recharger } = useApi(`/contrats/${id}`);
  const [message, setMessage] = useState('');
  const [echec, setEchec] = useState('');
  const [modale, setModale] = useState(null); // { action, titre }
  const [texte, setTexte] = useState('');
  const [integrite, setIntegrite] = useState(null);

  if (chargement && !c) return <Chargement />;
  if (erreur) return <Erreur message={erreur} />;
  if (!c) return null;

  const role = utilisateur.role;
  const peutDecider = (c.statut === 'brouillon' && ['commercial', 'admin'].includes(role))
    || (c.statut === 'validation_conformite' && ['conformite', 'admin'].includes(role));

  async function envoyer(action, corps, succes) {
    setEchec('');
    try {
      const { data } = await api.post(`/contrats/${c.id}/${action}`, corps);
      setModale(null);
      setMessage(succes);
      if (action === 'renouveler') naviguer(`/contrats/${data.id}`);
      else recharger();
    } catch (err) {
      setEchec(messageErreur(err));
    }
  }

  async function controler() {
    setEchec('');
    try {
      const { data } = await api.get(`/contrats/${c.id}/integrite`);
      setIntegrite(data);
    } catch (err) {
      setEchec(messageErreur(err));
    }
  }

  const ouvrirModale = (action, titre) => { setTexte(''); setModale({ action, titre }); };
  const integre = integrite && integrite.integre && integrite.scellement_valide !== false;

  return (
    <>
      <EnTete titre={`Contrat ${c.numero}`} sousTitre={`${c.sous_agent.prenoms} ${c.sous_agent.nom} - du ${formatDate(c.date_debut)} au ${formatDate(c.date_fin)}`}>
        <div className="align-self-center"><PastilleContrat statut={c.statut} /></div>
        {peutDecider && (
          <>
            <button type="button" className="btn btn-success" onClick={() => ouvrirModale('valider', c.statut === 'brouillon' ? 'Validation commerciale' : 'Validation de conformité')}>
              <i className="bi bi-check-lg me-1" aria-hidden="true" />Valider
            </button>
            <button type="button" className="btn btn-outline-danger" onClick={() => ouvrirModale('rejeter', 'Rejeter le contrat')}>
              <i className="bi bi-x-lg me-1" aria-hidden="true" />Rejeter
            </button>
          </>
        )}
        {c.renouvelable && aLeRole('commercial', 'admin') && (
          <button type="button" className="btn btn-primary" onClick={() => envoyer('renouveler', {}, 'Contrat de renouvellement généré')}>
            <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />Renouveler
          </button>
        )}
        {c.statut === 'signe' && aLeRole('commercial', 'admin') && (
          <button type="button" className="btn btn-outline-danger" onClick={() => ouvrirModale('resilier', 'Résilier le contrat')}>
            <i className="bi bi-slash-circle me-1" aria-hidden="true" />Résilier
          </button>
        )}
        <button type="button" className="btn btn-outline-secondary" onClick={() => ouvrirFichier(`/contrats/${c.id}/pdf`, `${c.numero}${c.date_signature ? '-signe' : ''}.pdf`).catch((e) => setEchec(e.message))}>
          <i className="bi bi-download me-1" aria-hidden="true" />Télécharger
        </button>
      </EnTete>
      <Succes message={message} />
      <Erreur message={echec} />
      {['rejete', 'resilie'].includes(c.statut) && c.motif && <div className="alert alert-danger">Motif : {c.motif}</div>}

      <div className="row g-3">
        <div className="col-xl-7">
          <div className="carte">
            <h2 className="carte-titre">{c.date_signature ? 'Contrat signé et scellé' : 'Contrat généré (avant signature)'}</h2>
            <ApercuPdf url={`/contrats/${c.id}/pdf`} titre={`Contrat ${c.numero}`} />
          </div>
        </div>
        <div className="col-xl-5 d-flex flex-column gap-3">
          <div className="carte">
            <h2 className="carte-titre">Circuit de validation</h2>
            <Circuit contrat={c} />
          </div>
          <div className="carte">
            <h2 className="carte-titre">Informations</h2>
            <dl className="mb-0">
              <Info libelle="Sous-agent"><Link to={`/sous-agents/${c.sous_agent.id}`}>{c.sous_agent.prenoms} {c.sous_agent.nom}</Link> {c.sous_agent.code && <span className="reference">({c.sous_agent.code})</span>}</Info>
              <Info libelle="Modèle">{c.modele ? `${c.modele.titre} v${c.modele.version}` : ''}</Info>
              <Info libelle="Durée">{`${c.duree_mois} mois`}</Info>
              {c.precedent && <Info libelle="Renouvelle le contrat"><Link className="reference" to={`/contrats/${c.precedent.id}`}>{c.precedent.numero}</Link></Info>}
            </dl>
          </div>
          <div className="carte">
            <h2 className="carte-titre">Preuve et intégrité</h2>
            <div className="small text-muted mb-1">Empreinte SHA-256 du contrat validé</div>
            <div className="empreinte mb-2">{c.empreinte}</div>
            {c.empreinte_signee && (
              <>
                <div className="small text-muted mb-1">Empreinte SHA-256 du document signé (scellé par la Banque)</div>
                <div className="empreinte mb-2">{c.empreinte_signee}</div>
              </>
            )}
            <button type="button" className="btn btn-outline-primary" onClick={controler}>
              <i className="bi bi-shield-check me-1" aria-hidden="true" />Contrôler l&apos;intégrité du fichier conservé
            </button>
            {integrite && (
              <div className={`verdict ${integre ? 'ok' : 'ko'} mt-3`} role="status">
                <h2 className="h6 mb-1">{integre ? 'Fichier intègre' : 'Fichier altéré'}</h2>
                <div className="small">
                  {integre
                    ? `L'empreinte recalculée correspond à celle enregistrée${integrite.scellement_valide ? ' et le scellement de la Banque est valide' : ''}.`
                    : 'Le fichier conservé ne correspond plus à celui qui a été enregistré : il a été modifié en dehors de l\'application.'}
                </div>
                <div className="small text-muted mt-1">Contrôle effectué le {formatDateHeure(integrite.controle_le)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modale && (
        <Modale
          titre={modale.titre}
          onFermer={() => setModale(null)}
          pied={(
            <>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setModale(null)}>Annuler</button>
              <button
                type="button"
                className={`btn ${modale.action === 'valider' ? 'btn-success' : 'btn-danger'}`}
                disabled={modale.action !== 'valider' && !texte.trim()}
                onClick={() => envoyer(modale.action, modale.action === 'valider' ? { commentaire: texte } : { motif: texte }, {
                  valider: c.statut === 'brouillon' ? 'Contrat validé : il est transmis à la conformité' : 'Contrat validé : le sous-agent est invité à le signer',
                  rejeter: 'Contrat rejeté',
                  resilier: 'Contrat résilié',
                }[modale.action])}
              >
                Confirmer
              </button>
            </>
          )}
        >
          <Champ libelle={modale.action === 'valider' ? 'Commentaire (facultatif)' : 'Motif *'}>
            <textarea className="form-control" rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} />
          </Champ>
          {modale.action === 'valider' && c.statut === 'validation_conformite' && (
            <p className="small text-muted mb-0">Après votre validation, le sous-agent recevra un e-mail l&apos;invitant à signer le contrat en ligne.</p>
          )}
        </Modale>
      )}
    </>
  );
}
