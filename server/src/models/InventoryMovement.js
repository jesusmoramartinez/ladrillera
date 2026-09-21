// -----------------------------------------------------------------------------
// InventoryMovement.js — El historial del stock (plan, seccion 4.8)
// -----------------------------------------------------------------------------
// Cada vez que el stock cambia, queda una linea acá. Es el "extracto bancario"
// del deposito.
//
// PARA QUE SIRVE, concretamente:
//
//   1. Responder "¿por que hay 3 camiones si compre 5?". Sin historial, el
//      stock es un numero sin explicacion y la unica respuesta posible es
//      "no se".
//
//   2. PODER REVERTIR con exactitud. Cuando se anula una compra, no alcanza
//      con "restar lo que creo que era": se busca el movimiento original y se
//      crea su inverso, con el mismo numero y signo contrario. Asi la reversion
//      es exacta aunque los parametros del sistema hayan cambiado en el medio
//      (por ejemplo, si alguien cambio ladrillosPorCamion despues de la compra).
//
// Esta coleccion NO se edita ni se borra nunca. Un error se corrige agregando
// el movimiento contrario, igual que en contabilidad. Por eso no tiene
// deletedAt: no hay nada que borrar.
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import { MATERIALES, MOTIVOS } from '../logic/inventory.js';

const inventoryMovementSchema = new mongoose.Schema(
  {
    material: {
      type: String,
      required: true,
      enum: { values: MATERIALES, message: 'Material desconocido' },
    },

    // ACA SI puede ser negativo: el signo es la informacion.
    // Positivo = entro stock. Negativo = salio.
    cantidad: {
      type: Number,
      required: true,
      validate: [
        {
          validator: Number.isInteger,
          message: 'La cantidad tiene que ser entera',
        },
        {
          // Un movimiento de cero no aporta nada y solo ensucia el historial.
          validator: (v) => v !== 0,
          message: 'Un movimiento no puede ser de cero',
        },
      ],
    },

    motivo: {
      type: String,
      required: true,
      enum: { values: MOTIVOS, message: 'Motivo desconocido' },
    },

    // Quien lo genero, para poder ir del movimiento al hecho que lo provoco.
    origen: {
      tipo: { type: String, default: null },
      id: { type: mongoose.Schema.Types.ObjectId, default: null },
    },

    // Fecha de negocio "YYYY-MM-DD" (plan, seccion 5.4).
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

// "El historial de este material, del mas nuevo al mas viejo".
inventoryMovementSchema.index({ material: 1, createdAt: -1 });
// Para encontrar los movimientos de una compra al anularla.
inventoryMovementSchema.index({ 'origen.tipo': 1, 'origen.id': 1 });

export const InventoryMovement = mongoose.model('InventoryMovement', inventoryMovementSchema);
export default InventoryMovement;
