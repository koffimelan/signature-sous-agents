import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles.css';
import { AuthProvider } from './auth/AuthContext';
import { appliquerPreferences, lirePreferences } from './accessibilite';
import App from './App';

// Préférences d'affichage appliquées avant le premier rendu (pas de clignotement)
appliquerPreferences(lirePreferences());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
