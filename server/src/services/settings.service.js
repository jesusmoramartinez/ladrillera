// -----------------------------------------------------------------------------
// settings.service.js — Leer y cambiar la configuracion
// -----------------------------------------------------------------------------
// Corto porque el modelo ya hace el trabajo pesado (el patron singleton de
// Setting.obtener()).
// -----------------------------------------------------------------------------

import { Setting } from '../models/Setting.js';

export async function obtener() {
  return Setting.obtener();
}

/**
 * Cambia solo los campos que llegan.
 *
 * Aviso importante para el dia que cambien ladrillosPorCamion: NO se recalcula
 * el stock que ya existe. El stock esta guardado en ladrillos-equivalentes, que
 * es una cantidad real de material; lo unico que cambia es a cuantos camiones
 * equivale de ahi en adelante. Recalcular seria reescribir la historia.
 */
export async function actualizar(cambios) {
  const config = await Setting.obtener();
  Object.assign(config, cambios);
  await config.save();
  return config;
}
