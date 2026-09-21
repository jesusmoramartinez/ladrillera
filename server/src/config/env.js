// -----------------------------------------------------------------------------
// env.js — Lee la configuracion secreta desde el archivo .env
// -----------------------------------------------------------------------------
// El archivo .env NO se sube a Git (esta en .gitignore). Guarda cosas como la
// clave de la base de datos. Este modulo lo lee UNA sola vez, valida que este
// todo lo obligatorio y exporta un objeto `env` que usa el resto del programa.
//
// Por que asi y no usar `process.env.MONGODB_URI` en cada archivo:
//   1. Si falta una variable, el programa avisa AL ARRANCAR con un mensaje
//      claro, en vez de romperse media hora despues con un error raro.
//   2. Hay un unico lugar donde ver toda la configuracion que necesita la app.
// -----------------------------------------------------------------------------

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// En modulos ES (`import`/`export`) no existe la variable magica __dirname que
// hay en CommonJS, asi que la calculamos: import.meta.url es la URL de ESTE
// archivo; la convertimos a ruta y le sacamos el nombre del archivo.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// server/src/config/env.js  ->  subimos tres niveles  ->  server/.env
// Lo hacemos con ruta absoluta para que funcione sin importar desde que carpeta
// se ejecute `node`.
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

/**
 * Devuelve una variable de entorno obligatoria o corta el arranque.
 * @param {string} nombre
 */
function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor || valor.trim() === '') {
    console.error(`\n[config] Falta la variable de entorno ${nombre}.`);
    console.error('[config] Copia server/.env.example a server/.env y completalo.\n');
    process.exit(1); // codigo distinto de 0 = "termine mal"
  }
  return valor.trim();
}

/**
 * Devuelve una variable opcional; si no esta, usa el valor por defecto.
 * @param {string} nombre
 * @param {string} porDefecto
 */
function opcional(nombre, porDefecto) {
  const valor = process.env[nombre];
  return valor && valor.trim() !== '' ? valor.trim() : porDefecto;
}

export const env = {
  // 'development' mientras programamos, 'production' cuando este publicado,
  // 'test' cuando corren los tests automaticos.
  nodeEnv: opcional('NODE_ENV', 'development'),

  // Puerto donde escucha la API. 4000 para no chocar con Vite (5173).
  port: Number(opcional('PORT', '4000')),

  // Direccion de la base de datos (MongoDB Atlas o un Mongo local).
  mongodbUri: requerida('MONGODB_URI'),

  // Desde que direccion del navegador se permite llamar a la API (ver cors).
  corsOrigin: opcional('CORS_ORIGIN', 'http://localhost:5173'),

  // Zona horaria del negocio. Las fechas de negocio se guardan como texto
  // "YYYY-MM-DD" en hora de Paraguay (plan, punto 5.4).
  timezone: opcional('TZ_NEGOCIO', 'America/Asuncion'),

  // Clave con la que el servidor FIRMA los tokens de login. Si cambia, todos
  // los tokens ya entregados dejan de valer (util si sospechas una filtracion).
  jwtSecret: requerida('JWT_SECRET'),

  // Cuanto dura la sesion antes de tener que volver a entrar.
  // 30 dias: el dueno usa la app todos los dias desde su propio celular.
  jwtExpiresIn: opcional('JWT_EXPIRES_IN', '30d'),
};

// Atajos comodos para escribir `if (env.isDev)` en vez de comparar textos.
env.isDev = env.nodeEnv === 'development';
env.isProd = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';
