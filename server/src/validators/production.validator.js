// -----------------------------------------------------------------------------
// production.validator.js — Que datos acepta el modulo de produccion
// -----------------------------------------------------------------------------

import { z } from 'zod';

const fecha = z
  .string({ message: 'La fecha es obligatoria' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD');

export const crearProduccionSchema = z.object({
  fecha,

  cantidad: z
    .number({ message: 'La cantidad es obligatoria' })
    .int('La cantidad tiene que ser un numero entero de ladrillos')
    .positive('Tiene que haber al menos un ladrillo')
    // Un tope sano: mas de un millon de ladrillos en un dia es, con seguridad,
    // un cero de mas. Es mas util frenarlo que dejar entrar un numero que
    // despues rompe el stock y hay que ir a corregir a mano.
    .max(1_000_000, 'Revisa la cantidad: parece demasiado para un dia'),

  employeeIds: z
    .array(z.string().min(1), { message: 'Marca quienes trabajaron' })
    .min(1, 'Marca al menos un empleado')
    .max(50, 'Demasiados empleados'),
});

/** GET /api/productions?semana=2026-09-21 — cualquier dia de la semana sirve. */
export const listarProduccionesSchema = z.object({
  semana: fecha.optional(),
});
