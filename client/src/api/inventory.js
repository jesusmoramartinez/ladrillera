// -----------------------------------------------------------------------------
// inventory.js — Llamadas del modulo de stock
// -----------------------------------------------------------------------------

import { api } from './client.js';

/** GET /api/inventory — stock actual de los cuatro materiales + alerta */
export async function obtenerStock() {
  const { stock } = await api.get('/inventory');
  return stock;
}

/** GET /api/inventory/movimientos — historial */
export async function listarMovimientos({ material, limite = 50 } = {}) {
  const params = new URLSearchParams();
  if (material) params.set('material', material);
  params.set('limite', String(limite));
  const { movimientos } = await api.get(`/inventory/movimientos?${params}`);
  return movimientos;
}

/** POST /api/inventory/compras — suma stock y genera el egreso de caja */
export async function registrarCompra(datos) {
  return api.post('/inventory/compras', datos);
}

/** DELETE /api/inventory/compras/:id — revierte stock y anula el egreso */
export async function anularCompra(id) {
  return api.del(`/inventory/compras/${id}`);
}

/** POST /api/inventory/uso-lena */
export async function registrarUsoLena(datos) {
  return api.post('/inventory/uso-lena', datos);
}

/** POST /api/inventory/ajustes — se manda cuanto HAY, no cuanto sumar */
export async function registrarAjuste(datos) {
  return api.post('/inventory/ajustes', datos);
}
