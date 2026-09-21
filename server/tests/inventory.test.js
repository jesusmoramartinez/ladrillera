// -----------------------------------------------------------------------------
// inventory.test.js — Stock, compras y el "todo o nada"
// -----------------------------------------------------------------------------
// Criterio de la fase 4 en el plan: "Registrar una compra suma stock y aparece
// el egreso en caja". Eso es lo primero que se verifica acá.
//
// Estos tests corren contra un MongoDB de verdad levantado como replica set,
// que es lo que permite probar transacciones reales (ver tests/setup-global.js).
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../src/app.js';
import { Inventory } from '../src/models/Inventory.js';
import { InventoryMovement } from '../src/models/InventoryMovement.js';
import { Transaction } from '../src/models/Transaction.js';
import { User } from '../src/models/User.js';
import { sembrar } from '../src/services/seed.service.js';

const USUARIO = 'dueno';
const PASSWORD = 'claveDePrueba123';
const HOY = '2026-09-21';

let token;

beforeEach(async () => {
  // La base se vacia entre test y test, asi que hay que volver a sembrar.
  await sembrar({ silencioso: true });

  await User.create({
    username: USUARIO,
    passwordHash: await User.hashearPassword(PASSWORD),
  });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: USUARIO, password: PASSWORD });
  token = res.body.token;
});

function conSesion(metodo, ruta) {
  return request(app)[metodo](ruta).set('Authorization', `Bearer ${token}`);
}

function comprar(datos = {}) {
  return conSesion('post', '/api/inventory/compras').send({
    material: 'arcilla_pura',
    cantidad: 2, // camiones
    monto: 3_000_000,
    fecha: HOY,
    ...datos,
  });
}

describe('Proteccion del modulo', () => {
  it('sin token no se puede ver el stock', async () => {
    expect((await request(app).get('/api/inventory')).status).toBe(401);
  });

  it('sin token no se puede comprar', async () => {
    const res = await request(app).post('/api/inventory/compras').send({ material: 'lena' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/inventory', () => {
  it('arranca todo en cero', async () => {
    const res = await conSesion('get', '/api/inventory');

    expect(res.status).toBe(200);
    expect(res.body.stock.arcilla_pura.cantidad).toBe(0);
    expect(res.body.stock.arcilla_pura.camiones).toBe(0);
    expect(res.body.stock.ladrillos.fisico).toBe(0);
    expect(res.body.stock.lena.unidad).toBe('carga');
  });

  it('avisa la alerta roja de arcilla cuando falta (plan 5.5)', async () => {
    const res = await conSesion('get', '/api/inventory');

    // Con 0 de cada una, 0 < 25.000: alerta.
    expect(res.body.stock.alertaArcilla.alerta).toBe(true);
    expect(res.body.stock.alertaArcilla.disponible).toBe(0);
    expect(res.body.stock.alertaArcilla.faltante).toEqual(['arcilla_pura', 'arcilla_floja']);
  });

  it('la alerta se apaga cuando hay suficiente de las DOS arcillas', async () => {
    await comprar({ material: 'arcilla_pura', cantidad: 2 });
    let res = await conSesion('get', '/api/inventory');
    // Todavia falta la floja: el minimo manda.
    expect(res.body.stock.alertaArcilla.alerta).toBe(true);
    expect(res.body.stock.alertaArcilla.faltante).toEqual(['arcilla_floja']);

    await comprar({ material: 'arcilla_floja', cantidad: 2 });
    res = await conSesion('get', '/api/inventory');
    expect(res.body.stock.alertaArcilla.alerta).toBe(false);
    expect(res.body.stock.alertaArcilla.disponible).toBe(50_000);
  });
});

describe('POST /api/inventory/compras — el criterio de la fase', () => {
  it('suma el stock Y crea el egreso en caja', async () => {
    const res = await comprar({ cantidad: 2, monto: 3_000_000 });
    expect(res.status).toBe(201);

    // 1) El stock subio, en ladrillos-equivalentes (2 x 25.000).
    const stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.arcilla_pura.cantidad).toBe(50_000);
    expect(stock.arcilla_pura.camiones).toBe(2);

    // 2) El egreso aparece en la caja del mes, con la categoria de sistema.
    const caja = (await conSesion('get', '/api/transactions?mes=2026-09')).body;
    expect(caja.movimientos).toHaveLength(1);
    expect(caja.movimientos[0].tipo).toBe('egreso');
    expect(caja.movimientos[0].monto).toBe(3_000_000);
    expect(caja.movimientos[0].categoriaNombre).toBe('Compra de material');
    expect(caja.balance.egresos).toBe(3_000_000);
    expect(caja.balance.resultado).toBe(-3_000_000);

    // 3) Quedo la linea en el historial de stock.
    const movimientos = (await conSesion('get', '/api/inventory/movimientos')).body.movimientos;
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0].motivo).toBe('compra');
    expect(movimientos[0].cantidad).toBe(50_000);
  });

  it('convierte camiones fraccionarios a enteros (plan 5.2)', async () => {
    await comprar({ cantidad: 1.5, monto: 2_000_000 });

    const stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.arcilla_pura.cantidad).toBe(37_500);
    expect(Number.isInteger(stock.arcilla_pura.cantidad)).toBe(true);
    expect(stock.arcilla_pura.camiones).toBe(1.5);
  });

  it('la lena se compra en su propia unidad, sin convertir', async () => {
    await comprar({ material: 'lena', cantidad: 3, monto: 500_000 });

    const stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.lena.cantidad).toBe(3);
  });

  it('no deja comprar ladrillos: se producen', async () => {
    const res = await comprar({ material: 'ladrillos' });
    expect(res.status).toBe(400);
  });

  it('rechaza monto con decimales o cantidad negativa', async () => {
    expect((await comprar({ monto: 1000.5 })).status).toBe(400);
    expect((await comprar({ cantidad: -1 })).status).toBe(400);
    expect((await comprar({ monto: 0 })).status).toBe(400);
  });

  it('rechaza una fecha con formato invalido', async () => {
    expect((await comprar({ fecha: '21/09/2026' })).status).toBe(400);
  });
});

describe('Anular una compra — reversion exacta (plan 5.11)', () => {
  it('devuelve el stock y anula el egreso, sin borrar nada', async () => {
    const compra = await comprar({ cantidad: 2, monto: 3_000_000 });
    const movimientoId = compra.body.movimiento.id;

    const res = await conSesion('delete', `/api/inventory/compras/${movimientoId}`);
    expect(res.status).toBe(200);

    // El stock volvio a cero.
    const stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.arcilla_pura.cantidad).toBe(0);

    // La caja no muestra el egreso...
    const caja = (await conSesion('get', '/api/transactions?mes=2026-09')).body;
    expect(caja.movimientos).toHaveLength(0);
    expect(caja.balance.egresos).toBe(0);

    // ...pero el documento SIGUE en la base, marcado con deletedAt.
    const enLaBase = await Transaction.find({});
    expect(enLaBase).toHaveLength(1);
    expect(enLaBase[0].deletedAt).toBeInstanceOf(Date);

    // Y el historial de stock cuenta las DOS cosas: la compra y su anulacion.
    const movimientos = await InventoryMovement.find({}).sort({ createdAt: 1 });
    expect(movimientos).toHaveLength(2);
    expect(movimientos[0].motivo).toBe('compra');
    expect(movimientos[0].cantidad).toBe(50_000);
    expect(movimientos[1].motivo).toBe('anulacion');
    expect(movimientos[1].cantidad).toBe(-50_000);
  });

  it('no se puede anular dos veces', async () => {
    const compra = await comprar();
    const id = compra.body.movimiento.id;

    expect((await conSesion('delete', `/api/inventory/compras/${id}`)).status).toBe(200);
    expect((await conSesion('delete', `/api/inventory/compras/${id}`)).status).toBe(409);
  });

  it('solo se anulan movimientos de compra', async () => {
    await comprar({ material: 'lena', cantidad: 5, monto: 100_000 });
    const uso = await conSesion('post', '/api/inventory/uso-lena').send({
      cantidad: 2,
      fecha: HOY,
    });

    const res = await conSesion('delete', `/api/inventory/compras/${uso.body.movimiento.id}`);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/inventory/uso-lena (plan 5.6b)', () => {
  it('resta del stock y NO toca la caja', async () => {
    await comprar({ material: 'lena', cantidad: 10, monto: 1_000_000 });

    const res = await conSesion('post', '/api/inventory/uso-lena').send({
      cantidad: 3,
      fecha: HOY,
    });
    expect(res.status).toBe(201);

    const stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.lena.cantidad).toBe(7);

    // La plata salio al comprar, no al usar: sigue habiendo un solo egreso.
    const caja = (await conSesion('get', '/api/transactions?mes=2026-09')).body;
    expect(caja.movimientos).toHaveLength(1);
  });

  it('deja el stock en negativo si se usa mas de lo que habia', async () => {
    // El plan (5.7) avisa pero no bloquea: el deposito manda sobre el sistema.
    const res = await conSesion('post', '/api/inventory/uso-lena').send({
      cantidad: 5,
      fecha: HOY,
    });
    expect(res.status).toBe(201);

    const stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.lena.cantidad).toBe(-5);
  });
});

describe('POST /api/inventory/ajustes', () => {
  it('el dueno dice CUANTO HAY y el sistema calcula la diferencia', async () => {
    await comprar({ cantidad: 4, monto: 6_000_000 }); // 100.000

    const res = await conSesion('post', '/api/inventory/ajustes').send({
      material: 'arcilla_pura',
      cantidadReal: 3, // en el patio hay 3 camiones, no 4
      fecha: HOY,
    });
    expect(res.status).toBe(201);
    expect(res.body.movimiento.cantidad).toBe(-25_000); // la diferencia

    const stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.arcilla_pura.camiones).toBe(3);
  });

  it('rechaza un ajuste que no cambia nada', async () => {
    const res = await conSesion('post', '/api/inventory/ajustes').send({
      material: 'lena',
      cantidadReal: 0,
      fecha: HOY,
    });
    expect(res.status).toBe(400);
  });

  it('permite ajustar a cero', async () => {
    await comprar({ material: 'lena', cantidad: 8, monto: 900_000 });

    const res = await conSesion('post', '/api/inventory/ajustes').send({
      material: 'lena',
      cantidadReal: 0,
      fecha: HOY,
    });
    expect(res.status).toBe(201);

    const stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.lena.cantidad).toBe(0);
  });
});

describe('Transaccion de Mongo: todo o nada', () => {
  it('si falla el egreso, el stock NO queda sumado', async () => {
    // Forzamos el fallo borrando la categoria de sistema que la compra
    // necesita. El servicio va a lanzar DESPUES de haber tocado el stock si
    // no hubiera transaccion.
    const { Category } = await import('../src/models/Category.js');
    await Category.deleteOne({ clave: 'compra_material' });

    const res = await comprar({ cantidad: 2, monto: 3_000_000 });
    expect(res.status).toBe(500);

    // Lo importante: no quedo NADA a medio hacer.
    const stock = await Inventory.findOne({ material: 'arcilla_pura' });
    expect(stock?.cantidad ?? 0).toBe(0);
    expect(await InventoryMovement.countDocuments()).toBe(0);
    expect(await Transaction.countDocuments()).toBe(0);
  });
});
