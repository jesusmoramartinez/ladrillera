// -----------------------------------------------------------------------------
// server.js — Punto de entrada: prende el servidor
// -----------------------------------------------------------------------------
// Orden del arranque (y el orden importa):
//   1. Conectar a MongoDB.
//   2. Recien ahi empezar a escuchar pedidos.
// Si empezaramos a escuchar antes, el primer pedido que entre encontraria la
// base a medio conectar.
//
// Tambien se encarga del "apagado ordenado": al hacer Ctrl+C, primero deja de
// aceptar pedidos nuevos, despues cierra la base y recien ahi se va.
// -----------------------------------------------------------------------------

import app from './app.js';
import { env } from './config/env.js';
import { conectarBaseDeDatos, desconectarBaseDeDatos } from './config/database.js';

async function iniciar() {
  try {
    await conectarBaseDeDatos();

    const server = app.listen(env.port, () => {
      console.log(`[api] Servidor escuchando en http://localhost:${env.port}`);
      console.log(`[api] Probalo en  http://localhost:${env.port}/api/health`);
      console.log(`[api] Entorno: ${env.nodeEnv}`);
    });

    // SIGINT = Ctrl+C.  SIGTERM = el hosting pidiendo que nos apaguemos.
    for (const senal of ['SIGINT', 'SIGTERM']) {
      process.on(senal, async () => {
        console.log(`\n[api] Recibi ${senal}, apagando...`);
        server.close(async () => {
          await desconectarBaseDeDatos();
          process.exit(0); // 0 = "termine bien"
        });
      });
    }
  } catch (error) {
    console.error('[api] No pude arrancar:', error.message);
    console.error('[api] Revisa MONGODB_URI en server/.env y tu conexion a internet.');
    process.exit(1);
  }
}

// Una promesa rechazada que nadie atrapo suele ser un bug: preferimos enterarnos
// y apagar, antes que seguir andando en un estado raro.
process.on('unhandledRejection', (razon) => {
  console.error('[api] Promesa rechazada sin manejar:', razon);
  process.exit(1);
});

iniciar();
