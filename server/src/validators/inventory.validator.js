// -----------------------------------------------------------------------------
// inventory.validator.js — Que datos acepta el modulo de stock y caja
// -----------------------------------------------------------------------------
// Recordatorio de la fase 3: los .default() van en los esquemas de CREAR,
// nunca en los de EDITAR. Un PATCH significa "cambia solo esto".
// -----------------------------------------------------------------------------

import { z } from 'zod';
import { MATERIALES } from '../logic/inventory.js';
import { MONTO_MAXIMO } from '../logic/money.js';

// --- Piezas reutilizables ---------------------------------------------------

/** Fecha de negocio "YYYY-MM-DD" (plan, seccion 5.4). */
const fecha = z
  .string({ message: 'La fecha es obligatoria' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD');

/** Monto en guaranies: entero y positivo, siempre (plan, seccion 5.3). */
const montoGs = z
  .number({ message: 'El monto es obligatorio' })
  .int('El monto tiene que ser un numero entero de guaranies')
  .positive('El monto tiene que ser mayor a cero')
  .max(MONTO_MAXIMO, 'El monto es demasiado grande');

/**
 * Cantidad de material. A diferencia del dinero, ACA SI se aceptan decimales:
 * se compran 1,5 camiones. La conversion a la unidad interna entera la hace
 * el servicio.
 */
const cantidadMaterial = z
  .number({ message: 'La cantidad es obligatoria' })
  .positive('La cantidad tiene que ser mayor a cero')
  .max(1_000_000, 'La cantidad es demasiado grande');

const descripcion = z.string().trim().max(140, 'La descripcion es demasiado larga');

const material = z.enum(MATERIALES, { message: 'Material desconocido' });

// --- Stock ------------------------------------------------------------------

export const compraSchema = z.object({
  // Los ladrillos no se compran, se producen: se excluyen acá y tambien en el
  // servicio (validar en los dos lados no sobra).
  material: z.enum(['arcilla_pura', 'arcilla_floja', 'lena'], {
    message: 'Solo se compran arcilla o lena',
  }),
  cantidad: cantidadMaterial,
  monto: montoGs,
  fecha,
  descripcion: descripcion.optional().default(''),
});

export const usoLenaSchema = z.object({
  cantidad: cantidadMaterial,
  fecha,
  descripcion: descripcion.optional().default(''),
});

export const ajusteSchema = z.object({
  material,
  // En el ajuste el dueno dice CUANTO HAY, no cuanto sumar, y puede ser cero
  // (se acabo). Por eso `nonnegative` y no `positive`.
  cantidadReal: z
    .number({ message: 'La cantidad real es obligatoria' })
    .nonnegative('No puede ser negativa')
    .max(1_000_000, 'La cantidad es demasiado grande'),
  fecha,
  descripcion: descripcion.optional().default(''),
});

export const listarMovimientosSchema = z.object({
  material: material.optional(),
  limite: z.coerce.number().int().positive().max(200).optional(),
});

// --- Caja -------------------------------------------------------------------

export const egresoManualSchema = z.object({
  categoriaId: z.string({ message: 'Elegi una categoria' }).min(1, 'Elegi una categoria'),
  monto: montoGs,
  fecha,
  descripcion: descripcion.optional().default(''),
});

export const listarTransaccionesSchema = z.object({
  // En la URL todo llega como texto.
  mes: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'El mes tiene que ser YYYY-MM')
    .optional(),
});

// --- Categorias -------------------------------------------------------------

const nombreCategoria = z
  .string({ message: 'El nombre es obligatorio' })
  .trim()
  .min(2, 'El nombre es demasiado corto')
  .max(40, 'El nombre es demasiado largo');

export const crearCategoriaSchema = z.object({
  nombre: nombreCategoria,
  tipo: z.enum(['ingreso', 'egreso'], { message: 'El tipo tiene que ser ingreso o egreso' }),
});

export const editarCategoriaSchema = z
  .object({
    nombre: nombreCategoria.optional(),
    tipo: z.enum(['ingreso', 'egreso']).optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No mandaste ningun campo para cambiar',
  });

export const listarCategoriasSchema = z.object({
  tipo: z.enum(['ingreso', 'egreso']).optional(),
  elegibles: z.enum(['true', 'false']).optional(),
});

// --- Listas de precio -------------------------------------------------------

const nombreLista = nombreCategoria;
const precioPorMil = montoGs;

export const crearListaPrecioSchema = z.object({
  nombre: nombreLista,
  precioPorMil,
  predeterminada: z.boolean().optional().default(false),
});

export const editarListaPrecioSchema = z
  .object({
    nombre: nombreLista.optional(),
    precioPorMil: precioPorMil.optional(),
    predeterminada: z.boolean().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No mandaste ningun campo para cambiar',
  });

// --- Configuracion ----------------------------------------------------------

export const editarSettingsSchema = z
  .object({
    ladrillosPorCamion: z.number().int().positive().max(1_000_000).optional(),
    umbralAlertaArcilla: z.number().int().nonnegative().max(10_000_000).optional(),
    unidadLena: z.string().trim().min(1).max(20).optional(),
    configuracionInicialHecha: z.boolean().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No mandaste ningun campo para cambiar',
  });
