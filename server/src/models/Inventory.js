// -----------------------------------------------------------------------------
// Inventory.js — El stock ACTUAL de cada material (plan, seccion 4.7)
// -----------------------------------------------------------------------------
// Un documento por material: arcilla_pura, arcilla_floja, lena, ladrillos.
// Guarda un solo numero: cuanto hay ahora.
//
// POR QUE GUARDAR EL TOTAL Y NO CALCULARLO SUMANDO EL HISTORIAL
//
// Se podria no tener esta coleccion y calcular el stock sumando todos los
// movimientos cada vez. Seria mas "puro", pero dentro de un ano serian miles
// de sumas para dibujar una pantalla que se abre todo el tiempo.
//
// Entonces se guardan las dos cosas: este total (rapido de leer) y el
// historial completo en inventoryMovements (para saber POR QUE cambio).
// El precio de esa decision es que hay que mantenerlos sincronizados, y por
// eso todo cambio de stock se hace dentro de una TRANSACCION: o se guardan
// los dos, o no se guarda ninguno.
//
// La unidad depende del material (plan, seccion 5.2):
//   arcilla_pura / arcilla_floja -> ladrillos-equivalentes (1 camion = 25.000)
//   lena                         -> la unidad que definio el dueno
//   ladrillos                    -> ladrillos
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import { MATERIALES } from '../logic/inventory.js';

const inventorySchema = new mongoose.Schema(
  {
    material: {
      type: String,
      required: true,
      unique: true,        // un solo documento por material
      enum: {
        values: MATERIALES,
        message: 'Material desconocido',
      },
    },
    // Puede quedar en negativo si el dueno registra una entrega mayor a lo que
    // el sistema cree que hay. El plan (5.7) pide avisar, no bloquear: el
    // stock real manda sobre el numero del sistema.
    cantidad: {
      type: Number,
      required: true,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'La cantidad tiene que ser entera',
      },
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

export const Inventory = mongoose.model('Inventory', inventorySchema);
export default Inventory;
