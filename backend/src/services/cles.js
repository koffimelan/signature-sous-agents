const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge');

// Cachet électronique de la banque : une paire de clés RSA 2048 bits et un certificat X.509.
// Dans le prototype, le certificat est auto-signé ; en production il serait délivré par un
// prestataire de certification agréé par l'ARTCI et la clé privée serait conservée dans un HSM.
let cache = null;

function dossierCles() {
  return path.resolve(__dirname, '../..', process.env.CLES_DIR || 'cles');
}

function creerCachet(fichierCle, fichierCertificat) {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const clePem = privateKey.export({ type: 'pkcs1', format: 'pem' });
  const publiquePem = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });

  const certificat = forge.pki.createCertificate();
  certificat.publicKey = forge.pki.publicKeyFromPem(publiquePem);
  certificat.serialNumber = `01${crypto.randomBytes(8).toString('hex')}`;
  certificat.validity.notBefore = new Date();
  certificat.validity.notAfter = new Date();
  certificat.validity.notAfter.setFullYear(certificat.validity.notBefore.getFullYear() + 5);
  const identite = [
    { name: 'commonName', value: 'Cachet electronique AFG Bank - contrats des sous-agents' },
    { name: 'organizationName', value: "AFG Bank Cote d'Ivoire" },
    { shortName: 'OU', value: 'Direction commerciale' },
    { name: 'localityName', value: 'Abidjan' },
    { name: 'countryName', value: 'CI' },
  ];
  certificat.setSubject(identite);
  certificat.setIssuer(identite);
  certificat.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true },
  ]);
  certificat.sign(forge.pki.privateKeyFromPem(clePem), forge.md.sha256.create());

  fs.writeFileSync(fichierCle, clePem, { mode: 0o600 });
  fs.writeFileSync(fichierCertificat, forge.pki.certificateToPem(certificat));
}

// Charge le cachet (et le crée au premier démarrage)
function cachet() {
  if (cache) return cache;
  const dossier = dossierCles();
  fs.mkdirSync(dossier, { recursive: true });
  const fichierCle = path.join(dossier, 'cachet_banque.key.pem');
  const fichierCertificat = path.join(dossier, 'cachet_banque.crt.pem');
  if (!fs.existsSync(fichierCle) || !fs.existsSync(fichierCertificat)) creerCachet(fichierCle, fichierCertificat);

  const certificatPem = fs.readFileSync(fichierCertificat, 'utf8');
  const x509 = new crypto.X509Certificate(certificatPem);
  cache = {
    clePrivee: crypto.createPrivateKey(fs.readFileSync(fichierCle, 'utf8')),
    clePublique: x509.publicKey,
    certificatPem,
    infos: {
      titulaire: x509.subject.split('\n').find((l) => l.startsWith('CN='))?.slice(3),
      organisation: x509.subject.split('\n').find((l) => l.startsWith('O='))?.slice(2),
      numero_serie: x509.serialNumber,
      valable_du: new Date(x509.validFrom).toISOString(),
      valable_jusqu_au: new Date(x509.validTo).toISOString(),
      empreinte_certificat: x509.fingerprint256,
      algorithme: 'RSA 2048 bits, SHA-256',
    },
  };
  return cache;
}

// Scellement : signature RSA-SHA256 du document par la clé privée de la banque
function sceller(contenu) {
  return crypto.sign('sha256', contenu, cachet().clePrivee).toString('base64');
}

function verifierScellement(contenu, scellement) {
  try {
    return crypto.verify('sha256', contenu, cachet().clePublique, Buffer.from(scellement, 'base64'));
  } catch {
    return false;
  }
}

module.exports = { cachet, sceller, verifierScellement };
