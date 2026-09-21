// -----------------------------------------------------------------------------
// sales.js — Llamadas del modulo de ventas
// -----------------------------------------------------------------------------
// Las ventas vienen del servidor con los derivados YA calculados: `cobrado`,
// `porCobrar`, `estadoPago`, `entregado`, `porEntregar`, `estadoEntrega`. La
// pantalla no vuelve a sumar pagos por su cuenta, y por eso no puede mostrar
// un numero distinto al que tiene la base.
// -----------------------------------------------------------------------------

import { api } from './client.js';

/**
 * GET /api/sales
 * @param {{ estado?: 'por-cobrar'|'por-entregar', clientId?: string }} filtros
 * @returns {Promise<{ventas: Array, totales: {porCobrar: number, porEntregar: number}}>}
 */
export async function listarVentas({ estado, clientId } = {}) {
  const params = new URLSearchParams();
  if (estado) params.set('estado', estado);
  if (clientId) params.set('cliente', clientId);

  const query = params.toString();
  const { ventas, totales } = await api.get(`/sales${query ? `?${query}` : ''}`);
  return { ventas, totales };
}

/** GET /api/sales/:id — la venta con sus pagos y entregas vigentes */
export async function obtenerVenta(id) {
  const { venta } = await api.get(`/sales/${id}`);
  return venta;
}

/**
 * POST /api/sales
 * Devuelve { venta, aviso, stock }. `aviso` dice si se vendio por mas de lo
 * libre: avisa, no bloquea (plan 5.7).
 */
export async function crearVenta(datos) {
  return api.post('/sales', datos);
}

/** DELETE /api/sales/:id — solo si no tiene pagos ni entregas vigentes */
export async function anularVenta(id) {
  const { venta } = await api.del(`/sales/${id}`);
  return venta;
}

/** POST /api/sales/:id/pagos — genera el ingreso de caja */
export async function registrarPago(saleId, datos) {
  const { venta } = await api.post(`/sales/${saleId}/pagos`, datos);
  return venta;
}

/** DELETE /api/sales/:id/pagos/:pagoId — anula tambien su ingreso */
export async function anularPago(saleId, pagoId) {
  const { venta } = await api.del(`/sales/${saleId}/pagos/${pagoId}`);
  return venta;
}

/**
 * POST /api/sales/:id/entregas — saca los ladrillos del patio.
 * Devuelve { venta, aviso, stock }.
 */
export async function registrarEntrega(saleId, datos) {
  return api.post(`/sales/${saleId}/entregas`, datos);
}

/** DELETE /api/sales/:id/entregas/:entregaId — los devuelve al patio */
export async function anularEntrega(saleId, entregaId) {
  const { venta } = await api.del(`/sales/${saleId}/entregas/${entregaId}`);
  return venta;
}
