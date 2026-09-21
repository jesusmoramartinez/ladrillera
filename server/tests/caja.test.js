// -----------------------------------------------------------------------------
// caja.test.js — Balance del mes, categorias y listas de precio
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../src/app.js';
import { Category } from '../src/models/Category.js';
import { User } from '../src/models/User.js';
import { sembrar } from '../src/services/seed.service.js';

const USUARIO = 'dueno';
const PASSWORD = 'claveDePrueba123';

let token;

beforeEach(async () => {
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

async function idCategoria(nombre) {
  const categoria = await Category.findOne({ nombre });
  return String(categoria._id);
}

// ---------------------------------------------------------------------------

describe('Datos iniciales (seed)', () => {
  it('crea las 4 categorias de sistema y las 5 del dueno', async () => {
    const res = await conSesion('get', '/api/categories');

    const sistema = res.body.categorias.filter((c) => c.sistema);
    const propias = res.body.categorias.filter((c) => !c.sistema);

    expect(sistema.map((c) => c.clave).sort()).toEqual([
      'adelanto',
      'compra_material',
      'sueldos',
      'venta',
    ]);
    expect(propias).toHaveLength(5);
  });

  it('crea las listas de precio con una sola predeterminada', async () => {
    const res = await conSesion('get', '/api/price-lists');

    expect(res.body.listas).toHaveLength(3);
    const predeterminadas = res.body.listas.filter((l) => l.predeterminada);
    expect(predeterminadas).toHaveLength(1);
    expect(predeterminadas[0].nombre).toBe('Normal');
  });

  it('se puede correr dos veces sin duplicar nada (idempotente)', async () => {
    await sembrar({ silencioso: true });
    await sembrar({ silencioso: true });

    const categorias = (await conSesion('get', '/api/categories')).body.categorias;
    const listas = (await conSesion('get', '/api/price-lists')).body.listas;

    expect(categorias).toHaveLength(9);
    expect(listas).toHaveLength(3);
  });

  it('no pisa lo que el dueno haya cambiado', async () => {
    const id = await idCategoria('Combustible');
    await conSesion('patch', `/api/categories/${id}`).send({ nombre: 'Nafta' });

    await sembrar({ silencioso: true });

    const categorias = (await conSesion('get', '/api/categories')).body.categorias;
    expect(categorias.some((c) => c.nombre === 'Nafta')).toBe(true);
  });

  it('crea la configuracion con los valores del plan', async () => {
    const res = await conSesion('get', '/api/settings');

    expect(res.body.config.ladrillosPorCamion).toBe(25_000);
    expect(res.body.config.umbralAlertaArcilla).toBe(25_000);
    expect(res.body.config.configuracionInicialHecha).toBe(false);
  });
});

describe('POST /api/transactions/egreso — gasto manual', () => {
  it('registra un gasto y lo suma al balance del mes', async () => {
    const res = await conSesion('post', '/api/transactions/egreso').send({
      categoriaId: await idCategoria('Combustible'),
      monto: 250_000,
      fecha: '2026-09-15',
      descripcion: 'Gasoil para el tractor',
    });

    expect(res.status).toBe(201);
    expect(res.body.movimiento.categoriaNombre).toBe('Combustible');

    const caja = (await conSesion('get', '/api/transactions?mes=2026-09')).body;
    expect(caja.balance.egresos).toBe(250_000);
    expect(caja.balance.resultado).toBe(-250_000);
  });

  it('NO deja usar una categoria de sistema', async () => {
    const res = await conSesion('post', '/api/transactions/egreso').send({
      categoriaId: await idCategoria('Sueldos'),
      monto: 100_000,
      fecha: '2026-09-15',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sistema/i);
  });

  it('NO deja usar una categoria de ingreso para un egreso', async () => {
    const res = await conSesion('post', '/api/transactions/egreso').send({
      categoriaId: await idCategoria('Venta'),
      monto: 100_000,
      fecha: '2026-09-15',
    });
    expect(res.status).toBe(400);
  });

  it('rechaza montos con decimales o en cero', async () => {
    const categoriaId = await idCategoria('Flete');
    const base = { categoriaId, fecha: '2026-09-15' };

    expect((await conSesion('post', '/api/transactions/egreso').send({ ...base, monto: 1.5 })).status).toBe(400);
    expect((await conSesion('post', '/api/transactions/egreso').send({ ...base, monto: 0 })).status).toBe(400);
    expect((await conSesion('post', '/api/transactions/egreso').send({ ...base, monto: -10 })).status).toBe(400);
  });
});

describe('Balance del mes (plan, seccion 1)', () => {
  it('separa los meses: solo cuenta lo del mes pedido', async () => {
    const categoriaId = await idCategoria('Flete');

    await conSesion('post', '/api/transactions/egreso').send({
      categoriaId, monto: 100_000, fecha: '2026-08-31',
    });
    await conSesion('post', '/api/transactions/egreso').send({
      categoriaId, monto: 200_000, fecha: '2026-09-01',
    });
    await conSesion('post', '/api/transactions/egreso').send({
      categoriaId, monto: 300_000, fecha: '2026-09-30',
    });
    await conSesion('post', '/api/transactions/egreso').send({
      categoriaId, monto: 400_000, fecha: '2026-10-01',
    });

    const septiembre = (await conSesion('get', '/api/transactions?mes=2026-09')).body;
    expect(septiembre.movimientos).toHaveLength(2);
    expect(septiembre.balance.egresos).toBe(500_000);

    const agosto = (await conSesion('get', '/api/transactions?mes=2026-08')).body;
    expect(agosto.balance.egresos).toBe(100_000);
  });

  it('rechaza un mes con formato invalido', async () => {
    expect((await conSesion('get', '/api/transactions?mes=septiembre')).status).toBe(400);
    expect((await conSesion('get', '/api/transactions?mes=2026-9')).status).toBe(400);
  });

  it('sin mes usa el mes en curso', async () => {
    const res = await conSesion('get', '/api/transactions');
    expect(res.status).toBe(200);
    expect(res.body.mes).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('DELETE /api/transactions/:id', () => {
  it('anula un gasto manual y lo saca del balance', async () => {
    const creado = await conSesion('post', '/api/transactions/egreso').send({
      categoriaId: await idCategoria('Herramientas'),
      monto: 500_000,
      fecha: '2026-09-10',
    });

    const res = await conSesion('delete', `/api/transactions/${creado.body.movimiento.id}`);
    expect(res.status).toBe(200);

    const caja = (await conSesion('get', '/api/transactions?mes=2026-09')).body;
    expect(caja.balance.egresos).toBe(0);
  });

  it('NO deja anular un movimiento generado por una compra', async () => {
    await conSesion('post', '/api/inventory/compras').send({
      material: 'lena', cantidad: 5, monto: 800_000, fecha: '2026-09-10',
    });

    const caja = (await conSesion('get', '/api/transactions?mes=2026-09')).body;
    const egresoDeCompra = caja.movimientos[0];

    const res = await conSesion('delete', `/api/transactions/${egresoDeCompra.id}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/otra operacion/i);
  });
});

describe('Categorias', () => {
  it('el dueno puede crear una nueva', async () => {
    const res = await conSesion('post', '/api/categories').send({
      nombre: 'Reparaciones',
      tipo: 'egreso',
    });

    expect(res.status).toBe(201);
    expect(res.body.categoria.sistema).toBe(false);
    expect(res.body.categoria.clave).toBe(null);
  });

  it('no deja crear una repetida, aunque cambie las mayusculas', async () => {
    await conSesion('post', '/api/categories').send({ nombre: 'Reparaciones', tipo: 'egreso' });
    const res = await conSesion('post', '/api/categories').send({ nombre: 'REPARACIONES', tipo: 'egreso' });
    expect(res.status).toBe(409);
  });

  it('acepta nombres con parentesis (la busqueda escapa la regex)', async () => {
    const res = await conSesion('post', '/api/categories').send({
      nombre: 'Gastos (varios)',
      tipo: 'egreso',
    });
    expect(res.status).toBe(201);
  });

  it('NO deja renombrar ni borrar una de sistema', async () => {
    const id = await idCategoria('Sueldos');

    expect((await conSesion('patch', `/api/categories/${id}`).send({ nombre: 'X' })).status).toBe(400);
    expect((await conSesion('delete', `/api/categories/${id}`)).status).toBe(400);
  });

  it('NO deja cambiar de egreso a ingreso', async () => {
    const id = await idCategoria('Flete');
    const res = await conSesion('patch', `/api/categories/${id}`).send({ tipo: 'ingreso' });
    expect(res.status).toBe(400);
  });

  it('al desactivar una categoria, los gastos viejos conservan su nombre', async () => {
    const id = await idCategoria('Mantenimiento');

    await conSesion('post', '/api/transactions/egreso').send({
      categoriaId: id, monto: 150_000, fecha: '2026-09-05',
    });
    await conSesion('delete', `/api/categories/${id}`);

    // La categoria ya no se puede elegir...
    const categorias = (await conSesion('get', '/api/categories')).body.categorias;
    expect(categorias.some((c) => c.nombre === 'Mantenimiento')).toBe(false);

    // ...pero el gasto sigue diciendo de que era. Eso es el snapshot.
    const caja = (await conSesion('get', '/api/transactions?mes=2026-09')).body;
    expect(caja.movimientos[0].categoriaNombre).toBe('Mantenimiento');
  });

  it('con ?elegibles=true no devuelve las de sistema', async () => {
    const res = await conSesion('get', '/api/categories?elegibles=true&tipo=egreso');
    expect(res.body.categorias.every((c) => !c.sistema)).toBe(true);
    expect(res.body.categorias).toHaveLength(5);
  });
});

describe('Listas de precio', () => {
  it('cambiar la predeterminada desmarca la anterior', async () => {
    const listas = (await conSesion('get', '/api/price-lists')).body.listas;
    const mayorista = listas.find((l) => l.nombre === 'Mayorista');

    await conSesion('patch', `/api/price-lists/${mayorista.id}`).send({ predeterminada: true });

    const despues = (await conSesion('get', '/api/price-lists')).body.listas;
    const predeterminadas = despues.filter((l) => l.predeterminada);
    expect(predeterminadas).toHaveLength(1);
    expect(predeterminadas[0].nombre).toBe('Mayorista');
  });

  it('NO deja desmarcar la predeterminada sin elegir otra', async () => {
    const listas = (await conSesion('get', '/api/price-lists')).body.listas;
    const normal = listas.find((l) => l.nombre === 'Normal');

    const res = await conSesion('patch', `/api/price-lists/${normal.id}`).send({
      predeterminada: false,
    });
    expect(res.status).toBe(400);
  });

  it('NO deja desactivar la predeterminada', async () => {
    const listas = (await conSesion('get', '/api/price-lists')).body.listas;
    const normal = listas.find((l) => l.nombre === 'Normal');

    const res = await conSesion('delete', `/api/price-lists/${normal.id}`);
    expect(res.status).toBe(400);
  });

  it('si deja de haber listas, la primera nueva es la predeterminada', async () => {
    const { PriceList } = await import('../src/models/PriceList.js');
    await PriceList.deleteMany({});

    const res = await conSesion('post', '/api/price-lists').send({
      nombre: 'Unica',
      precioPorMil: 950_000,
    });

    expect(res.body.lista.predeterminada).toBe(true);
  });

  it('rechaza un precio con decimales', async () => {
    const res = await conSesion('post', '/api/price-lists').send({
      nombre: 'Rara',
      precioPorMil: 900_000.5,
    });
    expect(res.status).toBe(400);
  });
});

describe('Configuracion', () => {
  it('se puede cambiar el umbral de la alerta', async () => {
    const res = await conSesion('patch', '/api/settings').send({ umbralAlertaArcilla: 50_000 });

    expect(res.status).toBe(200);
    expect(res.body.config.umbralAlertaArcilla).toBe(50_000);

    // Y la alerta pasa a usar el valor nuevo.
    await conSesion('post', '/api/inventory/compras').send({
      material: 'arcilla_pura', cantidad: 1, monto: 1_000_000, fecha: '2026-09-10',
    });
    await conSesion('post', '/api/inventory/compras').send({
      material: 'arcilla_floja', cantidad: 1, monto: 1_000_000, fecha: '2026-09-10',
    });

    const stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.alertaArcilla.disponible).toBe(25_000);
    expect(stock.alertaArcilla.alerta).toBe(true); // 25.000 < 50.000
  });

  it('rechaza un PATCH vacio', async () => {
    expect((await conSesion('patch', '/api/settings').send({})).status).toBe(400);
  });

  it('cambiar la unidad de lena se refleja en el stock', async () => {
    await conSesion('patch', '/api/settings').send({ unidadLena: 'camion' });

    const stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.lena.unidad).toBe('camion');
  });
});
