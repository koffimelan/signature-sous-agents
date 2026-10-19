const jwt = require('jsonwebtoken');

// Vérifie le jeton JWT envoyé dans l'en-tête « Authorization: Bearer ... »
function verifierJeton(req, res, next) {
  const entete = req.headers.authorization || '';
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : null;
  if (!jeton) return res.status(401).json({ message: 'Authentification requise' });

  try {
    req.utilisateur = jwt.verify(jeton, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter' });
  }
}

// Laisse passer uniquement les rôles indiqués, par exemple autoriser('gestionnaire', 'admin')
function autoriser(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.utilisateur.role)) {
      return res.status(403).json({ message: 'Accès refusé pour votre profil' });
    }
    next();
  };
}

module.exports = { verifierJeton, autoriser };
