// -----------------------------------------------------------------------------
// employees.js — Llamadas del modulo de empleados
// -----------------------------------------------------------------------------
// Una funcion por endpoint. Las pantallas llaman a estas funciones y no saben
// nada de URLs ni de fetch: si manana cambia una ruta, se toca solo este archivo.
// El token lo agrega solo api/client.js.
// -----------------------------------------------------------------------------

import { api } from './client.js';

/**
 * GET /api/employees
 * @param {{ soloActivos?: boolean }} opciones
 */
export async function listarEmpleados({ soloActivos = false } = {}) {
  const ruta = soloActivos ? '/employees?activo=true' : '/employees';
  const { empleados } = await api.get(ruta);
  return empleados;
}

/** POST /api/employees */
export async function crearEmpleado(datos) {
  const { empleado } = await api.post('/employees', datos);
  return empleado;
}

/** PATCH /api/employees/:id — manda SOLO los campos que cambian */
export async function editarEmpleado(id, cambios) {
  const { empleado } = await api.patch(`/employees/${id}`, cambios);
  return empleado;
}

/** DELETE /api/employees/:id — soft delete: lo marca, no lo borra */
export async function eliminarEmpleado(id) {
  const { empleado } = await api.del(`/employees/${id}`);
  return empleado;
}
