// -----------------------------------------------------------------------------
// RutaProtegida.jsx — El "requireAuth" del frontend
// -----------------------------------------------------------------------------
// Envuelve las pantallas que exigen sesion. Si no hay usuario, redirige a
// /login en vez de mostrar la pantalla.
//
// OJO, concepto importante: esto NO es seguridad de verdad. Cualquiera puede
// abrir las herramientas del navegador y saltearlo. La seguridad real es la
// del BACKEND (requireAuth): aunque alguien fuerce la pantalla, la API no le
// va a devolver ni un dato sin token valido.
// Esto es comodidad de uso, no una barrera.
// -----------------------------------------------------------------------------

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth();
  const ubicacion = useLocation();

  // Mientras verificamos el token guardado no decidimos nada: si redirigieramos
  // ahora, el dueno veria el login por medio segundo cada vez que abre la app.
  if (cargando) {
    return (
      <div className="pantalla-centrada">
        <p className="texto-tenue">Cargando...</p>
      </div>
    );
  }

  if (!usuario) {
    // `state` recuerda a donde queria ir, para volver ahi despues del login.
    // `replace` evita que el boton Atras lo devuelva a la pantalla protegida.
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  }

  return children;
}

export default RutaProtegida;
