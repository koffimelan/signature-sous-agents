// Tests unitaires des règles de gestion (fonctions pures, sans base de données)
const {
  piecesManquantes, dateFin, joursRestants, niveauAlerte, transition, etatOtp, renouvelable, remplirModele,
} = require('../src/utils/regles');
const { masquer, hacherCode, codeCorrect } = require('../src/services/otp');

const REF = Date.UTC(2026, 9, 19); // référence fixe : 19/10/2026

describe('RG1 - pièces obligatoires du dossier', () => {
  test('dossier complet', () => expect(piecesManquantes(['cni', 'photo', 'justificatif_domicile', 'registre_commerce'])).toEqual([]));
  test('pièces manquantes signalées', () => expect(piecesManquantes(['photo'])).toEqual(['cni', 'justificatif_domicile']));
});

describe('Durée du contrat', () => {
  test('12 mois à partir du 1er novembre', () => expect(dateFin('2026-11-01', 12)).toBe('2027-10-31'));
  test('fin de mois respectée', () => expect(dateFin('2026-01-31', 1)).toBe('2026-02-27'));
  test('jours restants', () => expect(joursRestants('2026-10-29', REF)).toBe(10));
});

describe('RG6 - niveau d\'alerte d\'échéance', () => {
  test.each([
    ['2026-12-31', null],
    ['2026-11-18', 'J-30'],
    ['2026-10-26', 'J-7'],
    ['2026-10-19', 'J-7'],
    ['2026-10-18', 'echu'],
  ])('fin le %s -> %s', (fin, niveau) => expect(niveauAlerte(fin, REF)).toBe(niveau));
});

describe('RG3 - circuit de validation', () => {
  test('le commercial valide un brouillon', () => expect(transition('valider', 'brouillon', 'commercial')).toEqual({ etape: 'commercial', vers: 'validation_conformite' }));
  test('la conformité valide ensuite', () => expect(transition('valider', 'validation_conformite', 'conformite')).toEqual({ etape: 'conformite', vers: 'a_signer' }));
  test('la conformité ne peut pas sauter l\'étape commerciale', () => expect(transition('valider', 'brouillon', 'conformite')).toBeNull());
  test('le commercial ne peut pas valider à la place de la conformité', () => expect(transition('valider', 'validation_conformite', 'commercial')).toBeNull());
  test('un contrat à signer ne peut plus être rejeté', () => expect(transition('rejeter', 'a_signer', 'conformite')).toBeNull());
});

describe('RG4 - code OTP', () => {
  const futur = new Date(REF + 5 * 60000);
  test('code valide', () => expect(etatOtp({ utilise: false, tentatives: 0, expire_le: futur }, REF)).toBe('valide'));
  test('code expiré', () => expect(etatOtp({ utilise: false, tentatives: 0, expire_le: new Date(REF - 1000) }, REF)).toBe('expire'));
  test('code déjà utilisé', () => expect(etatOtp({ utilise: true, tentatives: 0, expire_le: futur }, REF)).toBe('utilise'));
  test('trois essais manqués', () => expect(etatOtp({ utilise: false, tentatives: 3, expire_le: futur }, REF)).toBe('bloque'));
  test('le code est comparé à son hachage', () => {
    process.env.JWT_SECRET = 'secret-de-test';
    expect(codeCorrect('123456', hacherCode('123456'))).toBe(true);
    expect(codeCorrect('123457', hacherCode('123456'))).toBe(false);
  });
  test('destination masquée', () => {
    expect(masquer('koffi.denis@gmail.com')).toBe('k***s@gmail.com');
    expect(masquer('0707872589')).toBe('07 ** ** 25 89');
  });
});

describe('RG7 - renouvellement', () => {
  test('possible 60 jours avant la fin', () => expect(renouvelable({ statut: 'signe', date_fin: '2026-12-10' }, REF)).toBe(true));
  test('trop tôt', () => expect(renouvelable({ statut: 'signe', date_fin: '2027-06-30' }, REF)).toBe(false));
  test('impossible pour un contrat non signé', () => expect(renouvelable({ statut: 'a_signer', date_fin: '2026-11-01' }, REF)).toBe(false));
});

describe('Modèle de contrat', () => {
  test('les champs sont remplacés, les champs inconnus restent visibles', () => {
    expect(remplirModele('Entre la Banque et {{ prenoms }} {{nom}}, zone {{zone}}', { nom: 'KOFFI', prenoms: 'Denis' }))
      .toBe('Entre la Banque et Denis KOFFI, zone [zone]');
  });
});
