// -----------------------------------------------------------------------------
// setup.validator.js — Que datos acepta el asistente de configuracion inicial
// -----------------------------------------------------------------------------
// Este es el unico formulario del sistema que llega ENTERO de una vez: la
// unidad de lena, las listas de precio, el stock y los empleados van en el
// mismo pedido. La razon esta explicada en setup.service.js (es todo o nada).
//
// Por eso el esquema es grande. No es complejidad: es un formulario largo.
// -----------------------------------------------------------------------------

import { z } from 'zod';
import { MONTO_MAXIMO } from '../logic/money.js';

const fecha = z
  .string({ message: 'La fecha es obligatoria' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD');

// --- Paso 1: los parametros del negocio ------------------------------------

const unidadLena = z
  .string({ message: 'Hay que decir como se mide la lena' })
  .trim()
  .min(1, 'Hay que decir como se mide la lena')
  .max(20, 'Demasiado largo');

const ladrillosPorCamion = z
  .number({ message: 'Hay que decir cuantos ladrillos salen de un camion' })
  .int('Tiene que ser un numero entero')
  .positive('Tiene que ser mayor a cero')
  .max(10_000_000, 'Revisa el numero: parece demasiado');

const umbralAlertaArcilla = z
  .number({ message: 'Hay que decir a partir de cuando avisar' })
  .int('Tiene que ser un numero entero')
  .min(0, 'No puede ser negativo')
  .max(10_000_000, 'Revisa el numero: parece demasiado');

// --- Paso 1: las listas de precio ------------------------------------------

const listaDePrecio = z.object({
  nombre: z
    .string({ message: 'La lista necesita un nombre' })
    .trim()
    .min(2, 'El nombre es demasiado corto')
    .max(40, 'El nombre es demasiado largo'),

  precioPorMil: z
    .number({ message: 'El precio es obligatorio' })
    .int('El precio tiene que ser un numero entero de guaranies')
    .positive('El precio tiene que ser mayor a cero')
    .max(MONTO_MAXIMO, 'El precio es demasiado grande'),
});

// --- Paso 2: el stock que hay hoy en el patio ------------------------------
//
// Las dos arcillas llegan en CAMIONES (decimal: "2,5 camiones"), porque es
// como las cuenta el dueno parado en el patio. La conversion a
// ladrillos-equivalentes la hace el servicio, no la pantalla.

const camiones = z
  .number({ message: 'Hay que poner cuantos camiones hay' })
  .min(0, 'No puede ser negativo')
  .max(1000, 'Revisa el numero: parece demasiado');

const unidades = z
  .number({ message: 'Hay que poner la cantidad' })
  .int('Tiene que ser un numero entero')
  .min(0, 'No puede ser negativo')
  .max(100_000_000, 'Revisa el numero: parece demasiado');

const stock = z.object({
  arcillaPura: camiones,
  arcillaFloja: camiones,
  lena: unidades,
  ladrillos: unidades,
});

// --- Paso 3: los empleados -------------------------------------------------

const empleado = z.object({
  nombre: z
    .string({ message: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'El nombre es demasiado corto')
    .max(60, 'El nombre es demasiado largo'),

  rol: z.string().trim().max(40, 'El rol es demasiado largo').optional().default(''),

  telefono: z.string().trim().max(30, 'El telefono es demasiado largo').optional().default(''),

  tarifaPorMil: z
    .number({ message: 'La tarifa es obligatoria' })
    .int('La tarifa tiene que ser un numero entero de guaranies')
    .positive('La tarifa tiene que ser mayor a cero')
    .max(MONTO_MAXIMO, 'La tarifa es demasiado grande'),
});

// --- El pedido completo ----------------------------------------------------

export const configuracionInicialSchema = z.object({
  fecha,

  unidadLena,
  ladrillosPorCamion,
  umbralAlertaArcilla,

  // "Al menos Normal" (plan, 5.11b): sin ninguna lista no se puede vender.
  listasDePrecio: z
    .array(listaDePrecio)
    .min(1, 'Hace falta al menos una lista de precio')
    .max(10, 'Demasiadas listas para empezar'),

  stock,

  // Los empleados SI pueden ser cero: una fabrica chica puede arrancar sin
  // nadie cargado y agregarlos despues desde Empleados.
  empleados: z.array(empleado).max(50, 'Demasiados empleados para el asistente'),
});
