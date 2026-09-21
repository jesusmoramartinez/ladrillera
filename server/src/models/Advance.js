// -----------------------------------------------------------------------------
// Advance.js — Los adelantos (plan, seccion 4.4)
// -----------------------------------------------------------------------------
// El modelo mas simple que queda por hacer: a quien, cuanto, cuando.
//
//
// POR QUE ACA NO SE COPIA EL NOMBRE DEL EMPLEADO
//
// En Production, cada trabajador lleva su `nombre` copiado adentro. Acá NO, y
// la diferencia vale la pena entenderla porque es la misma regla de la fase 6
// aplicada de nuevo:
//
//   "Si el original cambia manana, ¿este registro tendria que cambiar?"
//
// En Production el nombre viaja al lado de `tarifaPorMil`, que SI tiene que
// quedar congelada (si sube la tarifa en octubre, lo que se pago en septiembre
// no cambia). Teniendo que copiar la tarifa, copiar el nombre al lado deja la
// linea de pago completa y auto-contenida.
//
// Un adelanto no congela nada: el unico numero es el monto, que ya es su
// propio campo. Entonces el nombre se APUNTA. Si manana se corrige un nombre
// mal escrito, los adelantos viejos se corrigen solos.
//
//
// LOS DOS CAMPOS QUE APUNTAN A OTRA COSA
//
//   transactionId -> el egreso de caja que genero. Al anular el adelanto hay
//                    que anular ese egreso, y sin este campo habria que
//                    adivinar cual era.
//
//   payrollId     -> se completa al liquidar la semana (fase 8). Mientras sea
//                    null, el adelanto todavia no se descontó de ningun sueldo
//                    y se puede anular.
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import { MONTO_MAXIMO } from '../logic/money.js';

const advanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Hay que elegir el empleado'],
    },

    // Fecha de negocio "YYYY-MM-DD" (plan, seccion 5.4). De ella sale a que
    // semana pertenece el adelanto, y por lo tanto en que liquidacion se
    // descuenta.
    fecha: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD'],
    },

    monto: {
      type: Number,
      required: [true, 'El monto es obligatorio'],
      min: [1, 'El adelanto tiene que ser mayor a cero'],
      max: [MONTO_MAXIMO, 'El monto es demasiado grande'],
      validate: {
        validator: Number.isInteger,
        message: 'El monto tiene que ser un numero entero de guaranies',
      },
    },

    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },

    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payroll',
      default: null,
    },

    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        // Igual que en Sale: si la consulta uso .populate('employeeId'), acá
        // adentro viene el empleado entero y no un id. Lo separamos en dos
        // campos para que la pantalla no tenga que averiguar que le llego.
        //
        // Se pregunta por `.nombre` y no por `.id` porque un ObjectId de Mongo
        // TIENE una propiedad `.id` (el buffer crudo) y daria un falso
        // positivo.
        if (ret.employeeId?.nombre) {
          ret.empleado = ret.employeeId;
          ret.employeeId = ret.empleado.id ?? null;
        } else {
          ret.empleado = null;
        }

        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// La consulta de siempre: "los adelantos vigentes de este rango de fechas".
advanceSchema.index({ deletedAt: 1, fecha: -1 });
// Para la liquidacion (fase 8): los adelantos sin descontar de un empleado.
advanceSchema.index({ employeeId: 1, payrollId: 1, fecha: 1 });

export const Advance = mongoose.model('Advance', advanceSchema);
export default Advance;
