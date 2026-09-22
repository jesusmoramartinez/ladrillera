// -----------------------------------------------------------------------------
// app.js — Arma la aplicacion Express (pero NO la prende)
// -----------------------------------------------------------------------------
// Separar "armar la app" de "prenderla" (server.js) no es capricho:
//   - Los tests importan ESTE archivo y le pegan a las rutas sin abrir ningun
//     puerto ni conectarse a la base de verdad.
//   - server.js se ocupa de lo de afuera: base de datos, puerto, apagado.
//
// El orden de los middlewares importa: Express los ejecuta de arriba hacia
// abajo, como una fila de filtros por la que pasa cada pedido.
// -----------------------------------------------------------------------------

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { env } from './config/env.js';
import { conectarBaseDeDatos } from './config/database.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

// 1) CORS: por seguridad, el navegador bloquea que una pagina llame a otro
//    dominio salvo que ese dominio lo autorice. Aca autorizamos al frontend.
app.use(cors({ origin: env.corsOrigin, credentials: true }));

// 2) Lector de JSON: convierte el cuerpo del pedido (texto JSON) en un objeto
//    JavaScript disponible en `req.body`. Sin esto, req.body llega vacio.
app.use(express.json({ limit: '1mb' }));

// 3) Lector de formularios clasicos (por si alguna vez hace falta).
app.use(express.urlencoded({ extended: true }));

// 4) Registro de pedidos en consola: te muestra cada llamada que entra.
//    En los tests lo apagamos para no ensuciar la salida.
if (!env.isTest) {
  app.use(morgan(env.isProd ? 'combined' : 'dev'));
}

// 4.5) Conexión a MongoDB, pedido por pedido (hosting serverless / Vercel)
//
// En un servidor de toda la vida la base se conecta UNA vez al arrancar
// (server.js) y queda conectada. En Vercel no hay tal cosa: cada pedido puede
// caer en un proceso recién creado que todavía no se conectó a nada. Por eso
// se asegura la conexión acá, antes de las rutas.
//
// No es lento: conectarBaseDeDatos() reutiliza la conexión abierta si ya la
// hay (ver config/database.js). Solo el primer pedido de cada proceso espera.
app.use(async (req, res, next) => {
  try {
    await conectarBaseDeDatos();
    next();
  } catch (error) {
    console.error('[mongo] Error de conexión desde middleware:', error);

    // /api/health es la excepción: su TRABAJO es contar cómo está la base.
    // Si la cortáramos acá, el único endpoint que sirve para diagnosticar
    // "se cayó Mongo" respondería un 500 genérico, que es justo lo que no
    // ayuda cuando algo anda mal en producción. Lo dejamos pasar para que
    // conteste 503 diciendo qué pasa.
    if (req.path === '/api/health' || req.path === '/api/health/') return next();

    res.status(503).json({
      ok: false,
      error: 'No se pudo conectar con la base de datos. Reintenta en unos segundos.',
    });
  }
});

// 5) Las rutas de la API, todas bajo /api.
app.use('/api', apiRoutes);

// 6) Si nada coincidio, 404 en JSON.
app.use(notFoundHandler);

// 7) Ultimo de la fila: el manejador de errores.
app.use(errorHandler);

export default app;