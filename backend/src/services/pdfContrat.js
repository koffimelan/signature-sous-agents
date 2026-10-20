const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Logo officiel d'AFG Bank (repris du site afgbankcotedivoire.com), en tête du contrat et du certificat
const LOGO = fs.readFileSync(path.join(__dirname, '../../assets/logo-afg.png'));

// Génération du contrat PDF à partir du modèle, puis apposition de la signature (pdf-lib).
// Police Times, équivalente à Times New Roman, comme les autres documents de la banque
const BLEU = rgb(0, 16 / 255, 81 / 255);
const VERT = rgb(0, 122 / 255, 61 / 255);
const GRIS = rgb(0.33, 0.37, 0.42);
const TEXTE = rgb(0.21, 0.21, 0.21);
const LARGEUR = 595.28; // A4 en points
const HAUTEUR = 841.89;
const MARGE = 56;
const UTILE = LARGEUR - 2 * MARGE;

// Emplacement fixe du bloc de signatures, en bas de la dernière page
const BLOC = { y: 70, hauteur: 140 };
const CASE_SOUS_AGENT = { x: MARGE + UTILE / 2 + 10, y: BLOC.y + 26, largeur: UTILE / 2 - 20, hauteur: 70 };

// Date seule (AAAA-MM-JJ) ou date complète (objet Date, affichée à l'heure d'Abidjan)
const formatDate = (d) => {
  if (!d) return '';
  if (d instanceof Date) return d.toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan' });
  return new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
};
const formatDateHeure = (d) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', dateStyle: 'short', timeStyle: 'medium' });

// Découpe un texte en lignes qui tiennent dans la largeur donnée
function decouper(texte, police, taille, largeur) {
  const lignes = [];
  for (const paragraphe of String(texte).split('\n')) {
    let ligne = '';
    for (const mot of paragraphe.split(/\s+/).filter(Boolean)) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (police.widthOfTextAtSize(essai, taille) <= largeur) ligne = essai;
      else {
        if (ligne) lignes.push(ligne);
        // mot plus long que la ligne (empreinte hexadécimale) : coupé en morceaux
        let reste = mot;
        while (police.widthOfTextAtSize(reste, taille) > largeur) {
          let n = reste.length;
          while (n > 1 && police.widthOfTextAtSize(reste.slice(0, n), taille) > largeur) n -= 1;
          lignes.push(reste.slice(0, n));
          reste = reste.slice(n);
        }
        ligne = reste;
      }
    }
    lignes.push(ligne);
  }
  return lignes;
}

// Petit outil d'écriture qui gère le retour à la ligne et le changement de page
async function redacteur(doc) {
  const polices = {
    normal: await doc.embedFont(StandardFonts.TimesRoman),
    gras: await doc.embedFont(StandardFonts.TimesRomanBold),
    italique: await doc.embedFont(StandardFonts.TimesRomanItalic),
  };
  const r = { doc, polices, logo: await doc.embedPng(LOGO), page: null, y: 0 };
  r.nouvellePage = () => {
    r.page = doc.addPage([LARGEUR, HAUTEUR]);
    r.y = HAUTEUR - MARGE;
  };
  r.place = (hauteur, limite = MARGE + 30) => {
    if (r.y - hauteur < limite) r.nouvellePage();
  };
  r.texte = (texte, { taille = 10, style = 'normal', couleur = TEXTE, interligne = 1.45, alinea = 0, centre = false, apres = 4 } = {}) => {
    const police = polices[style];
    for (const ligne of decouper(texte, police, taille, UTILE - alinea)) {
      r.place(taille * interligne);
      const x = centre ? (LARGEUR - police.widthOfTextAtSize(ligne, taille)) / 2 : MARGE + alinea;
      r.page.drawText(ligne, { x, y: r.y - taille, size: taille, font: police, color: couleur });
      r.y -= taille * interligne;
    }
    r.y -= apres;
  };
  r.filet = (couleur = BLEU, epaisseur = 1) => {
    r.page.drawLine({ start: { x: MARGE, y: r.y }, end: { x: LARGEUR - MARGE, y: r.y }, thickness: epaisseur, color: couleur });
    r.y -= 10;
  };
  return r;
}

function entete(r, numero) {
  const { page, polices, logo } = r;
  // Logo de 32 points de haut, le texte de l'émetteur à sa droite
  const largeurLogo = (logo.width / logo.height) * 32;
  page.drawImage(logo, { x: MARGE, y: HAUTEUR - MARGE - 32, width: largeurLogo, height: 32 });
  const xTexte = MARGE + largeurLogo + 12;
  page.drawText('AFG Bank Côte d\'Ivoire', { x: xTexte, y: HAUTEUR - MARGE - 12, size: 12, font: polices.gras, color: BLEU });
  page.drawText('Direction commerciale - Réseau des sous-agents', { x: xTexte, y: HAUTEUR - MARGE - 26, size: 8.5, font: polices.normal, color: GRIS });
  const ref = `Contrat n° ${numero}`;
  page.drawText(ref, { x: LARGEUR - MARGE - polices.gras.widthOfTextAtSize(ref, 9), y: HAUTEUR - MARGE - 12, size: 9, font: polices.gras, color: BLEU });
  r.y = HAUTEUR - MARGE - 42;
  r.page.drawLine({ start: { x: MARGE, y: r.y }, end: { x: LARGEUR - MARGE, y: r.y }, thickness: 1.5, color: VERT });
  r.y -= 22;
}

function piedsDePage(doc, polices, numero, mention) {
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGE, y: 42 }, end: { x: LARGEUR - MARGE, y: 42 }, thickness: 0.5, color: GRIS });
    p.drawText(mention, { x: MARGE, y: 30, size: 7.5, font: polices.normal, color: GRIS });
    const n = `Contrat ${numero} - page ${i + 1} / ${pages.length}`;
    p.drawText(n, { x: LARGEUR - MARGE - polices.normal.widthOfTextAtSize(n, 7.5), y: 30, size: 7.5, font: polices.normal, color: GRIS });
  });
}

// Contrat généré à partir du modèle (texte déjà rempli) : renvoie le contenu du PDF
async function genererContrat({ numero, titre, texte, dateGeneration }) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Contrat de sous-agent ${numero}`);
  doc.setAuthor('AFG Bank Côte d\'Ivoire');
  doc.setSubject(titre);
  doc.setCreator('Plateforme des contrats des sous-agents');
  doc.setProducer('Plateforme des contrats des sous-agents');
  doc.setCreationDate(dateGeneration);
  doc.setModificationDate(dateGeneration);

  const r = await redacteur(doc);
  r.nouvellePage();
  entete(r, numero);
  r.texte(titre.toUpperCase(), { taille: 14, style: 'gras', couleur: BLEU, centre: true, apres: 14 });

  // Les lignes « Article ... » deviennent des titres ; une ligne vide sépare les paragraphes
  for (const bloc of String(texte).split(/\n\s*\n/)) {
    const contenu = bloc.trim();
    if (!contenu) continue;
    if (/^article\s/i.test(contenu.split('\n')[0])) {
      const [titreArticle, ...reste] = contenu.split('\n');
      r.place(40, BLOC.y + BLOC.hauteur);
      r.texte(titreArticle, { taille: 10.5, style: 'gras', couleur: BLEU, apres: 2 });
      if (reste.length) r.texte(reste.join('\n'), { apres: 8 });
    } else {
      r.texte(contenu, { apres: 8 });
    }
  }

  // Bloc des signatures, toujours au même endroit en bas de la dernière page
  if (r.y < BLOC.y + BLOC.hauteur + 10) r.nouvellePage();
  const { page, polices } = r;
  const fait = `Fait à Abidjan, le ${formatDate(dateGeneration)}, en un exemplaire électronique original conservé par la Banque.`;
  page.drawText(fait, { x: MARGE, y: BLOC.y + BLOC.hauteur - 10, size: 9, font: polices.italique, color: TEXTE });
  const colonnes = [
    { x: MARGE, titre: 'Pour AFG Bank Côte d\'Ivoire', sous: 'Cachet électronique de la Banque' },
    { x: MARGE + UTILE / 2 + 10, titre: 'Le Sous-agent', sous: 'Lu et approuvé - signature électronique' },
  ];
  for (const c of colonnes) {
    page.drawText(c.titre, { x: c.x, y: BLOC.y + 112, size: 9.5, font: polices.gras, color: BLEU });
    page.drawText(c.sous, { x: c.x, y: BLOC.y + 100, size: 8, font: polices.normal, color: GRIS });
    page.drawRectangle({ x: c.x, y: BLOC.y + 26, width: UTILE / 2 - 20, height: 70, borderColor: GRIS, borderWidth: 0.6, borderDashArray: [3, 2] });
  }
  piedsDePage(doc, polices, numero, 'Document généré par la plateforme des contrats des sous-agents - à signer électroniquement');
  return Buffer.from(await doc.save());
}

// Signature : image tracée par le sous-agent, mention du cachet et page « certificat de signature »
async function apposerSignature(pdf, { numero, signataire, piece, image, date, ip, canal, destination, empreinteValidee, certificat }) {
  const doc = await PDFDocument.load(pdf);
  doc.setModificationDate(date);
  doc.setKeywords([numero, 'signé électroniquement', `empreinte du contrat validé : ${empreinteValidee}`]);
  const polices = {
    normal: await doc.embedFont(StandardFonts.TimesRoman),
    gras: await doc.embedFont(StandardFonts.TimesRomanBold),
  };
  const pages = doc.getPages();
  const derniere = pages[pages.length - 1];

  // Signature manuscrite tracée à l'écran, ajustée dans la case du sous-agent
  const png = await doc.embedPng(image);
  const echelle = Math.min((CASE_SOUS_AGENT.largeur - 10) / png.width, (CASE_SOUS_AGENT.hauteur - 18) / png.height);
  const l = png.width * echelle;
  const h = png.height * echelle;
  derniere.drawImage(png, { x: CASE_SOUS_AGENT.x + (CASE_SOUS_AGENT.largeur - l) / 2, y: CASE_SOUS_AGENT.y + 14 + (CASE_SOUS_AGENT.hauteur - 18 - h) / 2, width: l, height: h });
  derniere.drawText(`${signataire} - ${formatDateHeure(date)}`, { x: CASE_SOUS_AGENT.x + 5, y: CASE_SOUS_AGENT.y + 5, size: 7, font: polices.normal, color: GRIS });

  // Mention du cachet de la banque
  const xb = MARGE + 6;
  derniere.drawText('Scellé électroniquement par', { x: xb, y: BLOC.y + 78, size: 8, font: polices.normal, color: GRIS });
  derniere.drawText('AFG Bank Côte d\'Ivoire', { x: xb, y: BLOC.y + 64, size: 11, font: polices.gras, color: VERT });
  derniere.drawText(`Certificat n° ${certificat.numero_serie}`, { x: xb, y: BLOC.y + 50, size: 7.5, font: polices.normal, color: GRIS });
  derniere.drawText(`le ${formatDateHeure(date)}`, { x: xb, y: BLOC.y + 38, size: 7.5, font: polices.normal, color: GRIS });

  // Page de preuve : certificat de signature
  const r = await redacteur(doc);
  r.nouvellePage();
  entete(r, numero);
  r.texte('CERTIFICAT DE SIGNATURE ÉLECTRONIQUE', { taille: 13, style: 'gras', couleur: BLEU, centre: true, apres: 12 });
  const lignes = [
    ['Contrat', numero],
    ['Signataire', signataire],
    ['Pièce d\'identité', piece],
    ['Date et heure de signature', `${formatDateHeure(date)} (heure d'Abidjan, GMT)`],
    ['Adresse IP du signataire', ip || 'non disponible'],
    ['Authentification du signataire', `Code à usage unique (OTP) envoyé par ${canal === 'sms' ? 'SMS' : 'e-mail'} à ${destination}, saisi avec succès`],
    ['Consentement', 'Le signataire a déclaré avoir lu le contrat et en accepter les termes avant de signer'],
    ['Empreinte SHA-256 du contrat validé', empreinteValidee],
    ['Cachet de la Banque', `${certificat.titulaire} (${certificat.organisation})`],
    ['Certificat du cachet', `n° ${certificat.numero_serie}, valable jusqu'au ${formatDate(certificat.valable_jusqu_au)}, ${certificat.algorithme}`],
  ];
  for (const [libelle, valeur] of lignes) {
    r.place(30);
    r.texte(libelle, { taille: 8.5, style: 'gras', couleur: GRIS, apres: 0 });
    r.texte(valeur, { taille: 10, apres: 7 });
  }
  r.y -= 6;
  r.filet(GRIS, 0.5);
  r.texte('L\'empreinte SHA-256 du présent document signé et son scellement par la clé privée de la Banque sont conservés '
    + 'dans la plateforme. Toute modification du fichier, même d\'un seul caractère, change son empreinte : elle est '
    + 'détectée lors de la vérification du document sur la plateforme (menu « Vérifier un contrat »).', { taille: 9, couleur: GRIS });
  r.texte('Procédé mis en œuvre : identification du signataire par code à usage unique, empreinte SHA-256 du document '
    + 'et scellement RSA par le cachet électronique de la Banque.', { taille: 9, couleur: GRIS });

  // Pied de la nouvelle page
  // (page ajoutée après la numérotation du contrat : elle est présentée comme une annexe)
  const p = r.page;
  p.drawLine({ start: { x: MARGE, y: 42 }, end: { x: LARGEUR - MARGE, y: 42 }, thickness: 0.5, color: GRIS });
  p.drawText('Annexe au contrat - document scellé', { x: MARGE, y: 30, size: 7.5, font: polices.normal, color: GRIS });
  const n = `Contrat ${numero} - certificat de signature`;
  p.drawText(n, { x: LARGEUR - MARGE - polices.normal.widthOfTextAtSize(n, 7.5), y: 30, size: 7.5, font: polices.normal, color: GRIS });

  return Buffer.from(await doc.save());
}

module.exports = { genererContrat, apposerSignature };
