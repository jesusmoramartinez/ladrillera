// -----------------------------------------------------------------------------
// Setting.js — La configuracion del sistema (plan, seccion 4.9)
// -----------------------------------------------------------------------------
// Son los numeros que hoy valen 25.000 pero manana pueden cambiar: cuantos
// ladrillos salen de un camion de arcilla, a partir de cuanto avisar que falta,
// como llama el dueno a la unidad de lena.
//
// Estan en la BASE y no escritos en el codigo para que se puedan cambiar desde
// la app, sin que nadie tenga que tocar un archivo ni volver a publicar nada.
//
// PATRON SINGLETON: esta coleccion tiene UN SOLO documento. El campo `clave`
// siempre vale 'principal' y es unico, asi que la base misma impide que se
// creen dos por accidente (por ejemplo, si dos pedidos llegan al mismo tiempo).
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';

export const CLAVE_UNICA = 'principal';

/** Los valores con los que arranca el sistema (plan, seccion 4.9). */
export const VALORES_INICIALES = {
  ladrillosPorCamion: 25_000,
  umbralAlertaArcilla: 25_000,
  unidadLena: 'carga',
  configuracionInicialHecha: false,
};

const settingSchema = new mongoose.Schema(
  {
    clave: {
      type: String,
      default: CLAVE_UNICA,
      unique: true,
      immutable: true, // ni siquiera se puede cambiar por error
    },

    // Cuantos ladrillos salen de un camion de arcilla.
    ladrillosPorCamion: {
      type: Number,
      default: VALORES_INICIALES.ladrillosPorCamion,
      min: [1, 'Tiene que ser mayor a cero'],
      validate: { validator: Number.isInteger, message: 'Tiene que ser entero' },
    },

    // Debajo de este numero (en ladrillos-equivalentes) salta la alerta roja.
    umbralAlertaArcilla: {
      type: Number,
      default: VALORES_INICIALES.umbralAlertaArcilla,
      min: [0, 'No puede ser negativo'],
      validate: { validator: Number.isInteger, message: 'Tiene que ser entero' },
    },

    // Como le dice el dueno: "carga", "camion", "metro"... Lo define el en la
    // configuracion inicial, porque cambia de fabrica en fabrica.
    unidadLena: {
      type: String,
      default: VALORES_INICIALES.unidadLena,
      trim: true,
      maxlength: [20, 'Demasiado largo'],
    },

    // Pasa a true cuando termina el asistente de configuracion inicial (fase 10).
    configuracionInicialHecha: {
      type: Boolean,
      default: VALORES_INICIALES.configuracionInicialHecha,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.clave; // al cliente no le aporta nada
        return ret;
      },
    },
  },
);

/**
 * Devuelve la configuracion, creandola con los valores iniciales si todavia
 * no existe.
 *
 * `upsert: true` = "actualiza o, si no existe, crealo". Es una sola operacion
 * atomica contra la base: aunque dos pedidos entren al mismo tiempo, no se
 * crean dos documentos.
 */
settingSchema.statics.obtener = function obtener() {
  return this.findOneAndUpdate(
    { clave: CLAVE_UNICA },
    { $setOnInsert: VALORES_INICIALES }, // solo se aplica si lo tiene que crear
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

export const Setting = mongoose.model('Setting', settingSchema);
export default Setting;
