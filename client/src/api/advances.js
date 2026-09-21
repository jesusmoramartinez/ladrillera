// -----------------------------------------------------------------------------
// advances.js — Llamadas del modulo de adelantos
// -----------------------------------------------------------------------------

import { api } from './client.js';

/**
 * GET /api/advances?semana=YYYY-MM-DD
 * Sirve cualquier dia de la semana: el servidor calcula el lunes y el sabado.
 * Devuelve { semana, adelantos, resumen }.
 */
export async function obtenerSemana(fecha) {
  const ruta = fecha ? `/advances?semana=${fecha}` : '/advances';
  return api.get(ruta);
}

/** POST /api/advances — crea el adelanto Y su egreso de caja */
export async function darAdelanto(datos) {
  const { adelanto } = await api.post('/advances', datos);
  return adelanto;
}

/** DELETE /api/advances/:id — anula tambien su egreso */
export async function anularAdelanto(id) {
  const { adelanto } = await api.del(`/advances/${id}`);
  return adelanto;
}
