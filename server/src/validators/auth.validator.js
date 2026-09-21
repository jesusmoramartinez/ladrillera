// -----------------------------------------------------------------------------
// auth.validator.js — Que forma tienen que tener los datos que llegan
// -----------------------------------------------------------------------------
// Zod es una libreria de validacion. Describis la forma esperada de un objeto
// y Zod te dice si lo que llego cumple o no, con mensajes de error listos.
//
// Por que validar si Mongoose tambien valida:
//   - Mongoose valida al GUARDAR; Zod valida ANTES de tocar la base.
//   - Nunca confies en lo que manda el cliente. Cualquiera puede mandar un
//     pedido con Postman: sin validar, un `monto: "hola"` o un objeto raro
//     llega hasta tu logica de negocio.
// -----------------------------------------------------------------------------

import { z } from 'zod';

export const loginSchema = z.object({
  username: z
    .string({ message: 'El usuario es obligatorio' })
    .trim()
    .min(1, 'Escribi tu usuario')
    .toLowerCase(),
  password: z
    .string({ message: 'La contrasena es obligatoria' })
    .min(1, 'Escribi tu contrasena'),
});

export const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1, 'Escribi tu contrasena actual'),
  passwordNueva: z
    .string()
    .min(8, 'La contrasena nueva debe tener al menos 8 caracteres')
    .max(100, 'Demasiado larga'),
});
