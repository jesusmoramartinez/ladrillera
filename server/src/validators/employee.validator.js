// -----------------------------------------------------------------------------
// employee.validator.js — Que datos acepta el modulo de empleados
// -----------------------------------------------------------------------------
// Recordatorio: el frontend tambien valida, pero esa validacion es comodidad.
// La de aca es la real: cualquiera puede mandar un pedido con Postman
// salteandose la pantalla entera.
//
// OJO con los .default() en un PATCH. Ver la nota grande mas abajo: por poner
// un default en el lugar equivocado, editar la tarifa borraba el rol.
// -----------------------------------------------------------------------------

import { z } from 'zod';
import { MONTO_MAXIMO } from '../logic/money.js';

// --- Reglas de cada campo, SIN decidir si son obligatorios ni que default
// --- tienen. Eso cambia entre crear y editar, asi que se decide abajo.

const nombre = z
  .string({ message: 'El nombre es obligatorio' })
  .trim()
  .min(2, 'El nombre es demasiado corto')
  .max(60, 'El nombre es demasiado largo');

const rol = z.string().trim().max(40, 'El rol es demasiado largo');

// Fase 8: hace falta para mandarle el ticket por WhatsApp. Opcional.
const telefono = z.string().trim().max(30, 'El telefono es demasiado largo');

const tarifaPorMil = z
  .number({ message: 'La tarifa es obligatoria' })
  .int('La tarifa tiene que ser un numero entero de guaranies')
  .positive('La tarifa tiene que ser mayor a cero')
  .max(MONTO_MAXIMO, 'La tarifa es demasiado grande');

const activo = z.boolean();

// --- Al CREAR si tiene sentido completar lo que falta con un valor por defecto.

export const crearEmpleadoSchema = z.object({
  nombre,
  rol: rol.optional().default(''),
  telefono: telefono.optional().default(''),
  tarifaPorMil,
  activo: activo.optional().default(true),
});

// --- Al EDITAR, NO.
//
// Un PATCH significa "cambia solo esto y deja el resto como esta". Si el
// esquema pusiera .default('') en el rol, mandar unicamente
//     { tarifaPorMil: 180000 }
// se convertiria en
//     { tarifaPorMil: 180000, rol: '' }
// y el rol se borraria sin que nadie lo pidiera. Ese bug estuvo escrito aca
// literalmente diez minutos, hasta que lo encontro el test
// "cambia solo el campo que se manda".
//
// Regla para acordarse: los defaults van en el CREAR, nunca en el EDITAR.

export const editarEmpleadoSchema = z
  .object({
    nombre: nombre.optional(),
    rol: rol.optional(),
    telefono: telefono.optional(),
    tarifaPorMil: tarifaPorMil.optional(),
    activo: activo.optional(),
  })
  // Exigimos al menos un campo: un PATCH vacio suele ser un bug del frontend,
  // y es mejor avisarlo que responder "listo" sin haber hecho nada.
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No mandaste ningun campo para cambiar',
  });

// Filtros de la lista: /api/employees?activo=true
// Ojo: en la URL todo llega como TEXTO, por eso "true" (con comillas) y no true.
export const listarEmpleadosSchema = z.object({
  activo: z.enum(['true', 'false']).optional(),
});
