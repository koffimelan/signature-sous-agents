import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import urlTravailleur from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import api from '../api';
import { Chargement } from './Communs';

GlobalWorkerOptions.workerSrc = urlTravailleur;

// Aperçu d'un PDF protégé : le fichier est chargé avec le jeton, puis ses pages sont dessinées
// par pdf.js à la largeur du cadre. Le rendu ne dépend donc plus du lecteur PDF du navigateur
// (celui de Microsoft Edge décalait la page vers la droite dans un cadre étroit).
export default function ApercuPdf({ url, titre }) {
  const [document, setDocument] = useState(null);
  const [lien, setLien] = useState('');
  const [erreur, setErreur] = useState('');
  const [largeur, setLargeur] = useState(0);
  const cadre = useRef(null);
  const pages = useRef(null);

  // Chargement du fichier
  useEffect(() => {
    let adresse = '';
    let annule = false;
    let tache = null;
    setDocument(null);
    setLien('');
    setErreur('');
    api.get(url, { responseType: 'arraybuffer' })
      .then(async (r) => {
        if (annule) return;
        adresse = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
        tache = getDocument({ data: new Uint8Array(r.data), isEvalSupported: false });
        const pdf = await tache.promise;
        if (annule) { pdf.destroy(); return; }
        setLien(adresse);
        setDocument(pdf);
      })
      .catch(() => { if (!annule) setErreur('Le contrat ne peut pas être affiché'); });
    return () => {
      annule = true;
      if (tache) tache.destroy();
      if (adresse) URL.revokeObjectURL(adresse);
    };
  }, [url]);

  // Largeur disponible : les pages sont redessinées quand le cadre change de taille
  useEffect(() => {
    const el = cadre.current;
    if (!el) return undefined;
    let minuteur = null;
    const mesurer = () => {
      clearTimeout(minuteur);
      minuteur = setTimeout(() => setLargeur(Math.floor(el.clientWidth)), 120);
    };
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    mesurer();
    return () => { observateur.disconnect(); clearTimeout(minuteur); };
  }, [document]);

  // Dessin des pages
  useEffect(() => {
    if (!document || !largeur || !pages.current) return undefined;
    let annule = false;
    const conteneur = pages.current;
    const marge = 24;
    const ratio = window.devicePixelRatio || 1;
    (async () => {
      const toiles = [];
      for (let n = 1; n <= document.numPages; n += 1) {
        const page = await document.getPage(n);
        if (annule) return;
        const echelle = Math.max(0.2, (largeur - marge) / page.getViewport({ scale: 1 }).width);
        const vue = page.getViewport({ scale: echelle * ratio });
        const toile = window.document.createElement('canvas');
        toile.width = Math.floor(vue.width);
        toile.height = Math.floor(vue.height);
        toile.style.width = `${Math.floor(vue.width / ratio)}px`;
        toile.style.height = `${Math.floor(vue.height / ratio)}px`;
        toile.setAttribute('role', 'img');
        toile.setAttribute('aria-label', `Page ${n} sur ${document.numPages}`);
        await page.render({ canvasContext: toile.getContext('2d'), viewport: vue }).promise;
        if (annule) return;
        toiles.push(toile);
      }
      conteneur.replaceChildren(...toiles);
    })().catch(() => { if (!annule) setErreur('Le contrat ne peut pas être affiché'); });
    return () => { annule = true; };
  }, [document, largeur]);

  if (erreur) return <div className="alert alert-danger">{erreur}</div>;
  return (
    <div className="apercu-pdf-bloc">
      <div className="apercu-pdf" ref={cadre} role="document" aria-label={titre} tabIndex={0}>
        {!document && <Chargement />}
        <div className="apercu-pdf-pages" ref={pages} />
      </div>
      {document && (
        <div className="apercu-pdf-pied">
          <span>{document.numPages} page{document.numPages > 1 ? 's' : ''}</span>
          <a href={lien} target="_blank" rel="noreferrer">Ouvrir le PDF dans un nouvel onglet</a>
        </div>
      )}
    </div>
  );
}
