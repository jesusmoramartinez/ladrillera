// -----------------------------------------------------------------------------
// AuthContext.jsx — El estado de "quien esta logueado", disponible en toda la app
// -----------------------------------------------------------------------------
// Problema que resuelve: la pantalla de Login necesita guardar el usuario, y
// la barra de navegacion necesita leerlo. Pasarlo por props de componente en
// componente ("prop drilling") es un dolor de cabeza.
//
// Un Context de React es como una variable compartida a la que cualquier
// componente de adentro puede acceder con un hook, sin recibirla por props.
//
// Este context expone: usuario, cargando, iniciarSesion(), cerrarSesion().
// -----------------------------------------------------------------------------

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { borrarToken, guardarToken, leerToken, alVencerSesion } from '../api/client.js';
import * as authApi from '../api/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  // Arranca en true: al abrir la app todavia no sabemos si hay sesion valida.
  // Sin este estado, se veria un parpadeo del login antes de entrar.
  const [cargando, setCargando] = useState(true);

  // Al montar la app: si hay token guardado, preguntamos al backend si sigue
  // valiendo. Asi el dueno no escribe la clave cada vez que abre la app.
  useEffect(() => {
    let cancelado = false;

    async function revisarSesion() {
      if (!leerToken()) {
        setCargando(false);
        return;
      }
      try {
        const { usuario: u } = await authApi.obtenerSesion();
        if (!cancelado) setUsuario(u);
      } catch {
        // Token vencido o invalido: el cliente ya lo borro.
        if (!cancelado) setUsuario(null);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    revisarSesion();

    // React 18 en modo estricto monta y desmonta los componentes dos veces en
    // desarrollo. Esta bandera evita actualizar el estado de un componente ya
    // desmontado (un warning clasico de React).
    return () => {
      cancelado = true;
    };
  }, []);

  // Si CUALQUIER llamada a la API devuelve 401, cerramos la sesion aca.
  useEffect(() => alVencerSesion(() => setUsuario(null)), []);

  const iniciarSesion = useCallback(async (username, password) => {
    const { token, usuario: u } = await authApi.login(username, password);
    guardarToken(token);
    setUsuario(u);
    return u;
  }, []);

  const cerrarSesion = useCallback(() => {
    borrarToken();
    setUsuario(null);
  }, []);

  // useMemo evita crear un objeto nuevo en cada render, lo que obligaria a
  // re-renderizar a todos los componentes que usan el context sin necesidad.
  const valor = useMemo(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion }),
    [usuario, cargando, iniciarSesion, cerrarSesion],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

/** Hook para usar el context: const { usuario, cerrarSesion } = useAuth(); */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth se tiene que usar adentro de <AuthProvider>');
  }
  return context;
}
