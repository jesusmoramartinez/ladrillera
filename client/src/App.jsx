// -----------------------------------------------------------------------------
// App.jsx — El mapa de pantallas
// -----------------------------------------------------------------------------
// React Router mira la URL y decide que componente mostrar, SIN recargar la
// pagina. Por eso se llama SPA (Single Page Application): el navegador carga
// el HTML una sola vez y despues solo cambia lo que se ve.
//
// Fijate que /login esta suelta y todo lo demas va envuelto en
// <RutaProtegida>: ese es el "sin login no se accede a nada" del frontend.
// -----------------------------------------------------------------------------

import { Navigate, Route, Routes } from 'react-router-dom';
import { RutaProtegida } from './components/RutaProtegida.jsx';
import Inicio from './pages/Inicio.jsx';
import Login from './pages/Login.jsx';

export default function App() {
  return (
    <Routes>
      {/* Publica */}
      <Route path="/login" element={<Login />} />

      {/* Protegidas */}
      <Route
        path="/"
        element={
          <RutaProtegida>
            <Inicio />
          </RutaProtegida>
        }
      />

      {/* Cualquier otra URL vuelve al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
