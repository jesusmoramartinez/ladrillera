// -----------------------------------------------------------------------------
// Client.js — Los clientes de la fabrica (plan, seccion 4.6b)
// -----------------------------------------------------------------------------
// Es el modelo mas chico del sistema: nombre, telefono y notas. Nada mas.
//
// POR QUE ES TAN SIMPLE, Y POR QUE ESTA BIEN QUE LO SEA
//
// La tentacion al modelar clientes es agregar direccion, ciudad, RUC, email,
// fecha de nacimiento... Nada de eso sirve para nada todavia: el sistema no
// factura, no manda emails y no hace reparto por direccion. Cada campo de mas
// es un campo que hay que llenar parado en la fabrica con una mano ocupada.
//
// El dia que aparezca una necesidad real (por ejemplo facturar), se agrega el
// campo. Agregar un campo despues es facil; sacar uno que ya se lleno durante
// un ano, no.
//
// El telefono se guarda como TEXTO y no como numero. Tres razones:
//   - "0981 123 456" tiene espacios, y "+595..." tiene un signo.
//   - Un cero adelante se perderia: 0981 guardado como numero es 981.
//   - Nunca se hacen cuentas con un telefono.
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      minlength: [2, 'El nombre es demasiado corto'],
      maxlength: [80, 'El nombre es demasiado largo'],
    },
    telefono: {
      type: String,
      trim: true,
      maxlength: [30, 'El telefono es demasiado largo'],
      default: '',
    },
    notas: {
      type: String,
      trim: true,
      maxlength: [200, 'Las notas son demasiado largas'],
      default: '',
    },
    // SOFT DELETE, igual que en el resto del sistema: null = vigente.
    // Nunca se borra, porque sus ventas viejas lo siguen mencionando.
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

// La consulta de siempre: "los clientes vigentes, ordenados por nombre".
clientSchema.index({ deletedAt: 1, nombre: 1 });

export const Client = mongoose.model('Client', clientSchema);
export default Client;
