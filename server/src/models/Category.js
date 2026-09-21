// -----------------------------------------------------------------------------
// Category.js — Categorias de caja (plan, seccion 4.6a)
// -----------------------------------------------------------------------------
// Sirven para clasificar lo que entra y sale de la caja: combustible, flete,
// sueldos, venta...
//
// HAY DOS CLASES, y la diferencia importa:
//
//   sistema: true   Las usa el propio sistema cuando genera un movimiento solo
//                   (una compra genera un egreso 'compra_material'; un pago de
//                   venta genera un ingreso 'venta'). NO se pueden editar, ni
//                   borrar, ni elegir a mano al cargar un gasto.
//                   Si el dueno renombrara "Venta" a "Cosas", el codigo que la
//                   busca por su clave seguiria funcionando, pero el sistema
//                   quedaria mostrando datos confusos. Mejor bloquearlas.
//
//   sistema: false  Las de todos los dias, que el dueno puede crear, renombrar
//                   y desactivar: combustible, flete, herramientas...
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';

/**
 * Las claves de las categorias que usa el sistema. Son constantes del codigo:
 * cuando un servicio necesita "la categoria de compra de material", la busca
 * por esta clave y no por su nombre, que el dia de manana podria cambiar.
 */
export const CATEGORIAS_SISTEMA = {
  VENTA: 'venta',
  COMPRA_MATERIAL: 'compra_material',
  ADELANTO: 'adelanto',
  SUELDOS: 'sueldos',
};

const categorySchema = new mongoose.Schema(
  {
    // Identificador estable para las de sistema. Las que crea el dueno no
    // llevan clave (queda null).
    clave: {
      type: String,
      default: null,
      trim: true,
    },
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      minlength: [2, 'El nombre es demasiado corto'],
      maxlength: [40, 'El nombre es demasiado largo'],
    },
    tipo: {
      type: String,
      required: true,
      // enum limita los valores posibles: cualquier otro texto se rechaza.
      enum: {
        values: ['ingreso', 'egreso'],
        message: 'El tipo tiene que ser ingreso o egreso',
      },
    },
    sistema: {
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

// Indice unico PARCIAL: solo se aplica a los documentos que tienen clave (o
// sea, los de sistema). Sin el "partialFilterExpression", Mongo consideraria
// que todas las categorias del dueno tienen clave null y chocarian entre si.
categorySchema.index(
  { clave: 1 },
  { unique: true, partialFilterExpression: { clave: { $type: 'string' } } },
);

categorySchema.index({ deletedAt: 1, tipo: 1, nombre: 1 });

export const Category = mongoose.model('Category', categorySchema);
export default Category;
