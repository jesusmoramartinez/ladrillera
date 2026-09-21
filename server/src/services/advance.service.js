// -----------------------------------------------------------------------------
// advance.service.js — Reglas de los adelantos
// -----------------------------------------------------------------------------
// Esta es la fase mas corta del plan, y eso NO es casualidad: es lo que pasa
// cuando las piezas de abajo estan bien puestas. Un adelanto son dos
// escrituras:
//
//   1. el adelanto
//   2. el egreso de caja, categoria `adelanto`
//
// Las dos ya tienen su herramienta hecha. `crearEgresoDeSistema()` es el mismo
// que usan las compras (fase 4); `anularPorOrigen()` es el mismo que las
// deshace; `conTransaccion()` es el mismo "todo o nada". Acá no se inventa
// nada nuevo: se combinan cosas que ya funcionan y ya estan testeadas.
//
// Si esta fase hubiera venido primero, habria sido la mas larga de todas.
//
//
// LO QUE ACA **NO** SE VALIDA, A PROPOSITO
//
// No se controla que el adelanto sea menor a lo que el empleado va a ganar.
// Podria parecer una buena idea y seria un error, por dos motivos:
//
//   - Al dar el adelanto, todavia no se sabe cuanto va a producir en lo que
//     queda de la semana. El numero contra el que compararlo no existe.
//
//   - El plan (5.9) ya resolvio el caso: si el adelanto supera lo ganado, el
//     neto se va a cero y la diferencia queda como `deudaNueva`, que se
//     arrastra a la semana siguiente. O sea que "adelantarse de mas" es una
//     situacion PREVISTA, no un error.
//
// Bloquearlo seria impedir algo que el sistema ya sabe manejar.
// -----------------------------------------------------------------------------

import { conTransaccion } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { formatearGsSimple } from '../logic/money.js';
import { semanaDePago } from '../logic/semana.js';
import { Advance } from '../models/Advance.js';
import { CATEGORIAS_SISTEMA } from '../models/Category.js';
import { Employee } from '../models/Employee.js';
import * as transactionService from './transaction.service.js';

const VIGENTES = { deletedAt: null };

/** Los campos del empleado que viajan junto al adelanto. */
const EMPLEADO_RESUMIDO = 'nombre rol';

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/**
 * Los adelantos de la semana (lunes a sabado) que contiene una fecha, con el
 * total por empleado.
 *
 * Se agrupa por semana y no por mes porque la semana es la unidad de pago de
 * la fabrica: lo que el dueno necesita ver es "cuanto le adelante a cada uno
 * de lo que le toca cobrar el sabado".
 */
export async function listarPorSemana(fechaISO) {
  const { inicio, fin } = semanaDePago(fechaISO);

  const adelantos = await Advance.find({
    ...VIGENTES,
    fecha: { $gte: inicio, $lte: fin },
  })
    .populate('employeeId', EMPLEADO_RESUMIDO)
    .sort({ fecha: -1, createdAt: -1 });

  return {
    semana: { inicio, fin },
    adelantos,
    resumen: resumirPorEmpleado(adelantos),
  };
}

/**
 * Junta los adelantos de cada empleado en una sola linea.
 *
 * Se usa un Map y no un objeto comun porque las claves son ids de Mongo: el
 * Map no se confunde con propiedades heredadas y conserva el orden en que se
 * fueron encontrando.
 */
function resumirPorEmpleado(adelantos) {
  const porEmpleado = new Map();

  for (const adelanto of adelantos) {
    // Si vino populado, el nombre esta adentro; si no, se muestra generico.
    const empleado = adelanto.employeeId;
    const id = String(empleado?._id ?? empleado);

    const actual = porEmpleado.get(id) ?? {
      employeeId: id,
      nombre: empleado?.nombre ?? 'Empleado eliminado',
      monto: 0,
      veces: 0,
    };

    actual.monto += adelanto.monto;
    actual.veces += 1;
    porEmpleado.set(id, actual);
  }

  const lista = [...porEmpleado.values()];
  return {
    porEmpleado: lista,
    total: lista.reduce((suma, e) => suma + e.monto, 0),
  };
}

export async function buscarPorId(id) {
  const adelanto = await Advance.findOne({ _id: id, ...VIGENTES });
  if (!adelanto) throw new ApiError(404, 'El adelanto no existe');
  return adelanto;
}

// ---------------------------------------------------------------------------
// Alta (plan, seccion 5.8)
// ---------------------------------------------------------------------------

/**
 * Da un adelanto: lo registra Y saca la plata de la caja, en una sola
 * transaccion.
 *
 * "En el momento" del plan significa exactamente eso: el egreso lleva la fecha
 * del adelanto, no la del sabado que se liquida. La plata salio de la caja el
 * dia que se la dieron, y el balance del mes tiene que reflejarlo ese dia.
 *
 * @param {object} p
 * @param {string} p.employeeId
 * @param {number} p.monto   guaranies, entero
 * @param {string} p.fecha   "YYYY-MM-DD"
 */
export async function crear({ employeeId, monto, fecha, descripcion = '' }) {
  // Antes de abrir la transaccion: si el empleado no sirve, mejor fallar sin
  // haber tocado nada.
  const empleado = await Employee.findOne({ _id: employeeId, ...VIGENTES });
  if (!empleado) throw new ApiError(404, 'El empleado no existe');

  // Misma regla que en produccion (fase 5): un inactivo no cobra ni produce.
  // Darle un adelanto a alguien que dejo de venir es, casi siempre, haber
  // elegido mal en la lista.
  if (!empleado.activo) {
    throw new ApiError(
      400,
      `${empleado.nombre} figura como inactivo. Activalo en Empleados para darle un adelanto.`,
    );
  }

  const detalle = descripcion || `Adelanto a ${empleado.nombre}`;

  const adelanto = await conTransaccion(async (session) => {
    // 1) El adelanto. Se crea primero para tener su id y poder apuntar el
    //    egreso hacia el.
    const [doc] = await Advance.create([{ employeeId: empleado._id, monto, fecha }], {
      session,
    });

    // 2) El egreso de caja. Exactamente el mismo camino que usa una compra de
    //    material: cambia la categoria y el texto, nada mas.
    const egreso = await transactionService.crearEgresoDeSistema(
      {
        claveCategoria: CATEGORIAS_SISTEMA.ADELANTO,
        monto,
        fecha,
        descripcion: `${detalle} — ${formatearGsSimple(monto)}`,
        origenTipo: 'adelanto',
        origenId: doc._id,
      },
      session,
    );

    // 3) Y el adelanto se queda con la referencia al egreso, para poder ir y
    //    volver entre los dos al anular.
    doc.transactionId = egreso._id;
    await doc.save({ session });

    return doc;
  });

  return Advance.findById(adelanto._id).populate('employeeId', EMPLEADO_RESUMIDO);
}

// ---------------------------------------------------------------------------
// Anulacion (plan, secciones 5.11 y 5.9)
// ---------------------------------------------------------------------------

/**
 * Anula un adelanto y su egreso de caja.
 *
 * Igual que en todo el sistema: no se borra nada, se marca `deletedAt`.
 */
export async function anular(id) {
  const adelanto = await buscarPorId(id);

  // La proteccion del plan (5.9), la misma que tienen las producciones: si la
  // semana ya se liquido, este adelanto ya se descontó de un sueldo que el
  // empleado tiene en el bolsillo. Anularlo ahora cambiaria una cuenta
  // cerrada.
  if (adelanto.payrollId) {
    throw new ApiError(
      409,
      'Este adelanto pertenece a una semana ya liquidada y no se puede anular.',
    );
  }

  return conTransaccion(async (session) => {
    await transactionService.anularPorOrigen(
      { tipo: 'adelanto', movimientoId: adelanto._id },
      session,
    );

    adelanto.deletedAt = new Date();
    await adelanto.save({ session });

    return adelanto;
  });
}

// ---------------------------------------------------------------------------
// Para la fase 8 (liquidacion semanal)
// ---------------------------------------------------------------------------

/**
 * Adelantos de una semana que todavia no se descontaron de ningun sueldo.
 * Los va a usar la liquidacion para restarlos del bruto de cada empleado.
 */
export async function listarSinLiquidar(fechaISO) {
  const { inicio, fin } = semanaDePago(fechaISO);

  return Advance.find({
    ...VIGENTES,
    payrollId: null,
    fecha: { $gte: inicio, $lte: fin },
  }).sort({ fecha: 1 });
}
