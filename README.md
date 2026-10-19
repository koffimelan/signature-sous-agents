# Dématérialisation et signature électronique des contrats des sous-agents - AFG Bank Côte d'Ivoire

Projet de fin de cycle - Licence 3 Réseau et Génie Logiciel - KOFFI MELAN DENIS (2026).

Application web qui gère en ligne tout le cycle de vie du contrat d'un sous-agent : candidature et dépôt des pièces
justificatives, étude du dossier, génération du contrat PDF à partir d'un modèle, validation par le chargé commercial
puis par la conformité, signature électronique à distance (code à usage unique et signature tracée à l'écran),
scellement par le cachet électronique de la banque, archivage, vérification d'intégrité, alertes d'échéance,
renouvellement, tableau de bord et journal d'audit.

## Architecture

| Couche | Technologies |
|---|---|
| Interface (client) | React 19 (Vite), React Router, Bootstrap 5, signature_pad, Chart.js |
| API (serveur) | Node.js, Express 5, JWT, bcrypt, Helmet, limitation des tentatives |
| Données | PostgreSQL (production) ou SQLite (développement), ORM Sequelize |
| Signature et documents | pdf-lib (génération et signature des PDF), module crypto de Node.js (SHA-256, RSA), node-forge (certificat X.509) |
| Traitements | node-cron (contrôle quotidien des échéances), Nodemailer (codes de signature, notifications), Multer (pièces) |

```
signature-sous-agents/
  backend/
    src/
      config/        connexion à la base (PostgreSQL ou SQLite)
      models/        une définition Sequelize par table (9 tables)
      routes/        auth, utilisateurs, sous-agents, modeles, contrats, alertes, tableau-de-bord, journal
      middlewares/   vérification du jeton JWT et du rôle, gestion des erreurs
      services/      génération et signature des PDF, cachet de la banque, codes OTP, alertes, stockage, journal
      jobs/          contrôle quotidien des échéances
      utils/         règles de gestion (fonctions pures), constantes
      seed.js        données de démonstration
    tests/           tests unitaires et d'intégration (Jest + Supertest)
    stockage/        pièces justificatives et contrats PDF (créé au premier lancement, jamais versionné)
    cles/            clé privée et certificat du cachet électronique (créés au premier lancement, jamais versionnés)
  frontend/
    src/
      pages/         un fichier par écran
      components/    menu, pastilles de statut, pièces, aperçu PDF, fenêtres modales...
```

## Démarrage rapide (Windows)

Double-cliquer sur **`Lancer-application.bat`** : le script installe ce qui manque, prépare la base de démonstration,
démarre le serveur et ouvre le navigateur sur http://localhost:4100. Fermer la fenêtre noire pour arrêter l'application.

L'application utilise le port 4100 : elle peut fonctionner en même temps que l'application du parc automobile (port 4000).

## Installation (poste de développement)

Prérequis : Node.js 20 ou plus récent.

```bash
cd backend
npm install
cp .env.example .env      # puis renseigner JWT_SECRET
npm run seed              # crée la base, les dossiers et les contrats de démonstration
npm run dev               # API sur http://localhost:4100
```

Dans un second terminal :

```bash
cd frontend
npm install
npm run dev               # interface sur http://localhost:5174
```

### Comptes de démonstration

Créés par `npm run seed`. Le mot de passe de tous ces comptes est la valeur de `SEED_PASSWORD` dans `backend/.env`. **Ces comptes et les personnes qui y figurent sont fictifs : à supprimer avant toute mise en production.**

| Rôle | E-mail | Ce qu'il peut faire |
|---|---|---|
| Administrateur | admin@contrats.local | tout, dont les comptes utilisateurs |
| Chargé commercial | commercial@contrats.local | étudier les candidatures, générer et valider les contrats, renouveler |
| Agent de conformité | conformite@contrats.local | valider les contrats avant signature, consulter le journal d'audit |
| Sous-agent | sousagent@contrats.local | son dossier et ses contrats ; un contrat l'attend pour signature |

Un candidat peut aussi créer son propre compte depuis l'écran de connexion (« Déposer ma candidature »).

### Code de signature en démonstration

Sans serveur de messagerie (`SMTP_HOST` vide), les e-mails sont affichés dans la console du serveur. Pour faciliter
la démonstration, `OTP_AFFICHER_CODE=oui` affiche aussi le code de signature à l'écran ; ce réglage est ignoré
lorsque `NODE_ENV=production`.

## Principe de la signature électronique

1. Le contrat est généré en PDF à partir du modèle ; son empreinte SHA-256 est enregistrée.
2. Après les deux validations, le sous-agent lit le contrat, déclare l'accepter et demande un code à usage unique
   (6 chiffres, valable 10 minutes, 3 essais, conservé haché).
3. Le code correct déclenche la signature : contrôle de l'empreinte du contrat validé, apposition de la signature tracée,
   ajout d'une page « certificat de signature » (signataire, date, adresse IP, mode d'authentification, empreinte).
4. Le PDF signé est scellé : empreinte SHA-256 et signature RSA par la clé privée de la banque.
5. Vérification : tout PDF présenté est comparé aux empreintes enregistrées et son scellement est contrôlé ;
   la modification d'un seul octet le rend « non reconnu ».

Le certificat du cachet est auto-signé dans le prototype. En production, il serait délivré par un prestataire de
certification agréé par l'ARTCI et la clé privée serait conservée dans un module matériel sécurisé (HSM).

## Utiliser PostgreSQL

Créer la base (`CREATE DATABASE contrats_sous_agents;`), puis dans `backend/.env` :

```
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=contrats_sous_agents
DB_USER=postgres
DB_PASSWORD=votre_mot_de_passe
```

et relancer `npm run seed` puis `npm run dev`.

## Tests

```bash
cd backend
npm test
```

58 tests : règles de gestion (fonctions pures) et parcours complet de l'API sur une base en mémoire
(inscription, droits par rôle, dossier incomplet refusé, génération, circuit de validation, code OTP erroné puis correct,
signature, vérification d'un PDF authentique puis modifié, fichier altéré détecté, alertes, expiration, renouvellement, journal).

## Correspondance règles de gestion / code

| Règle | Où elle est appliquée |
|---|---|
| RG1 Candidature soumise seulement si le dossier est complet | `utils/regles.js` (piecesManquantes), `routes/sousAgents.js` (soumettre) |
| RG2 Contrat généré seulement pour une candidature admise | `routes/contrats.js` (POST /) |
| RG3 Validation par le commercial puis par la conformité | `utils/regles.js` (transition), `routes/contrats.js` (valider, rejeter) |
| RG4 Code OTP à usage unique, limité dans le temps et en essais | `utils/regles.js` (etatOtp), `services/otp.js`, `routes/contrats.js` (otp, signer) |
| RG5 Empreinte SHA-256 et scellement RSA, vérification d'intégrité | `services/cles.js`, `services/contrats.js` (signerContrat, verifierDocument, controlerFichier) |
| RG6 Alertes J-30 et J-7, expiration à la date de fin | `utils/regles.js` (niveauAlerte), `services/alertes.js`, index unique de `models/Alerte.js` |
| RG7 Renouvellement dans les 60 jours qui précèdent la fin | `utils/regles.js` (renouvelable), `routes/contrats.js` (renouveler) |
| RG8 Toute action est tracée (utilisateur, date, adresse IP) | `services/journal.js`, `models/Journal.js` |
| RG9 Accès selon le rôle ; le sous-agent ne voit que son dossier | `middlewares/auth.js` (autoriser), `routes/contrats.js` (charger) |
| RG10 Un seul dossier par pièce d'identité, un seul contrat en préparation | `models/SousAgent.js` (numero_piece unique), `routes/contrats.js` (contratEnCours) |

## Mise en production (Rocky Linux)

1. `cd frontend && npm run build` : l'interface compilée (`frontend/dist`) est servie directement par l'API.
2. Sur le serveur : `NODE_ENV=production`, base PostgreSQL, `JWT_SECRET` long et aléatoire, paramètres SMTP,
   passerelle SMS pour les codes de signature.
3. Protéger le dossier `cles/` (droits restreints) et sauvegarder chaque jour la base et le dossier `stockage/`.
4. Lancer l'API avec PM2 : `pm2 start backend/src/server.js --name contrats-sous-agents`.
5. Nginx en proxy inverse vers le port 4100, avec certificat SSL (HTTPS) et redirection HTTP vers HTTPS.
