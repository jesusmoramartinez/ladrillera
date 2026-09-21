// -----------------------------------------------------------------------------
// transaction.service.js — Reglas de la caja
// -----------------------------------------------------------------------------
// Ojo con la palabra "transaccion", que acá significa dos cosas distintas:
//
//   - transaccion de CAJA  = un movimiento de plata (lo de este archivo)
//   - transaccion de MONGO = el "todo o nada" de la base
//
// Se llaman igual por casualidad. El plan usa `transactions` para la coleccion
// de caja, asi que se mantiene ese nombre.
//
// El balance del mes es "ingresos menos egresos del mes", sin saldo inicial ni
// acumulado (plan, seccion 1). Es lo que el dueno realmente quiere saber:
// "este mes, ¿gane o perdi?".
// -----------------------------------------------------------------------------

import { ApiError } from '../middleware/errorHandler.js';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';

const VIGENTES = { deletedAt: null };

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/**
 * Convierte "2026-09" en el rango de fechas del mes, como texto.
 *
 * Trabajamos con TEXTO y no con objetos Date a proposito. Las fechas de
 * negocio se guardan como "YYYY-MM-DD" (plan, 5.4), y en ese formato el orden
 * alfabetico coincide con el cronologico: "2026-09-01" < "2026-09-30". Asi
 * Mongo puede comparar con $gte/$lte sin convertir nada y sin que se meta
 * ninguna zona horaria en el medio.
 */
function rangoDelMes(mes) {
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    throw new ApiError(400, 'El mes tiene que tener el formato YYYY-MM');
  }
  // "2026-09-32" no existe como fecha, pero como TEXTO es mayor que cualquier
  // dia real del mes, que es todo lo que necesitamos para el limite superior.
  return { desde: `${mes}-01`, hasta: `${mes}-31` };
}

/**
 * Movimientos de un mes + su balance.
 * @param {string} mes "2026-09"
 */
export async function listarPorMes(mes) {
  const { desde, hasta } = rangoDelMes(mes);

  const movimientos = await Transaction.find({
    ...VIGENTES,
    fecha: { $gte: desde, $lte: hasta },
  }).sort({ fecha: -1, createdAt: -1 });

  let ingresos = 0;
  let egresos = 0;
  for (const m of movimientos) {
    if (m.tipo === 'ingreso') ingresos += m.monto;
    else egresos += m.monto;
  }

  return {
    mes,
    movimientos,
    balance: { ingresos, egresos, resultado: ingresos - egresos },
  };
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

/**
 * Gasto operativo cargado a mano por el dueno.
 * La categoria la elige el; no puede ser una de sistema.
 */
export async function crearEgresoManual({ categoriaId, monto, fecha, descripcion = '' }) {
  const categoria = await Category.findOne({ _id: categoriaId, ...VIGENTES });
  if (!categoria) throw new ApiError(404, 'La categoria no existe');

  if (categoria.sistema) {
    throw new ApiError(
      400,
      `"${categoria.nombre}" la usa el sistema: esos movimientos se generan solos`,
    );
  }
  if (categoria.tipo !== 'egreso') {
    throw new ApiError(400, `"${categoria.nombre}" es una categoria de ingreso`);
  }

  return Transaction.create({
    tipo: 'egreso',
    categoriaId: categoria._id,
    categoriaNombre: categoria.nombre, // snapshot (ver el modelo)
    monto,
    fecha,
    descripcion,
    origen: { tipo: 'manual', id: null },
  });
}

/**
 * Movimiento generado por otro modulo (compra, pago de venta, adelanto,
 * liquidacion). Busca la categoria de sistema por su CLAVE, no por su nombre:
 * el nombre es para mostrar, la clave es la que no cambia nunca.
 *
 * Recibe la `session` porque casi siempre se llama dentro de una transaccion
 * de Mongo abierta por quien la llama.
 */
export async function crearMovimientoDeSistema(
  { tipo, claveCategoria, monto, fecha, descripcion = '', origenTipo, origenId = null },
  session,
) {
  const categoria = await Category.findOne({ clave: claveCategoria }).session(session ?? null);
  if (!categoria) {
    throw new ApiError(
      500,
      `Falta la categoria de sistema "${claveCategoria}". Corre: npm run seed --workspace server`,
    );
  }

  const [movimiento] = await Transaction.create(
    [
      {
        tipo,
        categoriaId: categoria._id,
        categoriaNombre: categoria.nombre,
        monto,
        fecha,
        descripcion,
        origen: { tipo: origenTipo, id: origenId },
      },
    ],
    { session },
  );

  return movimiento;
}

/** Atajo para los egresos automaticos. */
export function crearEgresoDeSistema(datos, session) {
  return crearMovimientoDeSistema({ ...datos, tipo: 'egreso' }, session);
}

/** Atajo para los ingresos automaticos (lo usa la fase 6). */
export function crearIngresoDeSistema(datos, session) {
  return crearMovimientoDeSistema({ ...datos, tipo: 'ingreso' }, session);
}

// ---------------------------------------------------------------------------
// Anulacion
// ---------------------------------------------------------------------------

/**
 * Anula un movimiento cargado a mano.
 *
 * Los automaticos NO se pueden anular desde acá: si se pudiera, quedaria una
 * compra con stock sumado y sin egreso, y los numeros dejarian de cerrar. Hay
 * que anular el hecho que lo genero, y eso se lleva el egreso puesto.
 */
export async function anularManual(id) {
  const movimiento = await Transaction.findOne({ _id: id, ...VIGENTES });
  if (!movimiento) throw new ApiError(404, 'El movimiento no existe');

  if (movimiento.origen?.tipo !== 'manual') {
    throw new ApiError(
      400,
      'Este movimiento lo genero otra operacion. Anula esa operacion y el movimiento se va con ella.',
    );
  }

  movimiento.deletedAt = new Date();
  await movimiento.save();
  return movimiento;
}

/** Anula el movimiento que genero una operacion (la usa anularCompra). */
export async function anularPorOrigen({ tipo, movimientoId }, session) {
  const movimiento = await Transaction.findOne({
    'origen.tipo': tipo,
    'origen.id': movimientoId,
    ...VIGENTES,
  }).session(session ?? null);

  if (!movimiento) return null; // ya estaba anulado o nunca existio

  movimiento.deletedAt = new Date();
  await movimiento.save({ session });
  return movimiento;
}
