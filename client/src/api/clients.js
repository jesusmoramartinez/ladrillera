// -----------------------------------------------------------------------------
// clients.js — Llamadas del modulo de clientes
// -----------------------------------------------------------------------------

import { api } from './client.js';

/**
 * GET /api/clients
 * Cada cliente viene con `porCobrar`, `porEntregar` y `ventasPendientes`, que
 * el servidor calcula desde sus ventas (no son campos guardados).
 *
 * @param {{ soloConSaldo?: boolean }} opciones
 */
export async function listarClientes({ soloConSaldo = false } = {}) {
  const ruta = soloConSaldo ? '/clients?conSaldo=true' : '/clients';
  const { clientes } = await api.get(ruta);
  return clientes;
}

/** POST /api/clients */
export async function crearCliente(datos) {
  const { cliente } = await api.post('/clients', datos);
  return cliente;
}

/** PATCH /api/clients/:id — manda SOLO los campos que cambian */
export async function editarCliente(id, cambios) {
  const { cliente } = await api.patch(`/clients/${id}`, cambios);
  return cliente;
}

/** DELETE /api/clients/:id — falla con 409 si el cliente todavia debe algo */
export async function eliminarCliente(id) {
  const { cliente } = await api.del(`/clients/${id}`);
  return cliente;
}
