// -----------------------------------------------------------------------------
// health.test.js — Test del endpoint de salud y de las rutas inexistentes
// -----------------------------------------------------------------------------
// Vitest corre los tests; supertest le "pega" a la app de Express en memoria,
// sin abrir ningun puerto. Por eso app.js y server.js estan separados.
//
// Se corre con:  npm test
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('GET /api/health', () => {
  it('es publica: responde sin token', async () => {
    const res = await request(app).get('/api/health');

    // 200 si la base esta conectada, 503 si no. En los tests la base de prueba
    // esta levantada, asi que deberia ser 200.
    expect([200, 503]).toContain(res.status);
    expect(res.body.servicio).toBe('api-ladrillera');
    expect(res.body).toHaveProperty('baseDeDatos');
    expect(res.body).toHaveProperty('uptimeSegundos');
  });

  it('informa que la base de datos esta conectada', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.baseDeDatos).toBe('conectado');
    expect(res.status).toBe(200);
  });
});

describe('Rutas inexistentes', () => {
  it('fuera de /api devuelve 404 en formato JSON, no una pagina HTML', async () => {
    const res = await request(app).get('/esta-ruta-no-existe');

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('/esta-ruta-no-existe');
  });

  it('dentro de /api y sin token devuelve 401, no 404', async () => {
    // La barrera requireAuth de routes/index.js se ejecuta ANTES de llegar al
    // manejador de 404. Es a proposito: a alguien sin sesion no le decimos
    // que rutas existen y cuales no.
    const res = await request(app).get('/api/lo-que-sea');

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });
});
