#!/usr/bin/env node
// -----------------------------------------------------------------------------
// crear-usuario.js — Crea (o actualiza) el usuario dueno
// -----------------------------------------------------------------------------
// El plan dice que hay UN SOLO usuario y que NO existe pantalla de registro
// (seccion 4.1). Tiene sentido: si hubiera una, cualquiera que entre a la web
// podria crearse una cuenta y ver la plata de la fabrica.
//
// Entonces el usuario se crea desde la consola, una sola vez:
//
//   npm run crear-usuario --workspace server
//
// Te pregunta usuario y contrasena (la contrasena no se ve mientras la
// escribis). Tambien acepta variables de entorno, util para automatizar:
//
//   ADMIN_USER=dueno ADMIN_PASSWORD=miClave123 npm run crear-usuario --workspace server
//
// Si el usuario ya existe, pregunta si queres cambiarle la contrasena.
// -----------------------------------------------------------------------------

import readline from 'node:readline';
import { env } from '../src/config/env.js';
import { conectarBaseDeDatos, desconectarBaseDeDatos } from '../src/config/database.js';
import { User } from '../src/models/User.js';

const LARGO_MINIMO_PASSWORD = 8;

/** Pregunta algo y espera la respuesta. */
function preguntar(rl, texto) {
  return new Promise((resolve) => rl.question(texto, (respuesta) => resolve(respuesta.trim())));
}

/**
 * Pregunta una contrasena SIN mostrarla en pantalla.
 * El truco: mientras se escribe, interceptamos lo que readline iba a imprimir
 * y no imprimimos nada. Es lo mismo que hace `sudo` en Linux.
 */
function preguntarPassword(rl, texto) {
  return new Promise((resolve) => {
    const alEscribir = (char) => {
      // Enter / Ctrl+C: dejamos que readline siga su curso normal.
      if (['\n', '\r', '\u0004'].includes(char)) {
        process.stdin.removeListener('data', alEscribir);
        return;
      }
      // Borramos la linea y la volvemos a escribir sin el texto tipeado.
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(texto);
    };

    process.stdin.on('data', alEscribir);

    rl.question(texto, (respuesta) => {
      process.stdin.removeListener('data', alEscribir);
      process.stdout.write('\n');
      resolve(respuesta.trim());
    });
  });
}

async function main() {
  console.log('\n=== Crear usuario dueno — Ladrillera ===');
  console.log(`Base de datos: ${env.mongodbUri.replace(/\/\/[^@]+@/, '//<usuario>:<clave>@')}\n`);

  await conectarBaseDeDatos();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    // 1) Usuario
    let username = process.env.ADMIN_USER?.trim();
    if (!username) {
      username = await preguntar(rl, 'Usuario: ');
    }
    username = username.toLowerCase();

    if (username.length < 3) {
      console.error('\nEl usuario debe tener al menos 3 caracteres.');
      process.exitCode = 1;
      return;
    }

    // 2) Contrasena
    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      password = await preguntarPassword(rl, 'Contrasena: ');
      const repetida = await preguntarPassword(rl, 'Repetir contrasena: ');
      if (password !== repetida) {
        console.error('\nLas contrasenas no coinciden. No se creo nada.');
        process.exitCode = 1;
        return;
      }
    }

    if (!password || password.length < LARGO_MINIMO_PASSWORD) {
      console.error(`\nLa contrasena debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`);
      process.exitCode = 1;
      return;
    }

    // 3) Crear o actualizar
    const existente = await User.findOne({ username });

    if (existente) {
      const respuesta =
        process.env.ADMIN_PASSWORD !== undefined
          ? 's'
          : (await preguntar(rl, `\nEl usuario "${username}" ya existe. Cambiar su contrasena? (s/N): `)).toLowerCase();

      if (respuesta !== 's' && respuesta !== 'si') {
        console.log('No se cambio nada.');
        return;
      }

      existente.passwordHash = await User.hashearPassword(password);
      await existente.save();
      console.log(`\nListo: se actualizo la contrasena de "${username}".`);
      return;
    }

    const cuantos = await User.countDocuments();
    if (cuantos > 0) {
      console.warn(`\nAviso: ya hay ${cuantos} usuario(s) en la base. El plan preve uno solo.`);
    }

    await User.create({
      username,
      passwordHash: await User.hashearPassword(password),
    });

    console.log(`\nListo: usuario "${username}" creado.`);
    console.log('Ya podes iniciar sesion en la app.');
  } finally {
    rl.close();
    await desconectarBaseDeDatos();
  }
}

main().catch((error) => {
  console.error('\nError:', error.message);
  process.exit(1);
});
