#!/usr/bin/env node
// -----------------------------------------------------------------------------
// respaldar.js — Guarda una copia de toda la base en un archivo
// -----------------------------------------------------------------------------
// POR QUE EXISTE ESTE SCRIPT
//
// MongoDB Atlas, en el plan gratuito (M0), NO hace respaldos. Ninguno. Si la
// base se borra, se corrompe o alguien anula algo que no debia, no hay a donde
// volver. Y a partir del piloto esta base tiene la plata y los sueldos de una
// fabrica de verdad.
//
//   npm run respaldar --workspace server
//
// Deja un archivo en server/respaldos/ con la fecha y la hora en el nombre.
// Esa carpeta esta en .gitignore: son datos reales del cliente, no van a Git.
//
// POR QUE NO USA mongodump
//
// mongodump es la herramienta oficial y es mejor, pero hay que instalarla
// aparte (MongoDB Database Tools). Un respaldo que depende de que te acuerdes
// de instalar algo es un respaldo que no se hace. Esto anda con el Node que ya
// tenes.
//
// POR QUE EJSON Y NO JSON COMUN
//
// JSON no sabe de ObjectId ni de Date: guardaria los identificadores como
// texto y las fechas como texto. Al restaurar, las relaciones entre
// colecciones quedarian rotas (una venta apuntando al texto "6ab1..." en vez
// de al ObjectId 6ab1...) y las consultas por fecha dejarian de funcionar.
//
// EJSON es "JSON extendido": el mismo texto legible, pero con los tipos
// anotados ({"$oid": "..."}, {"$date": "..."}). Va y vuelve sin perder nada.
// -----------------------------------------------------------------------------

import mongoose from 'mongoose';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from '../src/config/env.js';
import { conectarBaseDeDatos, desconectarBaseDeDatos } from '../src/config/database.js';

const { EJSON } = mongoose.mongo.BSON;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARPETA = path.resolve(__dirname, '../respaldos');

/** "2026-09-22_0130" — ordena solo alfabeticamente, que es lo que queremos. */
function sello() {
  const ahora = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}` +
    `_${p(ahora.getHours())}${p(ahora.getMinutes())}`
  );
}

async function main() {
  console.log('\n=== Respaldo — Ladrillera ===');
  // Tapamos usuario y clave por si alguien mira la pantalla o pega el log.
  console.log(`Base: ${env.mongodbUri.replace(/\/\/[^@]+@/, '//<usuario>:<clave>@')}\n`);

  await conectarBaseDeDatos();

  try {
    const db = mongoose.connection.db;
    const respaldo = {
      base: mongoose.connection.name,
      fecha: new Date().toISOString(),
      colecciones: {},
    };

    let total = 0;

    for (const { name } of await db.listCollections().toArray()) {
      const docs = await db.collection(name).find({}).toArray();
      respaldo.colecciones[name] = docs;
      total += docs.length;
      console.log(`  ${name}: ${docs.length}`);
    }

    if (total === 0) {
      console.log('\nLa base esta vacia: no hay nada que respaldar.');
      return;
    }

    mkdirSync(CARPETA, { recursive: true });
    const archivo = path.join(CARPETA, `${respaldo.base}_${sello()}.ejson`);
    writeFileSync(archivo, EJSON.stringify(respaldo, undefined, 2));

    console.log(`\nListo: ${total} documentos en`);
    console.log(`  ${archivo}`);
    console.log('\nGuardalo tambien FUERA de esta computadora (Drive, pendrive,');
    console.log('lo que sea). Un respaldo que vive en el mismo disco que se puede');
    console.log('quemar no es un respaldo.');
  } finally {
    await desconectarBaseDeDatos();
  }
}

main().catch((error) => {
  console.error('\nError:', error.message);
  process.exit(1);
});
