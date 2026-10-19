import { useEffect, useState } from 'react';
import api from '../api';
import { Chargement } from './Communs';

// Aperçu d'un PDF protégé : le fichier est chargé avec le jeton puis affiché dans un cadre
export default function ApercuPdf({ url, titre }) {
  const [lien, setLien] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let adresse = '';
    let annule = false;
    setLien('');
    api.get(url, { responseType: 'blob' })
      .then((r) => {
        adresse = URL.createObjectURL(r.data);
        if (!annule) setLien(adresse);
      })
      .catch(() => setErreur('Le contrat ne peut pas être affiché'));
    return () => {
      annule = true;
      if (adresse) URL.revokeObjectURL(adresse);
    };
  }, [url]);

  if (erreur) return <div className="alert alert-danger">{erreur}</div>;
  if (!lien) return <Chargement />;
  return <iframe className="apercu-pdf" src={lien} title={titre} />;
}
