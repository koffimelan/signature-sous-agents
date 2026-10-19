import { Champ } from './Communs';
import { TYPES_IDENTITE } from '../libelles';

export const CHAMPS_DOSSIER = ['civilite', 'nom', 'prenoms', 'date_naissance', 'lieu_naissance', 'nationalite', 'type_piece', 'numero_piece',
  'telephone', 'email', 'adresse', 'ville', 'commune', 'activite', 'zone'];

// Informations d'état civil et d'activité du sous-agent (formulaire partagé par le candidat et le commercial)
export default function FormulaireDossier({ valeurs, onChange, desactive, emailModifiable = false }) {
  const maj = (champ) => (e) => onChange({ ...valeurs, [champ]: e.target.value });
  const v = (champ) => valeurs[champ] ?? '';
  return (
    <fieldset disabled={desactive}>
      <legend className="carte-titre">Identité</legend>
      <div className="row">
        <div className="col-md-2">
          <Champ libelle="Civilité">
            <select className="form-select" value={v('civilite')} onChange={maj('civilite')}>
              <option value="">-</option><option>M.</option><option>Mme</option>
            </select>
          </Champ>
        </div>
        <div className="col-md-4"><Champ libelle="Nom *"><input className="form-control" required value={v('nom')} onChange={maj('nom')} /></Champ></div>
        <div className="col-md-6"><Champ libelle="Prénoms *"><input className="form-control" required value={v('prenoms')} onChange={maj('prenoms')} /></Champ></div>
      </div>
      <div className="row">
        <div className="col-md-4"><Champ libelle="Date de naissance *"><input type="date" className="form-control" value={v('date_naissance')} onChange={maj('date_naissance')} /></Champ></div>
        <div className="col-md-4"><Champ libelle="Lieu de naissance"><input className="form-control" value={v('lieu_naissance')} onChange={maj('lieu_naissance')} /></Champ></div>
        <div className="col-md-4"><Champ libelle="Nationalité"><input className="form-control" value={v('nationalite')} onChange={maj('nationalite')} /></Champ></div>
      </div>
      <div className="row">
        <div className="col-md-5">
          <Champ libelle="Pièce d'identité">
            <select className="form-select" value={v('type_piece') || 'cni'} onChange={maj('type_piece')}>
              {Object.entries(TYPES_IDENTITE).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </Champ>
        </div>
        <div className="col-md-7"><Champ libelle="Numéro de la pièce *"><input className="form-control" value={v('numero_piece')} onChange={maj('numero_piece')} /></Champ></div>
      </div>

      <legend className="carte-titre mt-2">Coordonnées et activité</legend>
      <div className="row">
        <div className="col-md-5"><Champ libelle="Téléphone *"><input type="tel" className="form-control" required value={v('telephone')} onChange={maj('telephone')} /></Champ></div>
        <div className="col-md-7">
          <Champ libelle="Adresse e-mail" aide={emailModifiable ? '' : 'Adresse de votre compte : elle recevra le code de signature.'}>
            <input type="email" className="form-control" value={v('email')} onChange={maj('email')} readOnly={!emailModifiable} />
          </Champ>
        </div>
      </div>
      <Champ libelle="Adresse *"><input className="form-control" value={v('adresse')} onChange={maj('adresse')} placeholder="Quartier, rue, lot" /></Champ>
      <div className="row">
        <div className="col-md-6"><Champ libelle="Commune"><input className="form-control" value={v('commune')} onChange={maj('commune')} /></Champ></div>
        <div className="col-md-6"><Champ libelle="Ville *"><input className="form-control" value={v('ville')} onChange={maj('ville')} /></Champ></div>
      </div>
      <div className="row">
        <div className="col-md-6"><Champ libelle="Activité exercée actuellement"><input className="form-control" value={v('activite')} onChange={maj('activite')} placeholder="Commerce, cabine de transfert..." /></Champ></div>
        <div className="col-md-6"><Champ libelle="Zone de prospection prévue *"><input className="form-control" value={v('zone')} onChange={maj('zone')} /></Champ></div>
      </div>
    </fieldset>
  );
}
