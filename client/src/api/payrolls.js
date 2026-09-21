// -----------------------------------------------------------------------------
// payrolls.js — Llamadas del modulo de liquidaciones
// -----------------------------------------------------------------------------
// Fijate que al pagar NO se manda ningun numero: solo la semana. Todos los
// montos los calcula el servidor desde las producciones y los adelantos que ya
// tiene guardados, y los vuelve a calcular en el momento de pagar.
//
// Si el navegador pudiera mandar el total, cualquiera podria cambiar un sueldo
// desde la consola del celular.
// -----------------------------------------------------------------------------

import { api } from './client.js';

/**
 * GET /api/payrolls/preview?semana=YYYY-MM-DD
 * Sirve cualquier dia de la semana. NO guarda nada.
 * Devuelve { semana, estado, detalle, totalAPagar, payrollId }.
 */
export async function obtenerPreview(semana) {
  const ruta = semana ? `/payrolls/preview?semana=${semana}` : '/payrolls/preview';
  return api.get(ruta);
}

/** POST /api/payrolls/:semana/pagar — genera el egreso y cierra la semana */
export async function marcarPagada(semana) {
  const { payroll } = await api.post(`/payrolls/${semana}/pagar`);
  return payroll;
}

/** GET /api/payrolls — historial de semanas liquidadas */
export async function listarLiquidaciones() {
  const { liquidaciones } = await api.get('/payrolls');
  return liquidaciones;
}

/**
 * GET /api/payrolls/:id/ticket/:employeeId
 * Devuelve { semana, empleado, texto, telefono, puedeWhatsApp, numeroWhatsApp }.
 * El TEXTO lo arma el servidor, no la pantalla: asi el ticket que se ve y el
 * que se manda son siempre el mismo.
 */
export async function obtenerTicket(payrollId, employeeId) {
  return api.get(`/payrolls/${payrollId}/ticket/${employeeId}`);
}
