// -----------------------------------------------------------------------------
// main.jsx — El punto de entrada de React
// -----------------------------------------------------------------------------
// Monta la app dentro del <div id="root"> de index.html.
//
// El orden de los "envoltorios" importa:
//   BrowserRouter  ->  da acceso a la URL (lo necesita AuthProvider para
//                      redirigir, y RutaProtegida para saber donde estamos)
//   AuthProvider   ->  da acceso a la sesion
//   App            ->  las pantallas
// -----------------------------------------------------------------------------

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
