// -----------------------------------------------------------------------------
// requireAuth.js — El "portero" de las rutas protegidas
// -----------------------------------------------------------------------------
// Se pone ANTES de las rutas que requieren estar logueado:
//   router.use('/employees', requireAuth, employeesRoutes);
//
// Que hace, paso a paso:
//   1. Busca el token en la cabecera "Authorization: Bearer <token>".
//   2. Verifica la firma con JWT_SECRET y que no este vencido.
//   3. Confirma que el usuario del token siga existiendo en la base.
//   4. Lo deja en req.usuario y llama a next() para seguir.
// Si algo falla, responde 401 y el pedido nunca llega al controlador.
// -----------------------------------------------------------------------------

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './errorHandler.js';
import { buscarUsuarioPorId } from '../services/auth.service.js';

/**
 * "Bearer" significa "portador": quien tenga este token, es el usuario.
 * Es el formato estandar (RFC 6750). La cabecera llega asi:
 *   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....
 */
function extraerToken(req) {
  const cabecera = req.headers.authorization;
  if (!cabecera || !cabecera.startsWith('Bearer ')) return null;
  const token = cabecera.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = extraerToken(req);
    if (!token) {
      throw new ApiError(401, 'Falta el token de sesion. Inicia sesion de nuevo.');
    }

    let payload;
    try {
      // verify hace dos cosas: chequea la firma y chequea que no este vencido.
      payload = jwt.verify(token, env.jwtSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Tu sesion vencio. Inicia sesion de nuevo.');
      }
      throw new ApiError(401, 'Token invalido.');
    }

    // Aunque la firma sea valida, el usuario pudo haber sido borrado despues
    // de que se emitio el token. Por eso lo confirmamos contra la base.
    const usuario = await buscarUsuarioPorId(payload.sub);
    if (!usuario) {
      throw new ApiError(401, 'El usuario de esta sesion ya no existe.');
    }

    // Queda disponible para cualquier controlador que venga despues.
    req.usuario = usuario;
    req.usuarioId = String(usuario._id);

    next();
  } catch (error) {
    next(error); // se lo pasamos al errorHandler
  }
}

export default requireAuth;
