const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { verifierJeton } = require('./middlewares/auth');
const gestionErreurs = require('./middlewares/erreurs');

const app = express();

// Derrière Nginx, l'adresse IP réelle du client est transmise dans X-Forwarded-For
app.set('trust proxy', 'loopback');
// L'aperçu des contrats PDF s'affiche dans un cadre à partir d'une adresse blob: créée par le navigateur
app.use(helmet({ contentSecurityPolicy: { directives: { 'frame-src': ["'self'", 'blob:'] } } }));
app.use(cors());
// 2 Mo : la signature tracée à l'écran arrive sous forme d'image PNG encodée
app.use(express.json({ limit: '2mb' }));

// Routes publiques : connexion et dépôt d'une candidature
app.use('/api/auth', require('./routes/auth'));

// Toutes les autres routes demandent un jeton valide
app.use('/api', verifierJeton);
app.use('/api/utilisateurs', require('./routes/utilisateurs'));
app.use('/api/sous-agents', require('./routes/sousAgents'));
app.use('/api/modeles', require('./routes/modeles'));
app.use('/api/contrats', require('./routes/contrats'));
app.use('/api/alertes', require('./routes/alertes'));
app.use('/api/tableau-de-bord', require('./routes/tableauDeBord'));
app.use('/api/journal', require('./routes/journal'));

app.use('/api', (req, res) => res.status(404).json({ message: 'Route inconnue' }));

// En production, le serveur distribue aussi l'interface React compilée (frontend/dist)
const dossierFront = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(dossierFront)) {
  app.use(express.static(dossierFront));
  app.use((req, res) => res.sendFile(path.join(dossierFront, 'index.html')));
}

app.use(gestionErreurs);

module.exports = app;
