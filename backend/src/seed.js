// Données de démonstration : comptes de chaque rôle, modèle de contrat et dossiers à toutes les étapes.
// Les personnes et numéros ci-dessous sont fictifs.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const {
  sequelize, Utilisateur, SousAgent, PieceJustificative, ModeleContrat, Validation, Journal,
} = require('./models');
const stockage = require('./services/stockage');
const { creerContrat, signerContrat } = require('./services/contrats');
const { controlerEcheances } = require('./services/alertes');

const MDP = process.env.SEED_PASSWORD;
const JOUR = 864e5;
const ilYa = (jours, heure = 10) => { const d = new Date(Date.now() - jours * JOUR); d.setHours(heure, 12, 0, 0); return d; };
const apres = (date, heures) => new Date(date.getTime() + heures * 3600e3);
const dateISO = (d) => d.toISOString().slice(0, 10);

const CONTENU = `Entre les soussignés :
AFG Bank Côte d'Ivoire, société anonyme agréée en qualité de banque, dont le siège est à Abidjan, représentée par son Directeur commercial, ci-après dénommée « la Banque », d'une part ;
Et {{civilite}} {{prenoms}} {{nom}}, né(e) le {{date_naissance}} à {{lieu_naissance}}, de nationalité {{nationalite}}, titulaire de la {{type_piece}} n° {{numero_piece}}, demeurant à {{adresse}}, {{commune}}, {{ville}}, joignable au {{telephone}} et à l'adresse {{email}}, ci-après dénommé(e) « le Sous-agent », d'autre part.

Article 1 - Objet
Le présent contrat a pour objet de définir les conditions dans lesquelles le Sous-agent, sous le code {{code_sous_agent}}, présente et commercialise pour le compte de la Banque les produits et services énumérés à l'article 3, dans la zone de prospection suivante : {{zone}}.

Article 2 - Statut du Sous-agent
Le Sous-agent exerce son activité de manière indépendante. Le présent contrat ne crée aucun lien de subordination entre la Banque et le Sous-agent, qui organise librement son activité dans le respect des procédures de la Banque.

Article 3 - Produits et services commercialisés
Le Sous-agent est habilité à présenter l'ouverture de comptes de dépôt, les cartes bancaires, les offres de crédit et les services de banque digitale de la Banque. Il recueille les dossiers des clients et les transmet à l'agence de rattachement ; il n'est pas habilité à conclure seul un contrat au nom de la Banque.

Article 4 - Obligations du Sous-agent
Le Sous-agent s'engage à identifier chaque client selon les procédures de connaissance de la clientèle de la Banque, à respecter les règles de lutte contre le blanchiment de capitaux et le financement du terrorisme, à n'encaisser aucun fonds en dehors des procédures prévues, à remettre aux clients une information exacte sur les produits et à préserver la confidentialité des informations recueillies.

Article 5 - Obligations de la Banque
La Banque s'engage à former le Sous-agent aux produits et aux procédures, à lui fournir les supports commerciaux nécessaires, à traiter dans les meilleurs délais les dossiers transmis et à verser les commissions dues dans les conditions de l'article 6.

Article 6 - Rémunération
En contrepartie de son activité, le Sous-agent perçoit une commission ainsi définie : {{taux_commission}}. Les commissions sont calculées chaque mois sur la base des opérations effectivement réalisées et versées sur le compte du Sous-agent ouvert dans les livres de la Banque.

Article 7 - Durée
Le présent contrat, référencé {{numero_contrat}}, est conclu pour une durée de {{duree_mois}} mois, du {{date_debut}} au {{date_fin}}. Il peut être renouvelé par la signature d'un nouveau contrat avant son échéance.

Article 8 - Données à caractère personnel
Les données personnelles du Sous-agent et des clients sont traitées conformément à la loi n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel. Le Sous-agent s'interdit toute utilisation de ces données à d'autres fins que l'exécution du présent contrat.

Article 9 - Résiliation
Chaque partie peut mettre fin au contrat moyennant un préavis de trente (30) jours notifié par écrit. En cas de manquement grave du Sous-agent, notamment aux obligations de l'article 4, la Banque peut résilier le contrat sans préavis.

Article 10 - Signature électronique
Les parties conviennent de signer le présent contrat par voie électronique, conformément à la loi n° 2013-546 du 30 juillet 2013 relative aux transactions électroniques. La signature du Sous-agent est authentifiée par un code à usage unique ; le document signé est scellé par le cachet électronique de la Banque et son intégrité peut être vérifiée à tout moment.

Article 11 - Règlement des litiges
Les parties s'efforcent de régler à l'amiable tout différend né de l'exécution du présent contrat. À défaut, le litige est porté devant les juridictions compétentes d'Abidjan.`;

// Petite image PNG (signature tracée) générée sans bibliothèque
function signaturePng(graine) {
  const L = 360; const H = 120; const pas = L * 3 + 1;
  const pixels = Buffer.alloc(pas * H, 255);
  for (let y = 0; y < H; y += 1) pixels[y * pas] = 0; // octet de filtre PNG de chaque ligne
  const point = (x, y) => {
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
      const px = Math.round(x) + dx; const py = Math.round(y) + dy;
      if (px > 0 && px < L && py > 0 && py < H) pixels.fill(20, py * pas + 1 + px * 3, py * pas + 1 + px * 3 + 3);
    }
  };
  for (let t = 0; t < 1; t += 0.0008) {
    const x = 25 + t * 310;
    point(x, 62 + 26 * Math.sin(t * (9 + graine)) * Math.cos(t * 3 + graine) - 14 * Math.sin(t * 31));
  }
  const bloc = (type, donnees) => {
    const t = Buffer.from(type); const n = Buffer.alloc(4); n.writeUInt32BE(donnees.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(Buffer.concat([t, donnees])));
    return Buffer.concat([n, t, donnees, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(L, 0); ihdr.writeUInt32BE(H, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(pixels)), bloc('IEND', Buffer.alloc(0))]);
}

// Pièce justificative de démonstration (PDF d'une page)
async function pieceDemo(libelle, sa) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 280]);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 10, y: 10, width: 400, height: 260, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 1 });
  page.drawText('DOCUMENT DE DÉMONSTRATION', { x: 30, y: 235, size: 13, font: gras, color: rgb(0.77, 0, 0) });
  page.drawText(libelle, { x: 30, y: 205, size: 12, font: gras });
  page.drawText(`${sa.prenoms} ${sa.nom}`, { x: 30, y: 180, size: 11, font: normal });
  page.drawText(`Pièce n° ${sa.numero_piece}`, { x: 30, y: 160, size: 11, font: normal });
  page.drawText('Fichier fictif fourni avec les données de test.', { x: 30, y: 40, size: 9, font: normal });
  return Buffer.from(await doc.save());
}

const LIBELLES = { cni: 'Copie de la pièce d\'identité', photo: 'Photo d\'identité', justificatif_domicile: 'Justificatif de domicile', registre_commerce: 'Registre du commerce' };

async function ajouterPieces(sa, types = ['cni', 'photo', 'justificatif_domicile']) {
  for (const type of types) {
    const contenu = await pieceDemo(LIBELLES[type], sa);
    await PieceJustificative.create({
      sous_agent_id: sa.id, type, nom_origine: `${type}_${sa.nom.toLowerCase()}.pdf`, fichier: stockage.enregistrer('pieces', contenu, '.pdf'),
      type_mime: 'application/pdf', taille: contenu.length, empreinte: stockage.empreinte(contenu),
    });
  }
}

const SOUS_AGENTS = [
  // [compte, données du dossier, scénario]
  ['aya.kouassi@exemple.ci', { civilite: 'Mme', nom: 'KOUASSI', prenoms: 'Aya Marie', date_naissance: '1994-03-08', lieu_naissance: 'Bouaké', numero_piece: 'CI0021458730', telephone: '0707112233', adresse: 'Cité Sicogi, rue 12', commune: 'Yopougon', ville: 'Abidjan', activite: 'Commerce de détail', zone: 'Yopougon Selmer et Niangon' }, { signe: 158, depot: 160 }],
  ['serge.nguessan@exemple.ci', { civilite: 'M.', nom: 'N\'GUESSAN', prenoms: 'Yao Serge', date_naissance: '1988-11-21', lieu_naissance: 'Dimbokro', numero_piece: 'CI0019874521', telephone: '0505667788', adresse: 'Quartier Commerce', commune: 'Plateau', ville: 'Bouaké', activite: 'Cabine de transfert d\'argent', zone: 'Bouaké centre' }, { signe: 342, depot: 345, debut: 344 }],
  ['fatou.traore@exemple.ci', { civilite: 'Mme', nom: 'TRAORÉ', prenoms: 'Fatou', date_naissance: '1991-06-02', lieu_naissance: 'Korhogo', numero_piece: 'CI0023369014', telephone: '0102334455', adresse: 'Avenue de la Paix', commune: 'Koko', ville: 'Korhogo', activite: 'Vente de téléphones et accessoires', zone: 'Korhogo et environs' }, { signe: 45, depot: 46 }],
  ['moussa.ouattara@exemple.ci', { civilite: 'M.', nom: 'OUATTARA', prenoms: 'Moussa', date_naissance: '1985-01-17', lieu_naissance: 'Odienné', numero_piece: 'CI0017745236', telephone: '0708990011', adresse: 'Rue du marché', commune: 'Abobo', ville: 'Abidjan', activite: 'Quincaillerie', zone: 'Abobo Avocatier' }, { signe: 400, depot: 402, debut: 395 }],
  ['sousagent@contrats.local', { civilite: 'M.', nom: 'ASSI', prenoms: 'Koffi Jean-Marc', date_naissance: '1996-09-30', lieu_naissance: 'Abengourou', numero_piece: 'CI0025512367', telephone: '0709123456', adresse: 'Lot 45, Riviera Palmeraie', commune: 'Cocody', ville: 'Abidjan', activite: 'Agent de transfert d\'argent mobile', zone: 'Cocody Riviera et Bingerville' }, { aSigner: true, depot: 3 }],
  ['mariam.diabate@exemple.ci', { civilite: 'Mme', nom: 'DIABATÉ', prenoms: 'Mariam', date_naissance: '1993-12-11', lieu_naissance: 'Séguéla', numero_piece: 'CI0022231478', telephone: '0506778899', adresse: 'Rue des Écoles', commune: 'Treichville', ville: 'Abidjan', activite: 'Boutique de cosmétiques', zone: 'Treichville et Marcory' }, { conformite: true, depot: 2 }],
  ['ibrahim.kone@exemple.ci', { civilite: 'M.', nom: 'KONÉ', prenoms: 'Ibrahim', date_naissance: '1990-04-25', lieu_naissance: 'Man', numero_piece: 'CI0020014785', telephone: '0103445566', adresse: 'Quartier Domoraud', commune: 'Man', ville: 'Man', activite: 'Commerce général', zone: 'Man et Danané' }, { brouillon: true, depot: 1 }],
  ['estelle.yao@exemple.ci', { civilite: 'Mme', nom: 'YAO', prenoms: 'Adjoua Estelle', date_naissance: '1997-02-14', lieu_naissance: 'Yamoussoukro', numero_piece: 'CI0026698741', telephone: '0707445566', adresse: 'Quartier Habitat', commune: 'Yamoussoukro', ville: 'Yamoussoukro', activite: 'Cybercafé', zone: 'Yamoussoukro centre' }, { soumis: true, depot: 0.2 }],
  ['didier.bamba@exemple.ci', { civilite: 'M.', nom: 'BAMBA', prenoms: 'Didier', telephone: '0504112233', ville: 'San-Pédro' }, { incomplet: true }],
  ['christelle.gbane@exemple.ci', { civilite: 'Mme', nom: 'GBANÉ', prenoms: 'Christelle', date_naissance: '1999-08-19', lieu_naissance: 'Daloa', numero_piece: 'CI0027785412', telephone: '0102998877', adresse: 'Quartier Lobia', commune: 'Daloa', ville: 'Daloa', activite: 'Vente de pagnes', zone: 'Daloa' }, { rejete: 'Justificatif de domicile illisible : merci de fournir une facture d\'électricité récente', depot: 6 }],
];

async function seed() {
  if (!MDP) throw new Error('SEED_PASSWORD manquant dans le fichier .env');
  await sequelize.sync({ force: true });
  // Fichiers des anciens dossiers et contrats de démonstration
  for (const d of ['pieces', 'contrats']) {
    const dossier = path.resolve(__dirname, '..', process.env.STOCKAGE_DIR || 'stockage', d);
    if (fs.existsSync(dossier)) for (const f of fs.readdirSync(dossier)) fs.rmSync(path.join(dossier, f), { force: true });
  }

  const admin = await Utilisateur.create({ nom: 'DIOMANDÉ', prenoms: 'Alain', email: 'admin@contrats.local', role: 'admin', mot_de_passe: MDP });
  const commercial = await Utilisateur.create({ nom: 'KOUAMÉ', prenoms: 'Brigitte', email: 'commercial@contrats.local', telephone: '0707000102', role: 'commercial', mot_de_passe: MDP });
  await Utilisateur.create({ nom: 'SORO', prenoms: 'Lassina', email: 'commercial2@contrats.local', role: 'commercial', mot_de_passe: MDP });
  const conformite = await Utilisateur.create({ nom: 'AKA', prenoms: 'Nadège', email: 'conformite@contrats.local', role: 'conformite', mot_de_passe: MDP });

  const modele = await ModeleContrat.create({
    titre: 'Contrat de sous-agent bancaire (modèle de démonstration)', version: '2.0', duree_mois: 12, taux_commission: '2 000 FCFA par compte ouvert et actif, 1 % du montant des crédits mis en place', contenu: CONTENU,
  });
  await ModeleContrat.create({
    titre: 'Contrat de sous-agent bancaire (modèle de démonstration)', version: '1.0', duree_mois: 12, taux_commission: '1 500 FCFA par compte ouvert', contenu: CONTENU, actif: false,
  });

  let graine = 1;
  for (const [email, donnees, s] of SOUS_AGENTS) {
    const compte = await Utilisateur.create({ nom: donnees.nom, prenoms: donnees.prenoms, email, telephone: donnees.telephone, role: 'sous_agent', mot_de_passe: MDP });
    const sa = await SousAgent.create({ ...donnees, email, utilisateur_id: compte.id, statut: 'brouillon' });
    if (s.incomplet) { await ajouterPieces(sa, ['photo']); continue; }
    await ajouterPieces(sa);
    // Chronologie : dépôt, décision 5 h plus tard, contrat généré 1 h après, validations, puis signature
    const depot = ilYa(s.depot, 9);
    const decision = apres(depot, s.rejete ? 24 : 5);
    await sa.update({ statut: 'soumis', date_soumission: depot });
    if (s.soumis) continue;
    if (s.rejete) { await sa.update({ statut: 'rejete', motif_rejet: s.rejete, date_decision: decision, decide_par: commercial.id }); continue; }
    await sa.update({ statut: 'admis', code: `SA-${String(sa.id).padStart(5, '0')}`, date_decision: decision, decide_par: commercial.id });

    const debut = dateISO(new Date(Date.now() - (s.debut ?? (s.signe ? s.signe - 2 : -5)) * JOUR));
    const genere = apres(decision, 1);
    const contrat = await creerContrat({ sousAgent: sa, modele, debut, auteurId: commercial.id, maintenant: genere });
    await sequelize.query('UPDATE contrat SET created_at = ?, updated_at = ? WHERE id = ?', { replacements: [genere, genere, contrat.id] });
    if (s.brouillon) continue;
    await Validation.create({ contrat_id: contrat.id, etape: 'commercial', decision: 'valide', commentaire: 'Dossier complet et pièces vérifiées', utilisateur_id: commercial.id, date: apres(genere, 2) });
    await contrat.update({ statut: 'validation_conformite' });
    if (s.conformite) continue;
    await Validation.create({ contrat_id: contrat.id, etape: 'conformite', decision: 'valide', commentaire: 'Contrôles LBC/FT effectués', utilisateur_id: conformite.id, date: apres(genere, 20) });
    await contrat.update({ statut: 'a_signer' });
    if (s.aSigner) continue;

    await contrat.reload({ include: ['sous_agent'] });
    const date = ilYa(s.signe, 11);
    const signe = await signerContrat(contrat, {
      image: signaturePng(graine += 1.3), date, ip: '41.207.23.118', canal: 'email', destination: email.replace(/^(.).*(.)@/, '$1***$2@'),
    });
    await contrat.update({ ...signe, statut: 'signe', date_signature: date, ip_signature: '41.207.23.118' });
    await sa.update({ statut: 'actif' });
  }

  // Alertes d'échéance et expiration des contrats arrivés à terme
  const r = await controlerEcheances();
  await Journal.create({ utilisateur_id: admin.id, action: 'Initialisation des données de démonstration' });
  console.log(`Données de démonstration créées : ${SOUS_AGENTS.length} dossiers, ${r.alertes} alerte(s), ${r.expires} contrat(s) expiré(s).`);
  console.log('Comptes : admin@contrats.local, commercial@contrats.local, conformite@contrats.local, sousagent@contrats.local (mot de passe : SEED_PASSWORD du fichier .env)');
}

seed()
  .then(() => sequelize.close())
  .catch((err) => {
    console.error('Échec :', err);
    process.exit(1);
  });
