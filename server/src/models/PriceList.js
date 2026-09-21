// -----------------------------------------------------------------------------
// PriceList.js — Listas de precio (plan, seccion 4.6a2)
// -----------------------------------------------------------------------------
// "Normal", "Mayorista", "Promocion"... cada una con su precio por cada 1.000
// ladrillos. Al vender se elige una y el precio se copia dentro de la venta
// (snapshot), asi cambiar la lista despues no altera las ventas ya hechas.
//
// Se crean en esta fase, pero se USAN en la fase 6 (ventas). Estan ahora
// porque el plan las pide junto con el resto de los datos iniciales.
//
// UNA SOLA puede ser `predeterminada`: es la que aparece elegida al abrir una
// venta nueva. Esa regla la hace cumplir el servicio, no el esquema, porque
// involucra a varios documentos a la vez.
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import { MONTO_MAXIMO } from '../logic/money.js';

const priceListSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      minlength: [2, 'El nombre es demasiado corto'],
      maxlength: [40, 'El nombre es demasiado largo'],
    },
    precioPorMil: {
      type: Number,
      required: [true, 'El precio es obligatorio'],
      min: [1, 'El precio tiene que ser mayor a cero'],
      max: [MONTO_MAXIMO, 'El precio es demasiado grande'],
      validate: {
        validator: Number.isInteger,
        message: 'El precio tiene que ser un numero entero de guaranies',
      },
    },
    predeterminada: {
      type: Boolean,
      default: false,
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

priceListSchema.index({ deletedAt: 1, nombre: 1 });

export const PriceList = mongoose.model('PriceList', priceListSchema);
export default PriceList;
