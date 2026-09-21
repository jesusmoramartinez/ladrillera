// -----------------------------------------------------------------------------
// health.test.js — Primer test automatico
// -----------------------------------------------------------------------------
// Vitest corre los tests; supertest le "pega" a la app de Express en memoria,
// sin abrir un puerto ni necesitar la base de datos prendida.
// Por eso app.js y server.js estan separados.
//
// Se corre con:  npm test
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('GET /api/health', () => {
  it('responde con la informacion del servicio', async () => {
    const res = await request(app).get('/api/health');

    // 200 si la base esta conectada, 503 si no. En los tests no conectamos la
    // base, asi que lo que importa es que el endpoint conteste bien formado.
    expect([200, 503]).toContain(res.status);
    expect(res.body.servicio).toBe('api-ladrillera');
    expect(res.body).toHaveProperty('baseDeDatos');
    expect(res.body).toHaveProperty('uptimeSegundos');
  });
});

describe('Rutas inexistentes', () => {
  it('devuelve 404 en formato JSON, no una pagina HTML', async () => {
    const res = await request(app).get('/api/esta-ruta-no-existe');

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('/api/esta-ruta-no-existe');
  });
});
