const router = require('express').Router();
const {
  SousAgent, Contrat, Alerte,
} = require('../models');
const { autoriser } = require('../middlewares/auth');
const { STATUTS_SOUS_AGENT, STATUTS_CONTRAT } = require('../utils/constantes');
const { joursRestants } = require('../utils/regles');

const HEURE = 60 * 60 * 1000;

// Indicateurs de pilotage (fiche PSI : délai d'enrôlement, contrats à traiter, échéances)
router.get('/', autoriser('admin', 'commercial', 'conformite'), async (req, res) => {
  const [sousAgents, contrats, alertes] = await Promise.all([
    SousAgent.findAll({ attributes: ['id', 'statut', 'date_soumission'] }),
    Contrat.findAll({
      attributes: ['id', 'numero', 'statut', 'date_fin', 'date_signature', 'createdAt', 'sous_agent_id', 'contrat_precedent_id'],
      include: [{ model: SousAgent, as: 'sous_agent', attributes: ['nom', 'prenoms', 'code', 'date_soumission'] }],
    }),
    Alerte.count({ where: { lue: false } }),
  ]);

  const compter = (liste, valeurs) => Object.fromEntries(valeurs.map((v) => [v, liste.filter((x) => x.statut === v).length]));
  const signes = contrats.filter((c) => c.date_signature);

  // Délai d'enrôlement : du dépôt de la candidature à la signature du premier contrat
  const delais = signes
    .filter((c) => !c.contrat_precedent_id && c.sous_agent?.date_soumission)
    .map((c) => (new Date(c.date_signature) - new Date(c.sous_agent.date_soumission)) / HEURE)
    .filter((h) => h >= 0);
  const delaiMoyen = delais.length ? Math.round((delais.reduce((a, b) => a + b, 0) / delais.length) * 10) / 10 : null;

  // Signatures des six derniers mois
  const mois = [];
  const d = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const cle = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    mois.push({ mois: cle, signatures: signes.filter((c) => new Date(c.date_signature).toISOString().slice(0, 7) === cle).length });
  }

  const echeances = contrats
    .filter((c) => c.statut === 'signe' && joursRestants(c.date_fin) <= 30)
    .map((c) => ({
      id: c.id, numero: c.numero, date_fin: c.date_fin, jours_restants: joursRestants(c.date_fin), sous_agent: c.sous_agent,
    }))
    .sort((a, b) => a.jours_restants - b.jours_restants);

  const debutMois = new Date(d.getFullYear(), d.getMonth(), 1);
  res.json({
    sous_agents: compter(sousAgents, STATUTS_SOUS_AGENT),
    contrats: compter(contrats, STATUTS_CONTRAT),
    signes_ce_mois: signes.filter((c) => new Date(c.date_signature) >= debutMois).length,
    delai_moyen_heures: delaiMoyen,
    nombre_delais: delais.length,
    alertes_non_lues: alertes,
    echeances,
    mois,
    derniers_signes: signes
      .sort((a, b) => new Date(b.date_signature) - new Date(a.date_signature))
      .slice(0, 6)
      .map((c) => ({ id: c.id, numero: c.numero, date_signature: c.date_signature, sous_agent: c.sous_agent })),
    total_contrats_en_vigueur: contrats.filter((c) => c.statut === 'signe').length,
    papier_evite: signes.length, // un contrat signé en ligne = un dossier papier en moins
  });
});

module.exports = router;
