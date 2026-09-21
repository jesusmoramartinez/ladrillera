// -----------------------------------------------------------------------------
// Production.js — La produccion de un dia (plan, seccion 4.3)
// -----------------------------------------------------------------------------
// Un documento por dia cargado. Adentro lleva la lista de quienes trabajaron,
// cada uno con su tarifa y su monto CONGELADOS en el momento.
//
// POR QUE LOS TRABAJADORES VAN ADENTRO Y NO EN OTRA COLECCION
//
// En una base relacional esto serian dos tablas (producciones y
// produccion_trabajador) unidas con un JOIN. En MongoDB, cuando los datos
// "hijos" solo tienen sentido dentro del padre y se leen siempre juntos, van
// embebidos. Ventajas acá:
//   - Traer la produccion de la semana es UNA consulta, no dos.
//   - Guardar la produccion y sus trabajadores es UNA escritura atomica: no
//     puede quedar una produccion sin trabajadores.
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import { MONTO_MAXIMO } from '../logic/money.js';

/**
 * Sub-esquema de cada trabajador del dia.
 *
 * `_id: false` porque estas lineas no se referencian desde ningun lado; darles
 * un id propio solo agregaria ruido a cada documento.
 */
const trabajadorSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    // --- SNAPSHOT: copias del empleado en el momento de la produccion ---
    nombre: { type: String, required: true, trim: true },
    tarifaPorMil: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'La tarifa tiene que ser entera' },
    },
    monto: {
      type: Number,
      required: true,
      min: 0,
      max: MONTO_MAXIMO,
      validate: { validator: Number.isInteger, message: 'El monto tiene que ser entero' },
    },
  },
  { _id: false },
);

const productionSchema = new mongoose.Schema(
  {
    // Fecha de negocio "YYYY-MM-DD" (plan, seccion 5.4).
    fecha: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD'],
    },

    cantidad: {
      type: Number,
      required: [true, 'La cantidad es obligatoria'],
      min: [1, 'Tiene que haber al menos un ladrillo'],
      validate: {
        validator: Number.isInteger,
        message: 'La cantidad tiene que ser un numero entero de ladrillos',
      },
    },

    trabajadores: {
      type: [trabajadorSchema],
      // Una produccion sin trabajadores no tendria a quien pagarle, y el
      // descuento de arcilla quedaria sin responsable.
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Hay que marcar al menos un empleado',
      },
    },

    // Se completa al liquidar la semana (fase 8). Mientras sea null, la
    // produccion todavia no se pago y se puede anular.
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payroll',
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
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

// La consulta de siempre: "las producciones vigentes de este rango de fechas".
productionSchema.index({ deletedAt: 1, fecha: -1 });
// Para la liquidacion (fase 8): las producciones de un empleado todavia sin pagar.
productionSchema.index({ 'trabajadores.employeeId': 1, fecha: 1 });

export const Production = mongoose.model('Production', productionSchema);
export default Production;
