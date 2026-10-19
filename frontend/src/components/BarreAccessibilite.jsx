import { useEffect, useId, useRef, useState } from 'react';
import {
  TAILLES, TAILLE_DEFAUT, lirePreferences, enregistrerPreferences, appliquerPreferences,
} from '../accessibilite';

// Bouton « Accessibilité » : taille du texte (A- / A / A+) et contraste élevé
export default function BarreAccessibilite({ flottante = false }) {
  const [ouvert, setOuvert] = useState(false);
  const [prefs, setPrefs] = useState(lirePreferences);
  const idPanneau = useId();
  const conteneur = useRef(null);

  useEffect(() => {
    appliquerPreferences(prefs);
    enregistrerPreferences(prefs);
  }, [prefs]);

  // Échap referme le panneau et rend le focus au bouton
  useEffect(() => {
    if (!ouvert) return undefined;
    const surTouche = (e) => {
      if (e.key === 'Escape') {
        setOuvert(false);
        conteneur.current?.querySelector('.accessibilite-bouton')?.focus();
      }
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [ouvert]);

  const min = TAILLES[0].niveau;
  const max = TAILLES[TAILLES.length - 1].niveau;
  const pourcentage = TAILLES.find((t) => t.niveau === prefs.taille).pourcentage;
  const changerTaille = (taille) => setPrefs((p) => ({ ...p, taille }));

  return (
    <div className={`accessibilite ${flottante ? 'flottante' : ''}`} ref={conteneur}>
      <button
        type="button"
        className="accessibilite-bouton"
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        onClick={() => setOuvert((o) => !o)}
      >
        <i className="bi bi-universal-access-circle fs-5" aria-hidden="true" />
        Accessibilité
        <i className={`bi bi-chevron-${ouvert ? 'up' : 'down'} ms-auto`} aria-hidden="true" />
      </button>

      {ouvert && (
        <div id={idPanneau} className="accessibilite-panneau" role="group" aria-label="Réglages d'accessibilité">
          <div className="groupe-titre">Taille du texte</div>
          <div className="accessibilite-tailles">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => changerTaille(Math.max(min, prefs.taille - 1))}
              disabled={prefs.taille === min}
              title="Réduire la taille du texte"
              aria-label="Réduire la taille du texte"
            >A-</button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => changerTaille(TAILLE_DEFAUT)}
              title="Taille du texte normale"
              aria-label="Taille du texte normale"
              aria-pressed={prefs.taille === TAILLE_DEFAUT}
            >A</button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => changerTaille(Math.min(max, prefs.taille + 1))}
              disabled={prefs.taille === max}
              title="Agrandir la taille du texte"
              aria-label="Agrandir la taille du texte"
            ><span style={{ fontSize: '1.15em' }}>A+</span></button>
          </div>
          <p className="small mt-1 mb-3" aria-live="polite">Taille actuelle : {String(pourcentage).replace('.', ',')} %</p>

          <button
            type="button"
            role="switch"
            aria-checked={prefs.contraste}
            className="interrupteur"
            onClick={() => setPrefs((p) => ({ ...p, contraste: !p.contraste }))}
          >
            <span><i className="bi bi-circle-half me-2" aria-hidden="true" />Contraste élevé</span>
            <span className="etat" aria-hidden="true">{prefs.contraste ? 'Activé' : 'Désactivé'}</span>
          </button>

          <button
            type="button"
            className="btn btn-link w-100 mt-2"
            onClick={() => setPrefs({ taille: TAILLE_DEFAUT, contraste: false })}
          >
            Rétablir l&apos;affichage par défaut
          </button>
        </div>
      )}
    </div>
  );
}
