// -----------------------------------------------------------------------------
// sale.validator.js — Que datos aceptan clientes y ventas
// -----------------------------------------------------------------------------
// Zod es la primera puerta: si los datos no tienen la forma correcta, el
// pedido muere acá y nunca llega al servicio.
//
// LA REGLA QUE YA NOS MORDIO UNA VEZ (fase 3):
//   .default() va en los esquemas de CREAR, nunca en los de EDITAR.
//
// Al crear tiene sentido: "si no mandaste telefono, queda vacio". Al editar es
// un desastre: un PATCH que solo cambia el nombre traeria telefono: '' por el
// default, y borraria el telefono que estaba guardado. Por eso las reglas de
// cada campo se escriben UNA vez y despues se componen distinto en cada
// esquema.
//
// LO QUE NO SE MANDA DESDE EL NAVEGADOR
//
// Fijate que no hay `subtotal`, ni `descuentoGs`, ni `montoTotal`. Esos tres
// los calcula el servidor con la lista de precio que tiene guardada. Si se
// aceptaran desde afuera, cualquiera podria mandar montoTotal: 1 con un
// programa de dos lineas. La pantalla los calcula igual, pero solo para
// mostrarlos mientras se escribe.
// -----------------------------------------------------------------------------

import { z } from 'zod';
import { TIPOS_DESCUENTO } from '../logic/sales.js';

const fecha = z
  .string({ message: 'La fecha es obligatoria' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD');

const idDeMongo = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador invalido');

const montoGs = z
  .number({ message: 'El monto es obligatorio' })
  .int('El monto tiene que ser un numero entero de guaranies')
  .positive('El monto tiene que ser mayor a cero')
  .max(9_000_000_000_000, 'El monto es demasiado grande');

const ladrillos = z
  .number({ message: 'La cantidad es obligatoria' })
  .int('La cantidad tiene que ser un numero entero de ladrillos')
  .positive('Tiene que haber al menos un ladrillo')
  .max(5_000_000, 'Revisa la cantidad: parece demasiado');

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

const nombreCliente = z
  .string({ message: 'El nombre es obligatorio' })
  .trim()
  .min(2, 'El nombre es demasiado corto')
  .max(80, 'El nombre es demasiado largo');

const telefono = z.string().trim().max(30, 'El telefono es demasiado largo');
const notas = z.string().trim().max(200, 'Las notas son demasiado largas');

export const crearClienteSchema = z.object({
  nombre: nombreCliente,
  telefono: telefono.optional().default(''),
  notas: notas.optional().default(''),
});

// Sin .default(): mandar solo { nombre } no tiene que borrar el telefono.
export const editarClienteSchema = z
  .object({
    nombre: nombreCliente.optional(),
    telefono: telefono.optional(),
    notas: notas.optional(),
  })
  // Un PATCH vacio no es un error: no cambia nada y devuelve el cliente igual.
  .strict();

export const listarClientesSchema = z.object({
  conSaldo: z.enum(['true', 'false']).optional(),
});

// ---------------------------------------------------------------------------
// Ventas
// ---------------------------------------------------------------------------

/**
 * El descuento, tal cual lo eligio el dueno.
 *
 * `superRefine` permite una validacion que mira DOS campos a la vez: el limite
 * del valor depende del tipo. Un 150 % no existe; en cambio 150.000 Gs es
 * perfectamente valido (y si supera al subtotal lo frena el servicio, que es
 * el unico que conoce el subtotal).
 */
const descuento = z
  .object({
    tipo: z.enum(TIPOS_DESCUENTO, { message: 'Tipo de descuento invalido' }),
    valor: z.number({ message: 'El valor del descuento es obligatorio' }).min(0),
  })
  .superRefine((valor, ctx) => {
    if (valor.tipo === 'porcentaje' && valor.valor > 100) {
      ctx.addIssue({ code: 'custom', message: 'El porcentaje va de 0 a 100', path: ['valor'] });
    }
    if (valor.tipo === 'monto' && !Number.isInteger(valor.valor)) {
      ctx.addIssue({
        code: 'custom',
        message: 'El descuento en guaranies tiene que ser entero',
        path: ['valor'],
      });
    }
  });

export const crearVentaSchema = z.object({
  fecha,
  // nullable ADEMAS de optional: la pantalla manda null cuando no hay cliente
  // elegido, y null no es lo mismo que "no vino el campo".
  clientId: idDeMongo.nullable().optional().default(null),
  cantidad: ladrillos,
  listaPrecioId: idDeMongo,
  descuento: descuento.nullable().optional().default(null),
  pagadoCompleto: z.boolean().optional().default(false),
  entregadoCompleto: z.boolean().optional().default(false),
});

export const listarVentasSchema = z.object({
  estado: z.enum(['por-cobrar', 'por-entregar']).optional(),
  cliente: idDeMongo.optional(),
});

export const crearPagoSchema = z.object({
  fecha,
  monto: montoGs,
});

export const crearEntregaSchema = z.object({
  fecha,
  cantidad: ladrillos,
});
