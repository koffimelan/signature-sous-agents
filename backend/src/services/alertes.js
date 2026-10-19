const { Op } = require('sequelize');
const {
  Contrat, SousAgent, Alerte, Utilisateur,
} = require('../models');
const { niveauAlerte, joursRestants } = require('../utils/regles');
const { envoyerEmail } = require('./mail');
const { journaliser } = require('./journal');

const MESSAGES = {
  'J-30': (c, j) => `Le contrat ${c.numero} arrive à échéance dans ${j} jour(s) : préparer son renouvellement`,
  'J-7': (c, j) => `Le contrat ${c.numero} arrive à échéance dans ${j} jour(s)`,
  echu: (c) => `Le contrat ${c.numero} a expiré le ${new Date(c.date_fin).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`,
};

// RG6 : contrôle quotidien des contrats signés (alertes J-30, J-7, puis expiration)
async function controlerEcheances(reference = Date.now()) {
  const seuil1 = Number(process.env.SEUIL_ALERTE_1) || 30;
  const seuil2 = Number(process.env.SEUIL_ALERTE_2) || 7;
  const contrats = await Contrat.findAll({ where: { statut: 'signe' }, include: [{ model: SousAgent, as: 'sous_agent' }] });

  const nouvelles = [];
  let expires = 0;
  for (const contrat of contrats) {
    const niveau = niveauAlerte(contrat.date_fin, reference, seuil1, seuil2);
    if (!niveau) continue;
    const jours = joursRestants(contrat.date_fin, reference);
    const [alerte, creee] = await Alerte.findOrCreate({
      where: { contrat_id: contrat.id, niveau },
      defaults: { message: MESSAGES[niveau](contrat, jours) },
    });
    if (creee) nouvelles.push({ alerte, contrat });

    if (niveau === 'echu') {
      contrat.statut = 'expire';
      await contrat.save();
      expires += 1;
      // Le sous-agent devient inactif s'il n'a plus aucun contrat en vigueur
      const autres = await Contrat.count({ where: { sous_agent_id: contrat.sous_agent_id, statut: 'signe', id: { [Op.ne]: contrat.id } } });
      if (!autres && contrat.sous_agent) {
        contrat.sous_agent.statut = 'inactif';
        await contrat.sous_agent.save();
      }
      await journaliser(null, `Contrat ${contrat.numero} expiré (date de fin dépassée)`);
    }
  }

  // Un seul e-mail récapitulatif aux chargés commerciaux
  if (nouvelles.length) {
    const commerciaux = await Utilisateur.findAll({ where: { role: 'commercial', actif: true } });
    const destinataires = [
      ...commerciaux.map((u) => u.email),
      ...String(process.env.ALERTES_DESTINATAIRES || '').split(',').map((s) => s.trim()).filter(Boolean),
    ];
    const lignes = nouvelles.map(({ alerte, contrat }) => `<li><b>${contrat.numero}</b> - ${contrat.sous_agent ? `${contrat.sous_agent.prenoms} ${contrat.sous_agent.nom}` : ''} : ${alerte.message}</li>`).join('');
    await envoyerEmail({
      a: destinataires,
      sujet: `Échéances des contrats de sous-agents : ${nouvelles.length} nouvelle(s) alerte(s)`,
      html: `<p>Bonjour,</p><p>Le contrôle quotidien des contrats a relevé les échéances suivantes :</p><ul>${lignes}</ul>`,
    });
  }
  return { alertes: nouvelles.length, expires };
}

module.exports = { controlerEcheances };
