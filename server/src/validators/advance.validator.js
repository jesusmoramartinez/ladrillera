// -----------------------------------------------------------------------------
// advance.validator.js — Que datos acepta el modulo de adelantos
// -----------------------------------------------------------------------------

import { z } from 'zod';

const fecha = z
  .string({ message: 'La fecha es obligatoria' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD');

export const crearAdelantoSchema = z.object({
  employeeId: z
    .string({ message: 'Hay que elegir el empleado' })
    .regex(/^[a-f\d]{24}$/i, 'Identificador invalido'),

  monto: z
    .number({ message: 'El monto es obligatorio' })
    .int('El monto tiene que ser un numero entero de guaranies')
    .positive('El adelanto tiene que ser mayor a cero')
    // Un tope sano, del mismo espiritu que el de produccion: un adelanto de
    // mil millones es un cero de mas, no una decision. Es mas util frenarlo
    // que dejarlo entrar y tener que anularlo despues junto con su egreso.
    .max(1_000_000_000, 'Revisa el monto: parece demasiado para un adelanto'),

  fecha,

  descripcion: z.string().trim().max(140, 'La descripcion es demasiado larga').optional().default(''),
});

/** GET /api/advances?semana=2026-09-21 — cualquier dia de la semana sirve. */
export const listarAdelantosSchema = z.object({
  semana: fecha.optional(),
});
