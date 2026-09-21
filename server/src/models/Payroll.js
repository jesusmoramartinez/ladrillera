// -----------------------------------------------------------------------------
// Payroll.js — Las liquidaciones semanales (plan, seccion 4.5)
// -----------------------------------------------------------------------------
// Un documento por semana pagada. Adentro, el detalle de cada empleado con
// TODOS los numeros congelados: lo que produjo, lo que se le adelanto, lo que
// debia, lo que cobro y lo que quedo debiendo.
//
//
// POR QUE ESTA ES LA COLECCION MAS "SNAPSHOT" DEL SISTEMA
//
// En la fase 6 la regla era: si se puede calcular, no se guarda. Acá pasa lo
// contrario, y no es una contradiccion: es la misma pregunta con otra
// respuesta.
//
//   "Si el original cambia manana, ¿este registro tendria que cambiar?"
//
// Un ticket de sueldo es un COMPROBANTE de algo que ya pasó: el sabado 26 de
// septiembre, a Ana se le pagaron 1.120.000 guaranies. Ese numero no puede
// cambiar nunca mas, pase lo que pase con las producciones, las tarifas o los
// adelantos. Si se recalculara cada vez que se abre, un arreglo hecho en
// octubre reescribiria lo que se pagó en septiembre, y el papel que el
// empleado tiene en el bolsillo dejaria de coincidir con el sistema.
//
// Por eso acá se guarda todo: nombre, ladrillos, bruto, adelantos, deuda, neto
// y hasta el detalle dia por dia.
//
//
// LA CADENA DE LAS DEUDAS
//
// El campo mas importante del detalle es `deudaNueva`: es la `deudaAnterior`
// de la liquidacion siguiente. Cada sabado cierra un eslabon y abre el
// proximo. Por eso las liquidaciones pagadas NO se tocan nunca: romper un
// eslabon del medio desajusta todos los que vienen despues.
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import { MONTO_MAXIMO } from '../logic/money.js';
import { ESTADOS_LIQUIDACION } from '../logic/payroll.js';

const montoGs = {
  type: Number,
  required: true,
  default: 0,
  min: 0,
  max: MONTO_MAXIMO,
  validate: { validator: Number.isInteger, message: 'Los montos tienen que ser enteros' },
};

/** Una linea del ticket: lo que se hizo un dia. */
const diaSchema = new mongoose.Schema(
  {
    fecha: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD'],
    },
    cantidad: { type: Number, required: true, min: 0 },
    monto: montoGs,
  },
  { _id: false },
);

/** La liquidacion de UN empleado, con todo congelado. */
const detalleSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    // Snapshot: el ticket de septiembre tiene que poder leerse en marzo aunque
    // el empleado ya no este en la lista.
    nombre: { type: String, required: true, trim: true },

    ladrillos: { type: Number, required: true, default: 0, min: 0 },
    bruto: montoGs,
    adelantos: montoGs,
    deudaAnterior: montoGs,

    // Lo que sale de la caja para el. Nunca negativo: la plata solo va en una
    // direccion (ver logic/payroll.js).
    neto: montoGs,
    // Lo que queda debiendo, y que la semana que viene sera su deudaAnterior.
    deudaNueva: montoGs,

    diario: { type: [diaSchema], default: [] },
  },
  { _id: false },
);

const payrollSchema = new mongoose.Schema(
  {
    // El lunes y el sabado de la semana (plan 5.9). Se guardan los dos aunque
    // uno se pueda deducir del otro: son los que se muestran en el ticket, y
    // buscar por rango con los dos es directo.
    semanaInicio: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD'],
      // Una sola liquidacion por semana. El indice unico lo hace cumplir la
      // BASE, no el codigo: si dos pedidos de "marcar pagado" llegaran al
      // mismo tiempo, una validacion en JavaScript podria dejar pasar los dos
      // (los dos leen "no existe" antes de que ninguno escriba). El indice no.
      unique: true,
    },
    semanaFin: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD'],
    },

    estado: {
      type: String,
      required: true,
      enum: { values: ESTADOS_LIQUIDACION, message: 'Estado desconocido' },
      default: 'borrador',
    },

    detalle: { type: [detalleSchema], default: [] },
    totalAPagar: montoGs,

    // Se completan al marcar pagada.
    pagadaEn: { type: Date, default: null },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },

    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ---------------------------------------------------------------------------
// La cadena de las deudas
// ---------------------------------------------------------------------------

/**
 * Cuanto debia cada empleado ANTES de la semana que empieza en `semanaInicio`.
 *
 * Es la `deudaNueva` de su ultima liquidacion PAGADA anterior a esa fecha.
 *
 * Fijate el orden de los pasos, porque el truco esta ahi:
 *   1. solo las pagadas y anteriores a esta semana
 *   2. de la mas NUEVA a la mas vieja
 *   3. abrir el array `detalle` (una fila por empleado)
 *   4. agrupar por empleado quedandose con el PRIMERO que aparezca
 *
 * Como vienen ordenadas de nueva a vieja, ese "primero" es el mas reciente de
 * cada uno. Y eso importa: un empleado puede no figurar en la ultima
 * liquidacion (no trabajo esa semana) pero si en la anterior.
 *
 * @param {string} semanaInicio
 * @returns {Promise<Map<string, number>>} employeeId -> deudaNueva
 */
payrollSchema.statics.deudasAnterioresA = async function deudasAnterioresA(semanaInicio) {
  const filas = await this.aggregate([
    { $match: { estado: 'pagada', deletedAt: null, semanaInicio: { $lt: semanaInicio } } },
    { $sort: { semanaInicio: -1 } },
    { $unwind: '$detalle' },
    { $group: { _id: '$detalle.employeeId', deuda: { $first: '$detalle.deudaNueva' } } },
    // Los que quedaron en cero no aportan nada y solo harian que aparezcan en
    // la liquidacion empleados que no tienen nada que ver con esta semana.
    { $match: { deuda: { $gt: 0 } } },
  ]);

  return new Map(filas.map((f) => [String(f._id), f.deuda]));
};

// "Las liquidaciones vigentes, de la mas nueva a la mas vieja".
payrollSchema.index({ deletedAt: 1, semanaInicio: -1 });

export const Payroll = mongoose.model('Payroll', payrollSchema);
export default Payroll;
