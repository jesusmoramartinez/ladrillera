// -----------------------------------------------------------------------------
// inventory.service.js — Reglas del stock
// -----------------------------------------------------------------------------
// Es el archivo mas importante de la fase 4, porque acá vive el "todo o nada".
//
// Toda operacion que cambia el stock hace DOS escrituras que tienen que ir
// juntas si o si:
//   1. actualizar el total en `inventory`
//   2. anotar la linea en `inventoryMovements`
// y la compra de material agrega una tercera: el egreso en `transactions`.
//
// Las tres van dentro de una transaccion. Si falla cualquiera, no queda nada.
// -----------------------------------------------------------------------------

import { conTransaccion } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import {
  MATERIALES,
  MATERIALES_ARCILLA,
  alertaArcilla,
  camionesALadrillos,
  esArcilla,
  ladrillosACamiones,
  stockLadrillos,
} from '../logic/inventory.js';
import { Inventory } from '../models/Inventory.js';
import { InventoryMovement } from '../models/InventoryMovement.js';
// El MODELO de ventas, no su servicio: ver el comentario en obtenerStock().
import { Sale } from '../models/Sale.js';
import { Setting } from '../models/Setting.js';
import * as transactionService from './transaction.service.js';

// ---------------------------------------------------------------------------
// Primitiva interna: mover stock
// ---------------------------------------------------------------------------

/**
 * Suma (o resta) stock y deja la linea en el historial. Las dos cosas, o
 * ninguna: SIEMPRE se llama desde adentro de una transaccion.
 *
 * @param {object} p
 * @param {string} p.material
 * @param {number} p.cantidad   positivo entra, negativo sale
 * @param {string} p.motivo
 * @param {string} p.fecha      "YYYY-MM-DD"
 * @param {object} [p.origen]
 * @param {string} [p.descripcion]
 * @param {import('mongoose').ClientSession} p.session
 */
async function moverStock({ material, cantidad, motivo, fecha, origen, descripcion, session }) {
  if (!Number.isInteger(cantidad) || cantidad === 0) {
    throw new ApiError(400, 'La cantidad del movimiento tiene que ser un entero distinto de cero');
  }

  // $inc suma en la BASE, no en el servidor. La diferencia importa: si
  // leyeramos el valor, sumaramos en JavaScript y lo volvieramos a guardar,
  // dos pedidos simultaneos podrian leer el mismo numero y uno pisaria al
  // otro. Con $inc la suma la hace Mongo de forma atomica.
  await Inventory.updateOne(
    { material },
    { $inc: { cantidad } },
    { upsert: true, session }, // upsert: si el material no existia, lo crea
  );

  // Dentro de una transaccion, create() necesita un ARRAY para que respete
  // la opcion { session }.
  const [movimiento] = await InventoryMovement.create(
    [{ material, cantidad, motivo, fecha, origen, descripcion }],
    { session },
  );

  return movimiento;
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/**
 * El stock actual de todos los materiales, listo para mostrar.
 *
 * Devuelve la arcilla en las DOS unidades: la interna (ladrillos-equivalentes,
 * que es la exacta) y en camiones (que es como la piensa el dueno).
 *
 * @param {import('mongoose').ClientSession} [session] para leer DENTRO de una
 *   transaccion abierta y ver lo que esa misma transaccion acaba de escribir.
 */
export async function obtenerStock(session) {
  const config = await Setting.obtener();

  const documentos = await Inventory.find({}).session(session ?? null);
  const porMaterial = Object.fromEntries(documentos.map((d) => [d.material, d.cantidad]));

  // Si un material todavia no tiene documento, vale 0.
  const cantidades = Object.fromEntries(MATERIALES.map((m) => [m, porMaterial[m] ?? 0]));

  // Los ladrillos ya vendidos y todavia no entregados (plan, seccion 5.7).
  // Lo pregunta al MODELO y no al servicio de ventas: si le preguntara al
  // servicio tendriamos inventory -> sales -> inventory, una importacion
  // circular. Ver el comentario de Sale.js.
  const comprometido = await Sale.totalComprometido(session);

  const alerta = alertaArcilla(
    cantidades.arcilla_pura,
    cantidades.arcilla_floja,
    config.umbralAlertaArcilla,
  );

  return {
    arcilla_pura: {
      cantidad: cantidades.arcilla_pura,
      camiones: ladrillosACamiones(cantidades.arcilla_pura, config.ladrillosPorCamion),
    },
    arcilla_floja: {
      cantidad: cantidades.arcilla_floja,
      camiones: ladrillosACamiones(cantidades.arcilla_floja, config.ladrillosPorCamion),
    },
    lena: {
      cantidad: cantidades.lena,
      unidad: config.unidadLena,
    },
    // Fase 6: el comprometido sale de las ventas. No es un numero guardado
    // en ningun lado, es la suma de lo que falta entregar de todas las ventas
    // vigentes, y por eso baja solo a medida que se entrega.
    ladrillos: stockLadrillos(cantidades.ladrillos, comprometido),
    alertaArcilla: alerta,
    config: {
      ladrillosPorCamion: config.ladrillosPorCamion,
      umbralAlertaArcilla: config.umbralAlertaArcilla,
      unidadLena: config.unidadLena,
    },
  };
}

/** Historial de movimientos, del mas nuevo al mas viejo. */
export async function listarMovimientos({ material, limite = 50 } = {}) {
  const filtro = {};
  if (material) filtro.material = material;

  return InventoryMovement.find(filtro).sort({ createdAt: -1 }).limit(Math.min(limite, 200));
}

// ---------------------------------------------------------------------------
// Compra de material (plan, seccion 5.6)
// ---------------------------------------------------------------------------

/**
 * Registra una compra: suma stock Y crea el egreso de caja, en una sola
 * transaccion.
 *
 * La arcilla se compra en CAMIONES (puede ser 1,5) y se guarda en
 * ladrillos-equivalentes (entero). La lena, en la unidad del dueno.
 *
 * @param {object} p
 * @param {string} p.material
 * @param {number} p.cantidad     camiones si es arcilla; unidades si es lena
 * @param {number} p.monto        guaranies, entero
 * @param {string} p.fecha        "YYYY-MM-DD"
 * @param {string} [p.descripcion]
 */
export async function registrarCompra({ material, cantidad, monto, fecha, descripcion = '' }) {
  if (material === 'ladrillos') {
    throw new ApiError(400, 'Los ladrillos no se compran: se producen');
  }

  const config = await Setting.obtener();

  // Convertimos a la unidad interna ANTES de abrir la transaccion: si la
  // conversion falla, mejor que falle sin haber tocado nada.
  const cantidadInterna = esArcilla(material)
    ? camionesALadrillos(cantidad, config.ladrillosPorCamion)
    : Math.round(cantidad);

  if (cantidadInterna <= 0) {
    throw new ApiError(400, 'La cantidad comprada tiene que ser mayor a cero');
  }

  return conTransaccion(async (session) => {
    // Formateado a la paraguaya: 2,5 y no 2.5. El texto lo va a leer el dueno
    // en la pantalla de caja, asi que se escribe como se escribe acá.
    const numero = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 2 }).format(cantidad);
    const unidad = esArcilla(material)
      ? `${numero} camion(es)`
      : `${numero} ${config.unidadLena}`;
    const detalle = descripcion || `Compra de ${unidad}`;

    // 1) El egreso de caja. Se crea primero para tener su id y poder
    //    referenciarlo desde el movimiento de stock.
    const egreso = await transactionService.crearEgresoDeSistema(
      {
        claveCategoria: 'compra_material',
        monto,
        fecha,
        descripcion: detalle,
        origenTipo: 'compra',
      },
      session,
    );

    // 2) El stock y su historial.
    const movimiento = await moverStock({
      material,
      cantidad: cantidadInterna,
      motivo: 'compra',
      fecha,
      origen: { tipo: 'compra', id: egreso._id },
      descripcion: detalle,
      session,
    });

    // 3) Dejamos el movimiento apuntado desde el egreso, para poder ir y
    //    volver entre los dos al anular.
    egreso.origen.id = movimiento._id;
    await egreso.save({ session });

    return { movimiento, transaccion: egreso };
  });
}

/**
 * Anula una compra: devuelve el stock y anula su egreso. Tambien en una sola
 * transaccion.
 *
 * NO se borra el movimiento original: se crea uno INVERSO con motivo
 * 'anulacion'. Asi el historial cuenta lo que realmente paso (se compro y
 * despues se anulo), igual que un contra-asiento en contabilidad.
 */
export async function anularCompra(movimientoId) {
  const original = await InventoryMovement.findById(movimientoId);
  if (!original) throw new ApiError(404, 'El movimiento no existe');
  if (original.motivo !== 'compra') {
    throw new ApiError(400, 'Solo se pueden anular movimientos de compra');
  }

  // Si ya existe un movimiento de anulacion apuntando a este, ya se anulo.
  const yaAnulado = await InventoryMovement.findOne({
    motivo: 'anulacion',
    'origen.tipo': 'anulacion_movimiento',
    'origen.id': original._id,
  });
  if (yaAnulado) throw new ApiError(409, 'Esta compra ya fue anulada');

  return conTransaccion(async (session) => {
    // Movimiento inverso: MISMO numero, signo contrario. Tomado del historial
    // y no recalculado, asi la reversion es exacta aunque los parametros del
    // sistema hayan cambiado desde la compra.
    const inverso = await moverStock({
      material: original.material,
      cantidad: -original.cantidad,
      motivo: 'anulacion',
      fecha: original.fecha,
      origen: { tipo: 'anulacion_movimiento', id: original._id },
      descripcion: `Anulacion de: ${original.descripcion}`,
      session,
    });

    // El egreso de caja tambien se anula (soft delete).
    if (original.origen?.tipo === 'compra' && original.origen.id) {
      await transactionService.anularPorOrigen(
        { tipo: 'compra', movimientoId: original._id },
        session,
      );
    }

    return inverso;
  });
}

// ---------------------------------------------------------------------------
// Uso de lena (plan, seccion 5.6b)
// ---------------------------------------------------------------------------

/**
 * El dueno anota cuanta lena gasto, a ojo.
 *
 * No se descuenta sola al producir porque el consumo cambia segun la calidad
 * de la lena: el plan decidio que el stock de lena sea aproximado y cargado a
 * mano. No genera movimiento de caja: la plata salio cuando se compro.
 */
export async function registrarUsoLena({ cantidad, fecha, descripcion = '' }) {
  const entero = Math.round(cantidad);
  if (!Number.isFinite(cantidad) || entero <= 0) {
    throw new ApiError(400, 'La cantidad usada tiene que ser mayor a cero');
  }

  return conTransaccion((session) =>
    moverStock({
      material: 'lena',
      cantidad: -entero, // negativo: sale del stock
      motivo: 'uso_lena',
      fecha,
      descripcion: descripcion || 'Uso de lena',
      session,
    }),
  );
}

// ---------------------------------------------------------------------------
// Ajuste manual
// ---------------------------------------------------------------------------

/**
 * Corrige el stock cuando el numero del sistema no coincide con la realidad
 * del deposito.
 *
 * El dueno dice CUANTO HAY (no cuanto sumar), que es lo que se puede contar
 * parado en el patio. El sistema calcula la diferencia y la registra.
 *
 * Pedir la diferencia en vez del total obligaria a hacer la resta de cabeza,
 * que es justo donde se cometen errores.
 */
export async function registrarAjuste({ material, cantidadReal, fecha, descripcion = '' }) {
  const config = await Setting.obtener();

  const objetivo = esArcilla(material)
    ? camionesALadrillos(cantidadReal, config.ladrillosPorCamion)
    : Math.round(cantidadReal);

  if (objetivo < 0) throw new ApiError(400, 'La cantidad real no puede ser negativa');

  const actual = (await Inventory.findOne({ material }))?.cantidad ?? 0;
  const diferencia = objetivo - actual;

  if (diferencia === 0) {
    throw new ApiError(400, 'El stock ya es ese: no hay nada que ajustar');
  }

  return conTransaccion((session) =>
    moverStock({
      material,
      cantidad: diferencia,
      motivo: 'ajuste',
      fecha,
      descripcion: descripcion || `Ajuste: el sistema decia ${actual}, hay ${objetivo}`,
      session,
    }),
  );
}

// ---------------------------------------------------------------------------
// Stock inicial (lo usa el asistente de la fase 10)
// ---------------------------------------------------------------------------

export async function registrarStockInicial({ material, cantidad, fecha, session }) {
  return moverStock({
    material,
    cantidad,
    motivo: 'stock_inicial',
    fecha,
    descripcion: 'Stock inicial',
    session,
  });
}

// Se exporta para que la produccion (fase 5) descuente arcilla y sume
// ladrillos usando exactamente la misma primitiva.
export { moverStock, MATERIALES_ARCILLA };
