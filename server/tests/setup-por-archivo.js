// -----------------------------------------------------------------------------
// setup-por-archivo.js — Prepara el entorno de CADA archivo de test
// -----------------------------------------------------------------------------
// Se ejecuta antes de que el archivo de test importe nada, asi que las
// variables de entorno ya estan puestas cuando config/env.js las lee.
// -----------------------------------------------------------------------------

import { afterAll, afterEach, beforeAll, inject } from 'vitest';
import mongoose from 'mongoose';

// El URI que dejo setup-global.js.
process.env.MONGODB_URI = inject('mongoUri');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secreto-solo-para-tests-no-usar-en-produccion';
process.env.JWT_EXPIRES_IN = '30d';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
});

// Entre test y test borramos todo. Asi cada test es INDEPENDIENTE: no importa
// el orden en que corran ni lo que haya hecho el anterior. Un test que pasa
// solo pero falla en grupo casi siempre es por falta de esta limpieza.
afterEach(async () => {
  const colecciones = mongoose.connection.collections;
  await Promise.all(Object.values(colecciones).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.close();
});
