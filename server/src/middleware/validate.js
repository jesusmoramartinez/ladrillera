// -----------------------------------------------------------------------------
// validate.js — Middleware que aplica un esquema de Zod
// -----------------------------------------------------------------------------
// Se usa asi en una ruta:
//   router.post('/login', validate(loginSchema), login);
//
// Si los datos estan bien, reemplaza req.body por la version YA limpia
// (con trim, lowercase, numeros convertidos) y deja pasar.
// Si estan mal, corta ahi con un 400 y la lista de errores por campo.
// -----------------------------------------------------------------------------

import { ApiError } from './errorHandler.js';

/**
 * @param {import('zod').ZodType} schema
 * @param {'body'|'query'|'params'} origen  de donde sacar los datos
 */
export function validate(schema, origen = 'body') {
  return (req, res, next) => {
    // safeParse no lanza excepcion: devuelve { success, data } o { success, error }.
    const resultado = schema.safeParse(req[origen]);

    if (!resultado.success) {
      const detalles = resultado.error.issues.map((issue) => ({
        campo: issue.path.join('.') || '(cuerpo)',
        mensaje: issue.message,
      }));
      return next(new ApiError(400, 'Datos invalidos', detalles));
    }

    // Guardamos la version limpia. Para query y params, que en Express 5 son
    // de solo lectura, la dejamos aparte en vez de reasignar.
    if (origen === 'body') {
      req.body = resultado.data;
    } else {
      req.datosValidados = resultado.data;
    }

    next();
  };
}
