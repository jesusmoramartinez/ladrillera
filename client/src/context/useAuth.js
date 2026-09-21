// -----------------------------------------------------------------------------
// useAuth.js — El hook para leer la sesion desde cualquier componente
// -----------------------------------------------------------------------------
//   const { usuario, cerrarSesion } = useAuth();
//
// Esta en un archivo aparte del AuthProvider por un motivo de herramientas:
// Vite recarga en caliente (hot reload) los archivos que exportan SOLO
// componentes. Si un archivo exporta un componente y ademas una funcion comun,
// Vite no puede hacer el reemplazo fino y recarga la pagina entera, perdiendo
// el estado. Separarlos mantiene la recarga rapida mientras programas.
// -----------------------------------------------------------------------------

import { useContext } from 'react';
import { AuthContext } from './contextoAuth.js';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth se tiene que usar adentro de <AuthProvider>');
  }
  return context;
}

export default useAuth;
