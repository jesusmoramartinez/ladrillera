// -----------------------------------------------------------------------------
// health.controller.js — "Signos vitales" del servidor
// -----------------------------------------------------------------------------
// Un controlador recibe el pedido (req), decide que responder y responde (res).
// No hace cuentas de negocio: para eso estan services/ y logic/.
//
// Este endpoint sirve para tres cosas muy practicas:
//   1. Probar de una que la API arranco (abriendo la URL en el navegador).
//   2. Ver si la base de datos esta conectada, sin entrar a la base.
//   3. Cuando publiquemos, el hosting lo llama cada tanto para saber si la
//      aplicacion sigue viva ("health check").
// -----------------------------------------------------------------------------

import { estaConectada, estadoConexion } from '../config/database.js';
import { env } from '../config/env.js';

export function getHealth(req, res) {
  const baseOk = estaConectada();

  res.status(baseOk ? 200 : 503).json({
    ok: baseOk,
    servicio: 'api-ladrillera',
    entorno: env.nodeEnv,
    baseDeDatos: estadoConexion(),
    // Hace cuanto esta prendido el proceso, en segundos.
    uptimeSegundos: Math.round(process.uptime()),
    hora: new Date().toISOString(),
  });
}
