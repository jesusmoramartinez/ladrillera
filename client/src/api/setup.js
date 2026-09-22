// -----------------------------------------------------------------------------
// setup.js — El asistente de configuracion inicial
// -----------------------------------------------------------------------------

import { api } from './client.js';

/**
 * GET /api/setup
 * Devuelve { hecha, unidadLena, ladrillosPorCamion, umbralAlertaArcilla,
 *            listasDePrecio }.
 */
export async function obtenerEstadoSetup() {
  return api.get('/setup');
}

/**
 * POST /api/setup — guarda TODA la configuracion inicial de una vez.
 * Solo se puede una vez: despues responde 409.
 */
export async function guardarConfiguracionInicial(datos) {
  return api.post('/setup', datos);
}
