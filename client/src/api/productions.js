// -----------------------------------------------------------------------------
// productions.js — Llamadas del modulo de produccion
// -----------------------------------------------------------------------------

import { api } from './client.js';

/**
 * GET /api/productions?semana=YYYY-MM-DD
 * Sirve cualquier dia de la semana: el servidor calcula el lunes y el sabado.
 * Devuelve { semana, producciones, resumen }.
 */
export async function obtenerSemana(fecha) {
  const ruta = fecha ? `/productions?semana=${fecha}` : '/productions';
  return api.get(ruta);
}

/**
 * POST /api/productions
 * Devuelve { produccion, manoDeObra, stock } — el stock viene para poder
 * avisar si la arcilla quedo en rojo.
 */
export async function cargarProduccion(datos) {
  return api.post('/productions', datos);
}

/** DELETE /api/productions/:id — revierte el stock */
export async function anularProduccion(id) {
  return api.del(`/productions/${id}`);
}
