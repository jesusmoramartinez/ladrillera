// -----------------------------------------------------------------------------
// database.js — Conexion a MongoDB usando Mongoose
// -----------------------------------------------------------------------------
// Mongoose es la libreria que habla con MongoDB. Ademas de conectarse, mas
// adelante nos va a dejar definir la "forma" de cada documento (los modelos de
// la carpeta models/).
//
// Importante: aca SOLO se conecta. La logica de negocio no vive en este archivo.
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import { env } from './env.js';

// Con `strictQuery` en true, si filtramos por un campo que no existe en el
// esquema, Mongoose lo ignora en vez de traer datos de mas. Es el modo seguro.
mongoose.set('strictQuery', true);

/**
 * Traduce el numero de estado de la conexion a algo legible.
 * Mongoose expone `mongoose.connection.readyState` como numero.
 */
const ESTADOS = {
  0: 'desconectado',
  1: 'conectado',
  2: 'conectando',
  3: 'desconectando',
};

export function estadoConexion() {
  return ESTADOS[mongoose.connection.readyState] ?? 'desconocido';
}

export function estaConectada() {
  return mongoose.connection.readyState === 1;
}

/**
 * Abre la conexion con MongoDB.
 * Se llama UNA vez al arrancar el servidor (en server.js).
 * Devuelve una promesa: por eso en server.js se usa `await`.
 */
export async function conectarBaseDeDatos() {
  // Estos "escuchadores" de eventos nos avisan por consola si la conexion se
  // cae o se recupera sola mientras el servidor sigue andando.
  mongoose.connection.on('error', (error) => {
    console.error('[mongo] Error de conexion:', error.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[mongo] Conexion perdida. Mongoose va a reintentar solo.');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[mongo] Conexion restablecida.');
  });

  await mongoose.connect(env.mongodbUri, {
    // Si la base no responde en 10 segundos, falla con un error claro en vez
    // de quedar colgado para siempre.
    serverSelectionTimeoutMS: 10_000,
  });

  // Mostramos tambien el HOST: el nombre de la base suele ser el mismo en
  // desarrollo y en produccion, asi que sin el host es facil creer que estas
  // trabajando contra una base cuando en realidad estas contra otra.
  console.log(
    `[mongo] Conectado a "${mongoose.connection.name}" en ${mongoose.connection.host}.`,
  );
  return mongoose.connection;
}

/**
 * Cierra la conexion de forma ordenada.
 * Se usa al apagar el servidor (Ctrl+C) para no dejar conexiones abiertas.
 */
export async function desconectarBaseDeDatos() {
  await mongoose.connection.close();
  console.log('[mongo] Conexion cerrada.');
}

// -----------------------------------------------------------------------------
// TRANSACCIONES — el "todo o nada"
// -----------------------------------------------------------------------------
// Una transaccion agrupa varias escrituras en la base y garantiza que pasen
// TODAS o NINGUNA.
//
// Por que hace falta: registrar una compra de arcilla son cuatro escrituras
// (sumar el stock, anotar el movimiento en el historial, crear el egreso de
// caja, guardar la compra). Si el servidor se cae despues de la segunda, sin
// transaccion te queda stock sumado que nadie pago. Los numeros dejan de
// cerrar y no hay forma de saber cual falto.
//
// Con transaccion, si algo falla la base deshace sola todo lo anterior.
//
// LETRA CHICA: MongoDB solo permite transacciones en "replica sets" (varias
// copias de la base coordinadas). Atlas lo es siempre, y los tests levantan
// una base en memoria configurada como replica set justamente por esto. Un
// mongod suelto instalado a mano NO sirve.
// -----------------------------------------------------------------------------

/**
 * Ejecuta `trabajo` dentro de una transaccion.
 *
 * A `trabajo` se le pasa la "sesion", que hay que reenviar a CADA operacion de
 * base que se haga adentro:
 *
 *     await conTransaccion(async (session) => {
 *       await Inventory.updateOne(filtro, cambio, { session });
 *       await InventoryMovement.create([datos], { session });
 *     });
 *
 * Si te olvidas de pasar `session` en alguna, esa escritura queda FUERA de la
 * transaccion y no se deshace si el resto falla. Es el error tipico y no avisa.
 *
 * Ojo con `create`: dentro de una transaccion hay que llamarlo con un ARRAY
 * (`create([datos], { session })`), porque la forma de un solo objeto ignora
 * las opciones.
 *
 * @template T
 * @param {(session: import('mongoose').ClientSession) => Promise<T>} trabajo
 * @returns {Promise<T>}
 */
export async function conTransaccion(trabajo) {
  const session = await mongoose.startSession();
  try {
    let resultado;
    // withTransaction ademas reintenta solo si la base devuelve un error
    // pasajero (por ejemplo, dos pedidos tocando el mismo documento).
    await session.withTransaction(async () => {
      resultado = await trabajo(session);
    });
    return resultado;
  } catch (error) {
    // Mensaje claro para el error mas probable al configurar el entorno.
    if (/Transaction numbers are only allowed|replica set/i.test(error.message)) {
      throw new Error(
        'Esta operacion necesita transacciones, y tu MongoDB no es un replica set. ' +
          'Usa MongoDB Atlas (lo es siempre) o levanta mongod con --replSet.',
      );
    }
    throw error;
  } finally {
    // endSession libera la conexion. Sin esto se van acumulando sesiones
    // abiertas hasta agotar el limite del servidor.
    await session.endSession();
  }
}
