// -----------------------------------------------------------------------------
// employee.service.js — Reglas de negocio de empleados
// -----------------------------------------------------------------------------
// El servicio no sabe nada de HTTP. Recibe datos comunes, devuelve datos
// comunes, y lanza ApiError cuando algo no se puede hacer.
//
// Concepto que atraviesa todo el archivo: SOFT DELETE. Nunca se borra un
// documento; se le pone `deletedAt`. Todas las consultas filtran
// `deletedAt: null`, asi lo eliminado desaparece de la vista pero sigue
// existiendo para los registros historicos.
// -----------------------------------------------------------------------------

import { ApiError } from '../middleware/errorHandler.js';
import { Employee } from '../models/Employee.js';

/** Filtro base: lo que NO fue eliminado. */
const VIGENTES = { deletedAt: null };

/**
 * Lista los empleados.
 * @param {{ soloActivos?: boolean }} opciones
 */
export async function listar({ soloActivos = false } = {}) {
  const filtro = { ...VIGENTES };
  if (soloActivos) filtro.activo = true;

  // Orden: primero los activos, y dentro de cada grupo por nombre.
  // En Mongo, -1 es descendente: para un booleano, true (1) va antes que
  // false (0), que es justo lo que queremos.
  return Employee.find(filtro).sort({ activo: -1, nombre: 1 });
}

/**
 * Busca uno por id. Lanza 404 si no existe o si fue eliminado.
 * Lo usan editar() y eliminar(), y mas adelante produccion y liquidaciones.
 */
export async function buscarPorId(id) {
  const empleado = await Employee.findOne({ _id: id, ...VIGENTES });
  if (!empleado) throw new ApiError(404, 'El empleado no existe');
  return empleado;
}

export async function crear(datos) {
  return Employee.create(datos);
}

/**
 * Edita un empleado. Solo toca los campos que vinieron.
 *
 * IMPORTANTE para cuando llegue la fase 5: cambiar la tarifa NO cambia las
 * producciones ya cargadas. Cada produccion guarda una "foto" (snapshot) de la
 * tarifa del momento (plan 4.3), justamente para que subir la tarifa en octubre
 * no reescriba lo que se pago en septiembre.
 */
export async function editar(id, cambios) {
  const empleado = await buscarPorId(id);

  // Object.assign copia solo las claves presentes. Como el validador ya filtro
  // lo que no corresponde, no hay riesgo de que entre un campo de mas.
  Object.assign(empleado, cambios);

  // .save() (en vez de findByIdAndUpdate) hace que corran las validaciones del
  // esquema y los hooks del modelo. Es el camino seguro.
  await empleado.save();
  return empleado;
}

/**
 * Soft delete: marca la fecha de eliminacion.
 *
 * Es seguro borrar un empleado aunque tenga producciones cargadas, porque esas
 * producciones guardaron su nombre y su tarifa adentro. No quedan apuntando a
 * un documento que ya no se puede leer.
 */
export async function eliminar(id) {
  const empleado = await buscarPorId(id);
  empleado.deletedAt = new Date();
  await empleado.save();
  return empleado;
}
