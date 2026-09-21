// -----------------------------------------------------------------------------
// Transaction.js — Los movimientos de caja (plan, seccion 4.6)
// -----------------------------------------------------------------------------
// Cada fila de la pantalla Caja es uno de estos documentos.
//
// DOS DECISIONES DE DISENO QUE VALE LA PENA ENTENDER:
//
// 1) El monto es SIEMPRE POSITIVO, y el campo `tipo` dice si suma o resta.
//    La alternativa seria guardar los egresos en negativo. Se eligio asi
//    porque con montos negativos es facil equivocarse de signo en una cuenta y
//    terminar sumando un gasto. Con tipo + monto positivo, el signo lo decide
//    un solo lugar del codigo.
//
// 2) Se guarda el NOMBRE de la categoria, no solo su id (`categoriaNombre`).
//    Eso se llama SNAPSHOT: una foto del dato en el momento en que paso.
//    Si el dueno renombra "Combustible" a "Nafta", los gastos viejos siguen
//    diciendo "Combustible", que es lo que realmente eran ese dia. Sin el
//    snapshot, cambiar un nombre reescribiria la historia hacia atras.
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import { MONTO_MAXIMO } from '../logic/money.js';

/** De donde salio el movimiento, cuando lo genero otro modulo. */
export const ORIGENES = ['manual', 'compra', 'pago_venta', 'adelanto', 'liquidacion'];

const transactionSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      required: true,
      enum: {
        values: ['ingreso', 'egreso'],
        message: 'El tipo tiene que ser ingreso o egreso',
      },
    },

    categoriaId: {
      // ObjectId + ref = "esto apunta a un documento de Category".
      // Permite despues pedirle a Mongoose que lo traiga con .populate().
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    categoriaNombre: {
      type: String,
      required: true,
      trim: true,
    },

    monto: {
      type: Number,
      required: [true, 'El monto es obligatorio'],
      min: [1, 'El monto tiene que ser mayor a cero'],
      max: [MONTO_MAXIMO, 'El monto es demasiado grande'],
      validate: {
        validator: Number.isInteger,
        message: 'El monto tiene que ser un numero entero de guaranies',
      },
    },

    // Fecha de NEGOCIO como texto "YYYY-MM-DD" (plan, seccion 5.4).
    // Guardarla como texto evita el error clasico: algo cargado a las 22 h
    // aparece al dia siguiente porque el Date se convirtio a UTC.
    fecha: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser YYYY-MM-DD'],
    },

    descripcion: {
      type: String,
      trim: true,
      maxlength: [140, 'La descripcion es demasiado larga'],
      default: '',
    },

    // Quien lo genero. 'manual' = lo cargo el dueno a mano; el resto vienen de
    // otro modulo y por eso no se pueden anular desde la pantalla de Caja: hay
    // que anular la compra, el pago o la liquidacion que lo genero.
    origen: {
      tipo: {
        type: String,
        enum: ORIGENES,
        default: 'manual',
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
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

// La consulta mas habitual es "los movimientos vigentes del mes X, del mas
// nuevo al mas viejo". El indice acompana ese orden.
transactionSchema.index({ deletedAt: 1, fecha: -1 });
// Para encontrar rapido el movimiento que genero una compra, al anularla.
transactionSchema.index({ 'origen.tipo': 1, 'origen.id': 1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
