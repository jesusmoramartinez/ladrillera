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

/** PATCH /api/settings — cambia solo lo que se manda. */
export async function guardarConfig(cambios) {
  const { config } = await api.patch('/settings', cambios);
  return config;
}

/** POST /api/price-lists */
export async function crearListaPrecio(datos) {
  const { lista } = await api.post('/price-lists', datos);
  return lista;
}

/** PATCH /api/price-lists/:id — precio, nombre o marcarla predeterminada. */
export async function editarListaPrecio(id, cambios) {
  const { lista } = await api.patch(`/price-lists/${id}`, cambios);
  return lista;
}

/** DELETE /api/price-lists/:id — baja logica. La predeterminada no se puede. */
export async function eliminarListaPrecio(id) {
  return api.del(`/price-lists/${id}`);
}

/** PATCH /api/categories/:id */
export async function editarCategoria(id, cambios) {
  const { categoria } = await api.patch(`/categories/${id}`, cambios);
  return categoria;
}

/** DELETE /api/categories/:id — las de sistema no se pueden tocar. */
export async function eliminarCategoria(id) {
  return api.del(`/categories/${id}`);
}
