// -----------------------------------------------------------------------------
// auth.test.js — Tests del login y de las rutas protegidas
// -----------------------------------------------------------------------------
// El criterio de la fase 2 en el plan es: "Sin login no se accede a nada".
// Eso es exactamente lo que verifican estos tests.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../src/app.js';
import { User } from '../src/models/User.js';

const USUARIO = 'dueno';
const PASSWORD = 'claveDePrueba123';

// Antes de cada test creamos el usuario dueno. La base se vacia sola entre
// test y test (ver tests/setup-por-archivo.js).
beforeEach(async () => {
  await User.create({
    username: USUARIO,
    passwordHash: await User.hashearPassword(PASSWORD),
  });
});

async function loguearse(username = USUARIO, password = PASSWORD) {
  return request(app).post('/api/auth/login').send({ username, password });
}

describe('POST /api/auth/login', () => {
  it('devuelve un token cuando el usuario y la contrasena son correctos', async () => {
    const res = await loguearse();

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.usuario.username).toBe(USUARIO);

    // El token tiene que ser un JWT valido con el id del usuario adentro.
    const contenido = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(contenido.username).toBe(USUARIO);
    expect(contenido.sub).toBeTruthy();
  });

  it('acepta el usuario en mayusculas (se normaliza a minusculas)', async () => {
    const res = await loguearse('DUENO');
    expect(res.status).toBe(200);
  });

  it('rechaza una contrasena incorrecta', async () => {
    const res = await loguearse(USUARIO, 'claveEquivocada');
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('da el MISMO mensaje si el usuario no existe (no delata cuales existen)', async () => {
    const conClaveMala = await loguearse(USUARIO, 'claveEquivocada');
    const usuarioInexistente = await loguearse('noexiste', PASSWORD);

    expect(usuarioInexistente.status).toBe(401);
    expect(usuarioInexistente.body.error).toBe(conClaveMala.body.error);
  });

  it('rechaza el pedido si faltan datos, con detalle por campo', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'dueno' });

    expect(res.status).toBe(400);
    expect(res.body.detalles.some((d) => d.campo === 'password')).toBe(true);
  });

  it('nunca devuelve el hash de la contrasena', async () => {
    const res = await loguearse();
    expect(JSON.stringify(res.body)).not.toContain('$2b$');
    expect(res.body.usuario.passwordHash).toBeUndefined();
  });
});

describe('Rutas protegidas (requireAuth)', () => {
  it('sin token devuelve 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('con un token inventado devuelve 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer esto.no.es.un.token');
    expect(res.status).toBe(401);
  });

  it('con un token firmado con OTRO secreto devuelve 401', async () => {
    const falso = jwt.sign({ sub: '123', username: 'intruso' }, 'secreto-del-atacante');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${falso}`);
    expect(res.status).toBe(401);
  });

  it('con un token vencido devuelve 401 y lo avisa', async () => {
    const user = await User.findOne({ username: USUARIO });
    const vencido = jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, {
      expiresIn: '-1s', // ya vencido
    });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${vencido}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/vencio/i);
  });

  it('con un token de un usuario borrado devuelve 401', async () => {
    const { body } = await loguearse();
    await User.deleteMany({});

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(401);
  });

  it('con un token valido devuelve los datos del usuario', async () => {
    const { body } = await loguearse();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.usuario.username).toBe(USUARIO);
    expect(res.body.usuario.id).toBeTruthy();       // el _id se renombra a id
    expect(res.body.usuario._id).toBeUndefined();
    expect(res.body.usuario.passwordHash).toBeUndefined();
  });
});

describe('Rutas /api inexistentes', () => {
  it('con token valido devuelve 404 en JSON', async () => {
    const { body } = await loguearse();

    const res = await request(app)
      .get('/api/modulo-que-no-existe')
      .set('Authorization', `Bearer ${body.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('/api/modulo-que-no-existe');
  });
});

describe('POST /api/auth/cambiar-password', () => {
  it('cambia la contrasena y la vieja deja de funcionar', async () => {
    const { body } = await loguearse();

    const cambio = await request(app)
      .post('/api/auth/cambiar-password')
      .set('Authorization', `Bearer ${body.token}`)
      .send({ passwordActual: PASSWORD, passwordNueva: 'nuevaClaveSegura456' });

    expect(cambio.status).toBe(200);
    expect(cambio.body.token).toBeTruthy();

    expect((await loguearse(USUARIO, PASSWORD)).status).toBe(401);
    expect((await loguearse(USUARIO, 'nuevaClaveSegura456')).status).toBe(200);
  });

  it('rechaza si la contrasena actual esta mal', async () => {
    const { body } = await loguearse();

    const res = await request(app)
      .post('/api/auth/cambiar-password')
      .set('Authorization', `Bearer ${body.token}`)
      .send({ passwordActual: 'noEsLaMia', passwordNueva: 'nuevaClaveSegura456' });

    expect(res.status).toBe(401);
  });

  it('rechaza una contrasena nueva demasiado corta', async () => {
    const { body } = await loguearse();

    const res = await request(app)
      .post('/api/auth/cambiar-password')
      .set('Authorization', `Bearer ${body.token}`)
      .send({ passwordActual: PASSWORD, passwordNueva: '123' });

    expect(res.status).toBe(400);
  });
});

describe('Modelo User', () => {
  it('guarda la contrasena hasheada, nunca en texto plano', async () => {
    const user = await User.findOne({ username: USUARIO }).select('+passwordHash');

    expect(user.passwordHash).not.toBe(PASSWORD);
    expect(user.passwordHash.startsWith('$2b$')).toBe(true); // formato bcrypt
    expect(await user.verificarPassword(PASSWORD)).toBe(true);
    expect(await user.verificarPassword('otra')).toBe(false);
  });

  it('dos usuarios con la MISMA contrasena tienen hashes distintos (salt)', async () => {
    const hashA = await User.hashearPassword('mismaClave123');
    const hashB = await User.hashearPassword('mismaClave123');
    expect(hashA).not.toBe(hashB);
  });

  it('no deja crear dos usuarios con el mismo nombre', async () => {
    await User.init(); // asegura que el indice unico este creado
    await expect(
      User.create({ username: USUARIO, passwordHash: 'loquesea' }),
    ).rejects.toThrow();
  });
});
