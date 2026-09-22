#!/usr/bin/env node
// -----------------------------------------------------------------------------
// restaurar.js — Vuelve la base a como estaba en un respaldo
// -----------------------------------------------------------------------------
//   npm run restaurar --workspace server -- server/respaldos/ARCHIVO.ejson
//
// UN RESPALDO QUE NUNCA SE PROBO NO ES UN RESPALDO. Es un archivo.
//
// Lo digo en serio: la primera vez que alguien necesita restaurar es el peor
// momento posible para descubrir que el script no anda. Probalo una vez, con
// una base descartable, ANTES de necesitarlo:
//
//   1. npm run respaldar --workspace server                    (contra la real)
//   2. MONGODB_URI="mongodb://127.0.0.1:27017/prueba_restore" \
//        npm run restaurar --workspace server -- <el archivo>
//   3. Mirar que los datos esten.
//
// ESTE SCRIPT BORRA LO QUE HAYA ANTES.
//
// Restaurar "mezclando" con lo que ya esta suena mas prudente y es peor: te
// deja una base mitad vieja y mitad nueva, con el stock de un dia y las ventas
// de otro. Si vas a volver a un punto en el tiempo, tenes que volver del todo.
// Por eso pide escribir BORRAR para confirmar.
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import readline from 'node:readline';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from '../src/config/env.js';
import { conectarBaseDeDatos, desconectarBaseDeDatos } from '../src/config/database.js';

const { EJSON } = mongoose.mongo.BSON;

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Encuentra el archivo del respaldo, aunque la ruta que te pasaron sea
 * relativa a la raiz del proyecto.
 *
 * El detalle molesto: `npm run restaurar --workspace server` corre con la
 * carpeta `server/` como directorio actual. Entonces escribir la ruta natural
 *     server/respaldos/algo.ejson
 * se resuelve como `server/server/respaldos/algo.ejson` y el error que sale
 * ("no such file") no da ninguna pista de por que. Probamos las dos.
 */
function ubicarArchivo(ruta) {
  if (existsSync(ruta)) return ruta;

  const desdeLaRaiz = path.resolve(RAIZ, ruta);
  if (existsSync(desdeLaRaiz)) return desdeLaRaiz;

  console.error(`\nNo encontre el respaldo. Probe en:`);
  console.error(`  ${path.resolve(ruta)}`);
  console.error(`  ${desdeLaRaiz}`);
  console.error('\nLos respaldos quedan en server/respaldos/. Para ver los que hay:');
  console.error('  ls server/respaldos\n');
  process.exit(1);
}

function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(texto, (r) => {
      rl.close();
      resolve(r.trim());
    }),
  );
}

async function main() {
  const archivo = process.argv[2];

  if (!archivo) {
    console.error('\nFalta el archivo del respaldo.');
    console.error('  npm run restaurar --workspace server -- server/respaldos/ARCHIVO.ejson\n');
    process.exit(1);
  }

  const ruta = ubicarArchivo(archivo);
  const respaldo = EJSON.parse(readFileSync(ruta, 'utf8'));

  console.log('\n=== Restaurar — Ladrillera ===');
  console.log(`Respaldo: ${ruta}`);
  console.log(`  tomado de "${respaldo.base}" el ${respaldo.fecha}`);
  for (const [nombre, docs] of Object.entries(respaldo.colecciones)) {
    console.log(`  ${nombre}: ${docs.length}`);
  }

  console.log(`\nSe va a escribir en:`);
  console.log(`  ${env.mongodbUri.replace(/\/\/[^@]+@/, '//<usuario>:<clave>@')}`);

  await conectarBaseDeDatos();

  try {
    const db = mongoose.connection.db;
    const actuales = await db.listCollections().toArray();

    if (actuales.length) {
      console.log('\nESTO BORRA lo que hay ahora en esa base:');
      for (const { name } of actuales) {
        console.log(`  ${name}: ${await db.collection(name).countDocuments()} documentos`);
      }

      const respuesta = await preguntar('\nEscribi BORRAR para continuar: ');
      if (respuesta !== 'BORRAR') {
        console.log('Cancelado. No se toco nada.');
        return;
      }

      for (const { name } of actuales) {
        await db.collection(name).drop();
      }
    }

    let total = 0;
    for (const [nombre, docs] of Object.entries(respaldo.colecciones)) {
      if (!docs.length) continue;
      await db.collection(nombre).insertMany(docs);
      total += docs.length;
      console.log(`  ${nombre}: ${docs.length} restaurados`);
    }

    console.log(`\nListo: ${total} documentos.`);
    console.log('\nOJO: los indices los vuelve a crear Mongoose cuando arranque');
    console.log('el servidor, no este script. Arranca la app una vez.');
  } finally {
    await desconectarBaseDeDatos();
  }
}

main().catch((error) => {
  console.error('\nError:', error.message);
  process.exit(1);
});
