// -----------------------------------------------------------------------------
// User.js — El usuario que entra al sistema (el dueno)
// -----------------------------------------------------------------------------
// Un "modelo" de Mongoose define la FORMA que tiene un documento en MongoDB.
// MongoDB por si solo acepta cualquier cosa; el esquema es el que pone las
// reglas (que campos hay, de que tipo, cuales son obligatorios).
//
// Regla de oro de este archivo: la contrasena NUNCA se guarda como la escribio
// el usuario. Se guarda su "hash" (ver abajo).
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// Cuantas "vueltas" de calculo hace bcrypt. Cada +1 DUPLICA el tiempo que
// tarda. 12 es el estandar actual: ~250 ms en una PC normal.
// Lento a proposito: si alguien roba la base, probar millones de contrasenas
// le va a tomar anos en vez de minutos.
export const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'El usuario es obligatorio'],
      unique: true,     // crea un indice unico: no puede haber dos iguales
      trim: true,       // saca espacios al principio y al final
      lowercase: true,  // "Juan" y "juan" son el mismo usuario
      minlength: [3, 'El usuario debe tener al menos 3 caracteres'],
    },
    passwordHash: {
      type: String,
      required: true,
      // select: false -> por defecto las consultas NO traen este campo.
      // Asi, si en el futuro alguien hace res.json(usuario), el hash no se
      // escapa por accidente. Para traerlo hay que pedirlo explicitamente:
      //   User.findOne({ username }).select('+passwordHash')
      select: false,
    },
  },
  {
    // Agrega createdAt y updatedAt automaticamente.
    timestamps: true,
    // Como se ve el documento al convertirlo a JSON (al mandarlo al celular).
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;     // el celular prefiere "id" antes que "_id"
        delete ret._id;
        delete ret.__v;       // version interna de Mongoose, no le sirve a nadie
        delete ret.passwordHash; // cinturon y tiradores
        return ret;
      },
    },
  },
);

/**
 * Convierte una contrasena en texto plano a su hash.
 *
 * Un "hash" es el resultado de una cuenta que va en UNA sola direccion:
 * de "miClave123" se puede sacar el hash, pero del hash NO se puede volver
 * a "miClave123". Por eso, si te roban la base, no se llevan las contrasenas.
 *
 * bcrypt ademas agrega un "salt": unos caracteres al azar distintos para cada
 * contrasena. Por eso dos personas con la MISMA contrasena tienen hashes
 * DISTINTOS, y no sirve una tabla de hashes precalculados para adivinarlas.
 */
userSchema.statics.hashearPassword = function hashearPassword(passwordPlano) {
  return bcrypt.hash(passwordPlano, BCRYPT_ROUNDS);
};

/**
 * Compara la contrasena escrita en el login contra el hash guardado.
 * No "desencripta" nada: vuelve a hashear lo que escribieron (usando el mismo
 * salt, que viene dentro del hash) y compara los resultados.
 *
 * Ojo: solo funciona si el documento se busco con .select('+passwordHash').
 */
userSchema.methods.verificarPassword = function verificarPassword(passwordPlano) {
  if (!this.passwordHash) {
    throw new Error('El usuario se consulto sin passwordHash: usa .select("+passwordHash")');
  }
  return bcrypt.compare(passwordPlano, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);
export default User;
