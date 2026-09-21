// -----------------------------------------------------------------------------
// auth.js — Llamadas del modulo de autenticacion
// -----------------------------------------------------------------------------
// Una funcion por endpoint. Las pantallas llaman a estas funciones y no saben
// nada de rutas ni de fetch: si manana cambia la URL, se toca solo este archivo.
// -----------------------------------------------------------------------------

import { api } from './client.js';

/** POST /api/auth/login — es publica, por eso conToken: false. */
export function login(username, password) {
  return api.post('/auth/login', { username, password }, { conToken: false });
}

/** GET /api/auth/me — "este token que tengo guardado, sigue valiendo?" */
export function obtenerSesion() {
  return api.get('/auth/me');
}

/** POST /api/auth/cambiar-password */
export function cambiarPassword(passwordActual, passwordNueva) {
  return api.post('/auth/cambiar-password', { passwordActual, passwordNueva });
}
