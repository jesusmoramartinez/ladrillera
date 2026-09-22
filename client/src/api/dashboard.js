// -----------------------------------------------------------------------------
// dashboard.js — La llamada del Inicio
// -----------------------------------------------------------------------------
// UNA sola llamada que trae todo lo de la pantalla. Podrian ser cinco (balance,
// produccion, stock, arcilla, pendientes) y seria peor en un celular: cada
// pedido paga su viaje de ida y vuelta, y la pantalla quedaria a medio dibujar
// mientras llegan.
// -----------------------------------------------------------------------------

import { api } from './client.js';

/**
 * GET /api/dashboard
 * Devuelve { fecha, mes, semana, balance, produccion, ladrillos, arcilla,
 *            lena, pendientes }.
 */
export async function obtenerInicio() {
  return api.get('/dashboard');
}
