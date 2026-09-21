// -----------------------------------------------------------------------------
// auth.service.js — Las reglas de negocio del login
// -----------------------------------------------------------------------------
// Un "servicio" es donde vive la logica: no sabe nada de HTTP (ni de req ni de
// res). Recibe datos comunes y devuelve datos comunes. Eso lo hace facil de
// testear y de reutilizar (ej. desde un script de consola).
// -----------------------------------------------------------------------------

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/errorHandler.js';
import { User } from '../models/User.js';

/**
 * Fabrica el token de sesion.
 *
 * Un JWT (JSON Web Token) es un texto con tres partes separadas por puntos:
 *   cabecera.contenido.firma
 * Las dos primeras son datos legibles por cualquiera (NO son secretas: van en
 * base64, no encriptadas). La tercera es la FIRMA, calculada con JWT_SECRET.
 *
 * La gracia: cualquiera puede LEER el token, pero nadie puede FABRICAR uno
 * valido sin conocer el secreto del servidor. Si alguien cambia el contenido,
 * la firma deja de coincidir y el servidor lo rechaza.
 *
 * Por eso adentro va solo el id del usuario, nunca la contrasena.
 */
function firmarToken(user) {
  return jwt.sign(
    { sub: String(user._id), username: user.username }, // "sub" = subject (de quien es)
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

/**
 * Verifica usuario + contrasena y devuelve el token.
 * @param {{ username: string, password: string }} credenciales
 */
export async function login({ username, password }) {
  // .select('+passwordHash') porque el modelo lo esconde por defecto.
  const user = await User.findOne({ username }).select('+passwordHash');

  // Detalle de seguridad: el mensaje es el MISMO si el usuario no existe o si
  // la contrasena esta mal. Si dijeramos "ese usuario no existe", un atacante
  // podria ir probando nombres hasta descubrir cual es el valido.
  const credencialesInvalidas = new ApiError(401, 'Usuario o contrasena incorrectos');

  if (!user) {
    // Hasheamos igual contra un valor descartable para que responder "usuario
    // inexistente" tarde lo mismo que "contrasena incorrecta". Sin esto, la
    // diferencia de tiempo delata que el usuario existe (timing attack).
    await User.hashearPassword(password);
    throw credencialesInvalidas;
  }

  const coincide = await user.verificarPassword(password);
  if (!coincide) throw credencialesInvalidas;

  return {
    token: firmarToken(user),
    usuario: { id: String(user._id), username: user.username },
  };
}

/**
 * Cambia la contrasena del usuario logueado (pantalla Ajustes, plan seccion 7).
 */
export async function cambiarPassword(userId, { passwordActual, passwordNueva }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new ApiError(404, 'El usuario no existe');

  const coincide = await user.verificarPassword(passwordActual);
  if (!coincide) throw new ApiError(401, 'La contrasena actual es incorrecta');

  user.passwordHash = await User.hashearPassword(passwordNueva);
  await user.save();

  // Devolvemos un token nuevo para que la sesion actual siga andando.
  return { token: firmarToken(user) };
}

/**
 * Busca al usuario por id. Lo usa el middleware requireAuth y el endpoint /me.
 */
export async function buscarUsuarioPorId(id) {
  return User.findById(id);
}
