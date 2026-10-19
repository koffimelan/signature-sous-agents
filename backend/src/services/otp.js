const crypto = require('crypto');

// Codes à usage unique (OTP) de signature : 6 chiffres tirés au hasard, conservés hachés
const DUREE_MINUTES = () => Number(process.env.OTP_DUREE_MINUTES) || 10;
const MAX_TENTATIVES = () => Number(process.env.OTP_MAX_TENTATIVES) || 3;

const genererCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

// HMAC avec le secret du serveur : le code ne peut pas être retrouvé à partir de la base
const hacherCode = (code) => crypto.createHmac('sha256', process.env.JWT_SECRET || 'otp').update(String(code).trim()).digest('hex');

// Comparaison en temps constant pour ne rien révéler sur le code attendu
function codeCorrect(code, codeHache) {
  const a = Buffer.from(hacherCode(code), 'hex');
  const b = Buffer.from(codeHache, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// k***@gmail.com, 07 ** ** 25 89 : la destination est masquée à l'écran et dans le certificat
function masquer(destination) {
  const s = String(destination);
  if (s.includes('@')) {
    const [nom, domaine] = s.split('@');
    return `${nom.slice(0, 1)}***${nom.length > 1 ? nom.slice(-1) : ''}@${domaine}`;
  }
  const chiffres = s.replace(/\D/g, '');
  return `${chiffres.slice(0, 2)} ** ** ${chiffres.slice(-4, -2)} ${chiffres.slice(-2)}`;
}

module.exports = { DUREE_MINUTES, MAX_TENTATIVES, genererCode, hacherCode, codeCorrect, masquer };
