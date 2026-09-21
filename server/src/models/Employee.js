// -----------------------------------------------------------------------------
// Employee.js — Los empleados de la fabrica
// -----------------------------------------------------------------------------
// Campos segun el plan (seccion 4.2): nombre, rol, tarifaPorMil, activo,
// deletedAt.
//
// Hay DOS formas distintas de "sacar" a un empleado, y conviene no mezclarlas:
//
//   activo: false   -> sigue existiendo, pero no aparece para cargar produccion.
//                      Para alguien que esta de licencia o dejo de venir un
//                      tiempo. Se puede volver a activar con un toque.
//
//   deletedAt: Date -> se elimino de la lista (SOFT DELETE: se marca, no se
//                      borra). Sus producciones y liquidaciones viejas siguen
//                      intactas.
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      minlength: [2, 'El nombre es demasiado corto'],
      maxlength: [60, 'El nombre es demasiado largo'],
    },
    rol: {
      type: String,
      trim: true,
      maxlength: [40, 'El rol es demasiado largo'],
      default: '',
    },
    // Fase 8: para mandarle el ticket de la semana por WhatsApp.
    //
    // Se guarda TEXTO y no numero, igual que en Client: "0981 123 456" tiene
    // espacios, "+595..." tiene un signo, y un cero adelante se perderia
    // (0981 guardado como numero es 981). Nunca se hacen cuentas con un
    // telefono.
    //
    // Es opcional: el sistema tiene que seguir funcionando igual para un
    // empleado sin celular. Lo unico que no va a poder es recibir el ticket.
    telefono: {
      type: String,
      trim: true,
      maxlength: [30, 'El telefono es demasiado largo'],
      default: '',
    },
    tarifaPorMil: {
      type: Number,
      required: [true, 'La tarifa es obligatoria'],
      min: [1, 'La tarifa tiene que ser mayor a cero'],
      // validate corre ADEMAS de min. Aca chequeamos que sea entero: el
      // guarani no tiene centavos (plan 5.3).
      validate: {
        validator: Number.isInteger,
        message: 'La tarifa tiene que ser un numero entero de guaranies',
      },
    },
    activo: {
      type: Boolean,
      default: true,
    },
    // SOFT DELETE: null = vigente. Una fecha = eliminado ese dia.
    // Nunca se borra el documento, asi los registros viejos que lo mencionan
    // no quedan apuntando a la nada.
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

// Un indice es un atajo que usa MongoDB para buscar sin recorrer todo.
// Casi todas las consultas van a ser "los no eliminados, ordenados por nombre",
// asi que armamos el indice con esos dos campos, en ese orden.
employeeSchema.index({ deletedAt: 1, nombre: 1 });

export const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;
