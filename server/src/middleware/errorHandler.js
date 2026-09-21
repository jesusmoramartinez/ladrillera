// -----------------------------------------------------------------------------
// errorHandler.js — Manejo centralizado de errores
// -----------------------------------------------------------------------------
// Un "middleware" es una funcion que Express ejecuta en el medio del camino
// entre que llega el pedido y que se manda la respuesta.
//
// Aca hay tres piezas:
//   - ApiError       : error "de negocio" con codigo HTTP (ej. 404, 409).
//   - notFoundHandler: si ninguna ruta coincidio, responde 404 en JSON.
//   - errorHandler   : atrapa TODO error y responde siempre el mismo formato.
//
// Sin esto, un error inesperado devolveria una pagina HTML de Express con el
// stack trace adentro: feo para el celular e inseguro en produccion.
// -----------------------------------------------------------------------------

import { env } from '../config/env.js';

/**
 * Error con codigo HTTP. Se usa asi desde un controlador o servicio:
 *   throw new ApiError(404, 'El empleado no existe');
 */
export class ApiError extends Error {
  /**
   * @param {number} status  codigo HTTP (400, 401, 404, 409...)
   * @param {string} mensaje texto que va a leer el usuario
   * @param {object} [detalles] informacion extra opcional (ej. errores de campos)
   */
  constructor(status, mensaje, detalles = undefined) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.detalles = detalles;
    // Marca para distinguir errores previstos de bugs inesperados.
    this.esOperacional = true;
  }
}

/**
 * Se monta DESPUES de todas las rutas. Si el pedido llego hasta aca,
 * es porque ninguna ruta lo atendio.
 */
export function notFoundHandler(req, res, next) {
  next(new ApiError(404, `No existe la ruta ${req.method} ${req.originalUrl}`));
}

/**
 * Manejador final de errores.
 * Express reconoce que es un manejador de errores porque recibe CUATRO
 * parametros (err, req, res, next). Ese detalle no es opcional: si sacaras
 * `next`, Express lo trataria como un middleware comun.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Errores de validacion de Mongoose -> 400 (el cliente mando algo invalido)
  if (err?.name === 'ValidationError') {
    return res.status(400).json({
      ok: false,
      error: 'Datos invalidos',
      detalles: Object.values(err.errors).map((e) => e.message),
    });
  }

  // Id de Mongo mal formado (ej. /employees/abc) -> 400
  if (err?.name === 'CastError') {
    return res.status(400).json({ ok: false, error: 'Identificador invalido' });
  }

  // Clave duplicada (indice unico) -> 409 conflicto
  if (err?.code === 11000) {
    return res.status(409).json({ ok: false, error: 'Ese registro ya existe' });
  }

  const status = err?.status ?? 500;

  // Un 500 es un bug nuestro: lo dejamos en el log del servidor para poder
  // investigarlo. Los 4xx son errores esperables del uso normal.
  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json({
    ok: false,
    error: status >= 500 && env.isProd ? 'Error interno del servidor' : err.message,
    ...(err?.detalles ? { detalles: err.detalles } : {}),
    // El stack (donde exploto el codigo) solo se muestra en desarrollo:
    // en produccion seria darle pistas a un atacante.
    ...(env.isProd ? {} : { stack: err?.stack }),
  });
}
