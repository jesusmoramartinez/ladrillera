// -----------------------------------------------------------------------------
// caja.js — Llamadas de caja, categorias y configuracion
// -----------------------------------------------------------------------------

import { api } from './client.js';

/**
 * GET /api/transactions?mes=YYYY-MM
 * Devuelve { mes, movimientos, balance }.
 */
export async function obtenerCaja(mes) {
  const ruta = mes ? `/transactions?mes=${mes}` : '/transactions';
  return api.get(ruta);
}

/** POST /api/transactions/egreso — gasto cargado a mano */
export async function registrarEgreso(datos) {
  const { movimiento } = await api.post('/transactions/egreso', datos);
  return movimiento;
}

/** DELETE /api/transactions/:id — solo gastos manuales */
export async function anularMovimiento(id) {
  return api.del(`/transactions/${id}`);
}

/**
 * GET /api/categories
 * `elegibles: true` saca las de sistema, que el dueno no puede usar a mano.
 */
export async function listarCategorias({ tipo, elegibles = false } = {}) {
  const params = new URLSearchParams();
  if (tipo) params.set('tipo', tipo);
  if (elegibles) params.set('elegibles', 'true');
  const { categorias } = await api.get(`/categories?${params}`);
  return categorias;
}

/** POST /api/categories */
export async function crearCategoria(datos) {
  const { categoria } = await api.post('/categories', datos);
  return categoria;
}

/** GET /api/settings */
export async function obtenerConfig() {
  const { config } = await api.get('/settings');
  return config;
}

/**
 * GET /api/price-lists — las listas de precio para vender (fase 6).
 * Vienen ordenadas con la predeterminada primero.
 */
export async function listarListasPrecio() {
  const { listas } = await api.get('/price-lists');
  return listas;
}
