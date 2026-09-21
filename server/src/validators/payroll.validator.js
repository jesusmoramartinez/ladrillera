// -----------------------------------------------------------------------------
// payroll.validator.js — Que datos acepta el modulo de liquidaciones
// -----------------------------------------------------------------------------
// Es el validador mas corto del sistema, y eso dice algo: al liquidar NO se
// manda ningun numero. Solo se dice QUE SEMANA. Todos los montos los calcula
// el servidor desde las producciones y los adelantos que ya estan guardados.
//
// Si el navegador pudiera mandar el total a pagar, cualquiera podria cambiar
// un sueldo desde la consola del celular.
// -----------------------------------------------------------------------------

import { z } from 'zod';

const fecha = z
  .string({ message: 'La fecha es obligatoria' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD');

/** GET /api/payrolls/preview?semana=2026-09-21 — cualquier dia de la semana sirve. */
export const previewSchema = z.object({
  semana: fecha.optional(),
});
