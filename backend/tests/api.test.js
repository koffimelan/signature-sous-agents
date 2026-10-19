// Tests d'intégration de l'API sur une base SQLite en mémoire (recréée à chaque exécution)
const os = require('os');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const temporaire = fs.mkdtempSync(path.join(os.tmpdir(), 'contrats-test-'));
process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.JWT_SECRET = 'secret-de-test';
process.env.STOCKAGE_DIR = path.join(temporaire, 'stockage');
process.env.CLES_DIR = path.join(temporaire, 'cles');
process.env.OTP_AFFICHER_CODE = 'oui';

const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const app = require('../src/app');
const { sequelize, Utilisateur, ModeleContrat, Contrat, CodeOtp } = require('../src/models');
const stockage = require('../src/services/stockage');
const { controlerEcheances } = require('../src/services/alertes');

const MDP = 'MotDePasseTest1';
const jetons = {};
let modele;
let dossierId;
let contratId;
let pdfSigne;

// Image PNG minimale (signature tracée) construite sans bibliothèque
function imagePng(largeur = 120, hauteur = 40) {
  const lignes = Buffer.alloc((largeur * 3 + 1) * hauteur, 255);
  for (let y = 0; y < hauteur; y += 1) lignes[y * (largeur * 3 + 1)] = 0; // octet de filtre de chaque ligne
  for (let x = 10; x < largeur - 10; x += 1) {
    const y = Math.round(hauteur / 2 + 8 * Math.sin(x / 9));
    lignes.fill(0, y * (largeur * 3 + 1) + 1 + x * 3, y * (largeur * 3 + 1) + 1 + x * 3 + 3);
  }
  const bloc = (type, donnees) => {
    const t = Buffer.from(type);
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, donnees])));
    return Buffer.concat([longueur, t, donnees, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const png = Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'), bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(lignes)), bloc('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}
const PDF_PIECE = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');

async function connexion(email) {
  const res = await request(app).post('/api/auth/login').send({ email, mot_de_passe: MDP });
  return res.body.jeton;
}
const avec = (qui) => ({ Authorization: `Bearer ${jetons[qui]}` });

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await Utilisateur.create({ nom: 'A', prenoms: 'Admin', email: 'admin@test.ci', role: 'admin', mot_de_passe: MDP });
  await Utilisateur.create({ nom: 'C', prenoms: 'Commercial', email: 'commercial@test.ci', role: 'commercial', mot_de_passe: MDP });
  await Utilisateur.create({ nom: 'K', prenoms: 'Conformité', email: 'conformite@test.ci', role: 'conformite', mot_de_passe: MDP });
  modele = await ModeleContrat.create({
    titre: 'Contrat de sous-agent bancaire', duree_mois: 12, taux_commission: '1 % des dépôts collectés',
    contenu: 'Entre AFG Bank Côte d\'Ivoire et {{civilite}} {{prenoms}} {{nom}}, titulaire de la {{type_piece}} n° {{numero_piece}}.\n\nArticle 1 - Objet\nLe Sous-agent commercialise les produits de la Banque dans la zone suivante : {{zone}}.\n\nArticle 2 - Durée\nDu {{date_debut}} au {{date_fin}} ({{duree_mois}} mois).',
  });
  jetons.admin = await connexion('admin@test.ci');
  jetons.commercial = await connexion('commercial@test.ci');
  jetons.conformite = await connexion('conformite@test.ci');
});

afterAll(async () => {
  await sequelize.close();
  fs.rmSync(temporaire, { recursive: true, force: true });
});

describe('Authentification et rôles', () => {
  test('mauvais mot de passe refusé', async () => {
    expect((await request(app).post('/api/auth/login').send({ email: 'admin@test.ci', mot_de_passe: 'faux' })).status).toBe(401);
  });
  test('accès sans jeton refusé', async () => {
    expect((await request(app).get('/api/contrats')).status).toBe(401);
  });
  test('un candidat crée son compte en ligne', async () => {
    const res = await request(app).post('/api/auth/inscription').send({
      nom: 'Kouassi', prenoms: 'Aya Marie', email: 'aya@test.ci', telephone: '0707000001', mot_de_passe: MDP,
    });
    expect(res.status).toBe(201);
    expect(res.body.utilisateur.role).toBe('sous_agent');
    jetons.sa = res.body.jeton;
  });
  test('e-mail déjà utilisé refusé', async () => {
    const res = await request(app).post('/api/auth/inscription').send({ nom: 'X', prenoms: 'Y', email: 'aya@test.ci', telephone: '01', mot_de_passe: MDP });
    expect(res.status).toBe(409);
  });
  test('un sous-agent ne peut pas ouvrir la liste des candidatures', async () => {
    expect((await request(app).get('/api/sous-agents').set(avec('sa'))).status).toBe(403);
  });
  test('un sous-agent ne peut pas ouvrir le journal d\'audit', async () => {
    expect((await request(app).get('/api/journal').set(avec('sa'))).status).toBe(403);
  });
});

describe('RG1 - dépôt de candidature', () => {
  test('dossier incomplet : soumission refusée avec la liste des manques', async () => {
    const res = await request(app).post('/api/sous-agents/moi/soumettre').set(avec('sa'));
    expect(res.status).toBe(400);
    expect(res.body.details.pieces).toEqual(['cni', 'photo', 'justificatif_domicile']);
  });
  test('fichier dont le contenu ne correspond pas au format refusé', async () => {
    const res = await request(app).post('/api/sous-agents/moi/pieces').set(avec('sa'))
      .field('type', 'cni').attach('fichier', Buffer.from('ceci n\'est pas un PDF'), { filename: 'cni.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
  });
  test('dossier complété puis soumis', async () => {
    const maj = await request(app).put('/api/sous-agents/moi').set(avec('sa')).send({
      civilite: 'Mme', date_naissance: '1995-04-12', type_piece: 'cni', numero_piece: 'CI 0012 3456 78', adresse: 'Rue des Jardins', ville: 'Abidjan', commune: 'Yopougon', zone: 'Yopougon Selmer',
    });
    expect(maj.status).toBe(200);
    expect(maj.body.numero_piece).toBe('CI0012345678');
    for (const type of ['cni', 'photo', 'justificatif_domicile']) {
      const res = await request(app).post('/api/sous-agents/moi/pieces').set(avec('sa'))
        .field('type', type).attach('fichier', PDF_PIECE, { filename: `${type}.pdf`, contentType: 'application/pdf' });
      expect(res.status).toBe(201);
      expect(res.body.empreinte).toHaveLength(64);
    }
    const res = await request(app).post('/api/sous-agents/moi/soumettre').set(avec('sa'));
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('soumis');
    dossierId = res.body.id;
  });
  test('un dossier soumis ne peut plus être modifié par le candidat', async () => {
    expect((await request(app).put('/api/sous-agents/moi').set(avec('sa')).send({ ville: 'Bouaké' })).status).toBe(403);
  });
});

describe('RG2 - génération du contrat', () => {
  test('impossible tant que la candidature n\'est pas admise', async () => {
    const res = await request(app).post('/api/contrats').set(avec('commercial')).send({ sous_agent_id: dossierId, modele_id: modele.id, date_debut: '2026-11-01' });
    expect(res.status).toBe(409);
  });
  test('la conformité ne peut pas admettre une candidature', async () => {
    expect((await request(app).post(`/api/sous-agents/${dossierId}/admettre`).set(avec('conformite'))).status).toBe(403);
  });
  test('admission par le commercial puis génération du PDF pré-rempli', async () => {
    const adm = await request(app).post(`/api/sous-agents/${dossierId}/admettre`).set(avec('commercial'));
    expect(adm.body.statut).toBe('admis');
    expect(adm.body.code).toMatch(/^SA-\d{5}$/);

    const res = await request(app).post('/api/contrats').set(avec('commercial')).send({ sous_agent_id: dossierId, modele_id: modele.id, date_debut: '2026-11-01' });
    expect(res.status).toBe(201);
    expect(res.body.numero).toMatch(/^CTR-\d{4}-0001$/);
    expect(res.body.statut).toBe('brouillon');
    expect(res.body.date_fin).toBe('2027-10-31');
    contratId = res.body.id;

    const pdf = await request(app).get(`/api/contrats/${contratId}/pdf`).set(avec('commercial')).buffer(true).parse((r, cb) => { const b = []; r.on('data', (c) => b.push(c)); r.on('end', () => cb(null, Buffer.concat(b))); });
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
  });
  test('un deuxième contrat en préparation est refusé (RG10)', async () => {
    const res = await request(app).post('/api/contrats').set(avec('commercial')).send({ sous_agent_id: dossierId, modele_id: modele.id });
    expect(res.status).toBe(409);
  });
  test('le sous-agent ne voit pas un contrat en préparation', async () => {
    expect((await request(app).get(`/api/contrats/${contratId}`).set(avec('sa'))).status).toBe(404);
    expect((await request(app).get('/api/contrats').set(avec('sa'))).body).toHaveLength(0);
  });
});

describe('RG3 - circuit de validation', () => {
  test('la conformité ne peut pas valider avant le commercial', async () => {
    expect((await request(app).post(`/api/contrats/${contratId}/valider`).set(avec('conformite'))).status).toBe(403);
  });
  test('rejet sans motif refusé', async () => {
    expect((await request(app).post(`/api/contrats/${contratId}/rejeter`).set(avec('commercial')).send({})).status).toBe(400);
  });
  test('validation commerciale puis validation de conformité', async () => {
    const v1 = await request(app).post(`/api/contrats/${contratId}/valider`).set(avec('commercial')).send({ commentaire: 'Dossier conforme' });
    expect(v1.body.statut).toBe('validation_conformite');
    const v2 = await request(app).post(`/api/contrats/${contratId}/valider`).set(avec('conformite'));
    expect(v2.body.statut).toBe('a_signer');
    expect(v2.body.validations.map((v) => v.etape)).toEqual(['commercial', 'conformite']);
  });
});

describe('RG4 et RG5 - signature électronique par code OTP', () => {
  let code;
  test('seul le titulaire peut demander un code', async () => {
    const autre = await request(app).post('/api/auth/inscription').send({ nom: 'Autre', prenoms: 'Candidat', email: 'autre@test.ci', telephone: '0101', mot_de_passe: MDP });
    jetons.autre = autre.body.jeton;
    expect((await request(app).post(`/api/contrats/${contratId}/otp`).set(avec('autre'))).status).toBe(404);
  });
  test('envoi du code, destination masquée', async () => {
    const res = await request(app).post(`/api/contrats/${contratId}/otp`).set(avec('sa'));
    expect(res.status).toBe(200);
    expect(res.body.destination).toBe('a***a@test.ci');
    code = res.body.code_demo;
    expect(code).toMatch(/^\d{6}$/);
    // Le code n'est jamais conservé en clair
    const enBase = await CodeOtp.findOne({ order: [['id', 'DESC']] });
    expect(enBase.code_hache).not.toContain(code);
  });
  test('signature sans tracé refusée', async () => {
    const res = await request(app).post(`/api/contrats/${contratId}/signer`).set(avec('sa')).send({ code, signature: '', accepte: true });
    expect(res.status).toBe(400);
  });
  test('code erroné refusé, essais restants indiqués', async () => {
    const faux = code === '000000' ? '111111' : '000000';
    const res = await request(app).post(`/api/contrats/${contratId}/signer`).set(avec('sa')).send({ code: faux, signature: imagePng(), accepte: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('il vous reste 2 essai(s)');
  });
  test('bon code : contrat signé, empreinte et scellement enregistrés', async () => {
    const res = await request(app).post(`/api/contrats/${contratId}/signer`).set(avec('sa')).send({ code, signature: imagePng(), accepte: true });
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('signe');
    expect(res.body.empreinte_signee).toHaveLength(64);
    expect(res.body.scelle).toBe(true);
    expect(res.body.ip_signature).toBeTruthy();
  });
  test('le même code ne peut pas resservir', async () => {
    const res = await request(app).post(`/api/contrats/${contratId}/otp`).set(avec('sa'));
    expect(res.status).toBe(409);
  });
  test('le sous-agent devient actif', async () => {
    const res = await request(app).get('/api/sous-agents/moi').set(avec('sa'));
    expect(res.body.statut).toBe('actif');
  });
});

describe('RG5 - vérification d\'intégrité', () => {
  test('le contrat signé présenté est reconnu authentique', async () => {
    const contrat = await Contrat.findByPk(contratId);
    pdfSigne = stockage.lire('contrats', contrat.fichier_signe);
    // La version signée comporte une page de plus (certificat de signature) et les mentions de signature
    const genere = await PDFDocument.load(stockage.lire('contrats', contrat.fichier));
    const signe = await PDFDocument.load(pdfSigne);
    expect(signe.getPageCount()).toBe(genere.getPageCount() + 1);
    expect(signe.getKeywords()).toContain('signé électroniquement');
    const res = await request(app).post('/api/contrats/verifier').set(avec('conformite')).attach('fichier', pdfSigne, { filename: 'contrat.pdf', contentType: 'application/pdf' });
    expect(res.body.resultat).toBe('authentique');
    expect(res.body.contrat.signataire).toBe('Aya Marie KOUASSI');
  });
  test('un PDF modifié d\'un seul octet n\'est pas reconnu', async () => {
    const modifie = Buffer.from(pdfSigne);
    modifie[modifie.length - 20] ^= 1;
    const res = await request(app).post('/api/contrats/verifier').set(avec('conformite')).attach('fichier', modifie, { filename: 'contrat.pdf', contentType: 'application/pdf' });
    expect(res.body.resultat).toBe('inconnu');
  });
  test('le fichier conservé est intègre, puis détecté altéré s\'il est modifié hors de l\'application', async () => {
    const ok = await request(app).get(`/api/contrats/${contratId}/integrite`).set(avec('conformite'));
    expect(ok.body.integre).toBe(true);
    expect(ok.body.scellement_valide).toBe(true);

    const contrat = await Contrat.findByPk(contratId);
    const chemin = path.join(process.env.STOCKAGE_DIR, 'contrats', contrat.fichier_signe);
    fs.appendFileSync(chemin, '% ajout frauduleux\n');
    const ko = await request(app).get(`/api/contrats/${contratId}/integrite`).set(avec('conformite'));
    expect(ko.body.integre).toBe(false);
    expect(ko.body.scellement_valide).toBe(false);
    fs.writeFileSync(chemin, pdfSigne); // remise en état
  });
});

describe('RG6 et RG7 - échéances et renouvellement', () => {
  test('alerte J-30 créée une seule fois puis expiration du contrat', async () => {
    const contrat = await Contrat.findByPk(contratId);
    const fin = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
    await contrat.update({ date_fin: fin });
    expect((await controlerEcheances()).alertes).toBe(1);
    expect((await controlerEcheances()).alertes).toBe(0);
    const alertes = await request(app).get('/api/alertes').set(avec('commercial'));
    expect(alertes.body[0].niveau).toBe('J-30');
  });
  test('renouvellement : nouveau contrat qui démarre le lendemain de la fin', async () => {
    const ancien = await Contrat.findByPk(contratId);
    const res = await request(app).post(`/api/contrats/${contratId}/renouveler`).set(avec('commercial'));
    expect(res.status).toBe(201);
    expect(res.body.statut).toBe('brouillon');
    expect(res.body.precedent.numero).toBe(ancien.numero);
    const lendemain = new Date(`${ancien.date_fin}T00:00:00Z`);
    lendemain.setUTCDate(lendemain.getUTCDate() + 1);
    expect(res.body.date_debut).toBe(lendemain.toISOString().slice(0, 10));
  });
  test('un contrat échu passe au statut expiré et le sous-agent devient inactif', async () => {
    const contrat = await Contrat.findByPk(contratId);
    await contrat.update({ date_fin: new Date(Date.now() - 864e5).toISOString().slice(0, 10) });
    const r = await controlerEcheances();
    expect(r.expires).toBe(1);
    expect((await Contrat.findByPk(contratId)).statut).toBe('expire');
    expect((await request(app).get('/api/sous-agents/moi').set(avec('sa'))).body.statut).toBe('inactif');
  });
});

describe('Journal d\'audit et tableau de bord', () => {
  test('chaque action est tracée avec l\'utilisateur et l\'adresse IP', async () => {
    const res = await request(app).get('/api/journal').set(avec('conformite'));
    const actions = res.body.map((l) => l.action);
    expect(actions.some((a) => a.startsWith('Signature électronique du contrat'))).toBe(true);
    expect(actions.some((a) => a.startsWith('Validation de conformité'))).toBe(true);
    expect(res.body.find((l) => l.action.startsWith('Signature')).adresse_ip).toBeTruthy();
  });
  test('indicateurs disponibles', async () => {
    const res = await request(app).get('/api/tableau-de-bord').set(avec('commercial'));
    expect(res.status).toBe(200);
    expect(res.body.nombre_delais).toBe(1);
    expect(res.body.delai_moyen_heures).toBeGreaterThanOrEqual(0);
  });
});
