// -----------------------------------------------------------------------------
// production.service.js — El corazon del sistema
// -----------------------------------------------------------------------------
// Esta es la operacion que junta casi todo lo construido hasta acá. Guardar la
// produccion de un dia son CUATRO escrituras (plan, seccion 5.1):
//
//   1. Crear la produccion, con el monto de cada trabajador.
//   2. Descontar arcilla PURA por la cantidad producida.
//   3. Descontar arcilla FLOJA por la misma cantidad.
//   4. Sumar esa cantidad al stock de ladrillos.
//
// (Cada descuento de stock son en realidad dos escrituras: el total y su linea
// en el historial. O sea que son siete en total.)
//
// Todas adentro de UNA transaccion. Sin eso, un corte de luz a mitad de camino
// podria dejar arcilla descontada sin ladrillos sumados, o una produccion
// guardada sin que se haya gastado material.
//
// LA LENA NO SE TOCA ACA. El plan (5.6b) lo decidio asi: el consumo de lena
// cambia segun su calidad, asi que no se puede descontar por formula. El dueno
// la anota a ojo desde la pantalla de Stock.
// -----------------------------------------------------------------------------

import { conTransaccion } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { armarTrabajadores, resumirProducciones, totalManoDeObra } from '../logic/production.js';
import { estaEnRango, semanaDePago } from '../logic/semana.js';
import { Employee } from '../models/Employee.js';
import { Production } from '../models/Production.js';
import { moverStock, obtenerStock } from './inventory.service.js';

const VIGENTES = { deletedAt: null };

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/**
 * Producciones de la semana (lunes a sabado) que contiene una fecha, con el
 * resumen por empleado.
 */
export async function listarPorSemana(fechaISO) {
  const { inicio, fin } = semanaDePago(fechaISO);

  const producciones = await Production.find({
    ...VIGENTES,
    fecha: { $gte: inicio, $lte: fin },
  }).sort({ fecha: -1, createdAt: -1 });

  return {
    semana: { inicio, fin },
    producciones,
    resumen: resumirProducciones(producciones),
  };
}

export async function buscarPorId(id) {
  const produccion = await Production.findOne({ _id: id, ...VIGENTES });
  if (!produccion) throw new ApiError(404, 'La produccion no existe');
  return produccion;
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

/**
 * Busca los empleados marcados y valida que se les pueda cargar produccion.
 *
 * Se hace ANTES de abrir la transaccion: si algo esta mal, mejor fallar sin
 * haber tocado nada.
 */
async function resolverEmpleados(employeeIds) {
  // Set para que marcar dos veces al mismo no lo cuente doble (no deberia
  // pasar desde la pantalla, pero la API la puede llamar cualquiera).
  const ids = [...new Set(employeeIds.map(String))];

  const empleados = await Employee.find({ _id: { $in: ids }, ...VIGENTES });

  if (empleados.length !== ids.length) {
    throw new ApiError(404, 'Alguno de los empleados marcados ya no existe');
  }

  const inactivos = empleados.filter((e) => !e.activo);
  if (inactivos.length > 0) {
    const nombres = inactivos.map((e) => e.nombre).join(', ');
    throw new ApiError(
      400,
      `${nombres} figura como inactivo. Activalo en Empleados para cargarle produccion.`,
    );
  }

  return empleados;
}

/**
 * Guarda la produccion del dia.
 *
 * @param {object} p
 * @param {string} p.fecha         "YYYY-MM-DD"
 * @param {number} p.cantidad      ladrillos producidos
 * @param {string[]} p.employeeIds quienes trabajaron
 */
export async function crear({ fecha, cantidad, employeeIds }) {
  const empleados = await resolverEmpleados(employeeIds);

  // El snapshot de tarifas se arma acá, con los datos de AHORA.
  const trabajadores = armarTrabajadores(cantidad, empleados);

  const produccion = await conTransaccion(async (session) => {
    // 1) La produccion. Se crea primero para tener su id y poder apuntar los
    //    movimientos de stock hacia ella.
    const [doc] = await Production.create([{ fecha, cantidad, trabajadores }], { session });

    const origen = { tipo: 'produccion', id: doc._id };
    const descripcion = `Produccion de ${cantidad} ladrillos`;

    // 2 y 3) Se descuenta de LAS DOS arcillas, la misma cantidad de cada una.
    //
    // El plan (seccion 1) lo aclara porque el MVP era ambiguo: "1/5 de camion"
    // significa 0,2 de pura Y 0,2 de floja, no 0,2 repartido entre las dos.
    // Como el stock esta en ladrillos-equivalentes, el descuento es
    // directamente la cantidad producida: 5.000 ladrillos = 5.000 de cada una
    // = 0,2 camion de cada una.
    for (const material of ['arcilla_pura', 'arcilla_floja']) {
      await moverStock({
        material,
        cantidad: -cantidad,
        motivo: 'produccion',
        fecha,
        origen,
        descripcion,
        session,
      });
    }

    // 4) Los ladrillos terminados entran al patio.
    await moverStock({
      material: 'ladrillos',
      cantidad: +cantidad,
      motivo: 'produccion',
      fecha,
      origen,
      descripcion,
      session,
    });

    return doc;
  });

  // Devolvemos el stock de despues para que la pantalla pueda avisar si la
  // arcilla quedo en rojo. Se AVISA, no se bloquea: el deposito real manda
  // sobre el numero del sistema (plan, seccion 5.7).
  const stock = await obtenerStock();

  return {
    produccion,
    manoDeObra: totalManoDeObra(trabajadores),
    stock,
  };
}

// ---------------------------------------------------------------------------
// Anulacion (plan, seccion 5.11)
// ---------------------------------------------------------------------------

/**
 * Anula una produccion y revierte sus efectos en el stock.
 *
 * Igual que con las compras, no se borra nada: se marca `deletedAt` y se
 * crean los movimientos INVERSOS.
 */
export async function anular(id) {
  const produccion = await buscarPorId(id);

  // Proteccion del plan (seccion 5.9): si la semana ya se liquido, esta
  // produccion ya se pago. Anularla cambiaria un sueldo que el empleado ya
  // tiene en el bolsillo.
  if (produccion.payrollId) {
    throw new ApiError(
      409,
      'Esta produccion pertenece a una semana ya liquidada y no se puede anular.',
    );
  }

  return conTransaccion(async (session) => {
    const origen = { tipo: 'anulacion_produccion', id: produccion._id };
    const descripcion = `Anulacion de produccion de ${produccion.cantidad} ladrillos`;

    // Devolvemos la arcilla...
    for (const material of ['arcilla_pura', 'arcilla_floja']) {
      await moverStock({
        material,
        cantidad: +produccion.cantidad,
        motivo: 'anulacion',
        fecha: produccion.fecha,
        origen,
        descripcion,
        session,
      });
    }

    // ...y sacamos los ladrillos del patio.
    await moverStock({
      material: 'ladrillos',
      cantidad: -produccion.cantidad,
      motivo: 'anulacion',
      fecha: produccion.fecha,
      origen,
      descripcion,
      session,
    });

    produccion.deletedAt = new Date();
    await produccion.save({ session });

    return produccion;
  });
}

// ---------------------------------------------------------------------------
// Para la fase 8 (liquidacion semanal)
// ---------------------------------------------------------------------------

/**
 * Producciones sin liquidar de una semana. Las va a usar la liquidacion para
 * calcular el bruto de cada empleado.
 */
export async function listarSinLiquidar(fechaISO) {
  const { inicio, fin } = semanaDePago(fechaISO);

  return Production.find({
    ...VIGENTES,
    payrollId: null,
    fecha: { $gte: inicio, $lte: fin },
  }).sort({ fecha: 1 });
}

export { estaEnRango };
