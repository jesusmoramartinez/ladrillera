#!/usr/bin/env node
// -----------------------------------------------------------------------------
// seed.js — Carga los datos iniciales del sistema
// -----------------------------------------------------------------------------
// Se corre una vez al preparar la base:
//
//   npm run seed --workspace server
//
// Se puede volver a correr cuantas veces quieras: no duplica nada ni pisa lo
// que hayas cambiado (ver services/seed.service.js).
// -----------------------------------------------------------------------------

import { env } from '../src/config/env.js';
import { conectarBaseDeDatos, desconectarBaseDeDatos } from '../src/config/database.js';
import { sembrar } from '../src/services/seed.service.js';

async function main() {
  console.log('\n=== Datos iniciales — Ladrillera ===');
  // Tapamos usuario y clave por si alguien mira la pantalla o pega el log.
  console.log(`Base: ${env.mongodbUri.replace(/\/\/[^@]+@/, '//<usuario>:<clave>@')}\n`);

  await conectarBaseDeDatos();
  try {
    await sembrar();
    console.log('\nListo.');
  } finally {
    await desconectarBaseDeDatos();
  }
}

main().catch((error) => {
  console.error('\nError:', error.message);
  process.exit(1);
});
