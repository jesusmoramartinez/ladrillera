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

// 5) Las rutas de la API, todas bajo /api.
app.use('/api', apiRoutes);

// 6) Si nada coincidio, 404 en JSON.
app.use(notFoundHandler);

// 7) Ultimo de la fila: el manejador de errores.
app.use(errorHandler);

export default app;
