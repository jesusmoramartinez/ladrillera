// -----------------------------------------------------------------------------
// auth.controller.js — Traduce entre HTTP y el servicio
// -----------------------------------------------------------------------------
// El controlador no tiene logica de negocio: saca los datos del pedido, llama
// al servicio y arma la respuesta. Si el servicio lanza un error, se lo pasa
// al errorHandler con next(error).
// -----------------------------------------------------------------------------

import * as authService from '../services/auth.service.js';

export async function postLogin(req, res, next) {
  try {
    // req.body ya viene validado y limpio por el middleware validate().
    const resultado = await authService.login(req.body);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Sirve para que el celular pregunte "el token que tengo guardado, sigue
 * valiendo?" al abrir la app, sin obligar al dueno a escribir la clave.
 */
export function getMe(req, res) {
  // requireAuth ya dejo el usuario en req.usuario.
  res.json({ ok: true, usuario: req.usuario });
}

export async function postCambiarPassword(req, res, next) {
  try {
    const resultado = await authService.cambiarPassword(req.usuarioId, req.body);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    next(error);
  }
}
