const nodemailer = require('nodemailer');

let transporteur;

// Sans serveur SMTP configuré, les e-mails sont simplement affichés dans la console
function obtenirTransporteur() {
  if (transporteur) return transporteur;
  if (process.env.SMTP_HOST) {
    transporteur = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  } else {
    transporteur = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporteur;
}

async function envoyerEmail({ a, sujet, html }) {
  if (!a || a.length === 0) return null;
  try {
    const info = await obtenirTransporteur().sendMail({
      from: process.env.SMTP_FROM || 'Contrats des sous-agents <contrats@localhost>',
      to: a,
      subject: sujet,
      html,
    });
    if (!process.env.SMTP_HOST && process.env.NODE_ENV !== 'test') {
      console.log(`[e-mail simulé] à ${[].concat(a).join(', ')} : ${sujet}`);
    }
    return info;
  } catch (err) {
    // Un e-mail non parti ne doit pas annuler l'opération : il est signalé dans la console
    console.error('E-mail non envoyé :', err.message);
    return null;
  }
}

module.exports = { envoyerEmail };
