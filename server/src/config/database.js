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
