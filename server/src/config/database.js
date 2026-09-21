// -----------------------------------------------------------------------------
// database.js — Conexión a MongoDB usando Mongoose (Soporte Serverless / Vercel)
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

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

// Variable en memoria para reutilizar la promesa de conexión en Vercel
let promesaConexion = null;

/**
 * Abre y mantiene la conexión con MongoDB.
 * En entornos Serverless (Vercel), reutiliza la conexión si ya está activa.
 */
export async function conectarBaseDeDatos() {
  // 1. Si la conexión ya está lista (estado 1: conectado), la devolvemos inmediatamente
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // 2. Si no hay un intento de conexión en curso, iniciamos uno nuevo
  if (!promesaConexion) {
    mongoose.connection.on('error', (error) => {
      console.error('[mongo] Error de conexión:', error.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[mongo] Conexión perdida. Mongoose va a reintentar solo.');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('[mongo] Conexión restablecida.');
    });

    promesaConexion = mongoose
      .connect(env.mongodbUri, {
        serverSelectionTimeoutMS: 10_000,
      })
      .then(() => {
        console.log(
          `[mongo] Conectado a "${mongoose.connection.name}" en ${mongoose.connection.host}.`,
        );
        return mongoose.connection;
      })
      .catch((error) => {
        promesaConexion = null; // Si falló, reseteamos para reintentar en la próxima petición
        throw error;
      });
  }

  return promesaConexion;
}

/**
 * Cierra la conexión de forma ordenada.
 */
export async function desconectarBaseDeDatos() {
  await mongoose.connection.close();
  promesaConexion = null;
  console.log('[mongo] Conexión cerrada.');
}

// -----------------------------------------------------------------------------
// TRANSACCIONES — el "todo o nada"
// -----------------------------------------------------------------------------

/**
 * Ejecuta `trabajo` dentro de una transacción.
 *
 * @template T
 * @param {(session: import('mongoose').ClientSession) => Promise<T>} trabajo
 * @returns {Promise<T>}
 */
export async function conTransaccion(trabajo) {
  const session = await mongoose.startSession();
  try {
    let resultado;
    await session.withTransaction(async () => {
      resultado = await trabajo(session);
    });
    return resultado;
  } catch (error) {
    if (/Transaction numbers are only allowed|replica set/i.test(error.message)) {
      throw new Error(
        'Esta operación necesita transacciones, y tu MongoDB no es un replica set. ' +
          'Usa MongoDB Atlas (lo es siempre) o levanta mongod con --replSet.',
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}