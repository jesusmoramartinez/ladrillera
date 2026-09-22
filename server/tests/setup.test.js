// -----------------------------------------------------------------------------
// setup.test.js — El asistente de configuracion inicial (fase 10)
// -----------------------------------------------------------------------------
// Criterio de la fase 10 en el plan: "El dueno instala la app, carga su stock
// y empleados solo". El primer test es exactamente eso, de punta a punta.
//
// Los demas cubren las tres cosas que pueden salir caras el dia de la entrega:
//   - que se pueda correr dos veces y el stock quede duplicado,
//   - que se guarde a medias si algo falla,
//   - que queden dos listas predeterminadas (o ninguna) y no se pueda vender.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../src/app.js';
import { Employee } from '../src/models/Employee.js';
import { Inventory } from '../src/models/Inventory.js';
import { InventoryMovement } from '../src/models/InventoryMovement.js';
import { PriceList } from '../src/models/PriceList.js';
import { Setting } from '../src/models/Setting.js';
import { User } from '../src/models/User.js';

const USUARIO = 'dueno';
const PASSWORD = 'claveDePrueba123';
const HOY = '2026-09-21';

let token;

beforeEach(async () => {
  // OJO: acá NO se siembra a proposito. El asistente tiene que funcionar sobre
  // una base recien creada, que es la situacion real del dia de la entrega.
  await User.create({
    username: USUARIO,
    passwordHash: await User.hashearPassword(PASSWORD),
  });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: USUARIO, password: PASSWORD });
  token = login.body.token;
});

function conSesion(metodo, ruta) {
  return request(app)[metodo](ruta).set('Authorization', `Bearer ${token}`);
}

/** Una configuracion completa y realista, con los datos que daria el dueno. */
function configuracionCompleta(cambios = {}) {
  return {
    fecha: HOY,
    unidadLena: 'carga',
    ladrillosPorCamion: 25_000,
    umbralAlertaArcilla: 25_000,
    listasDePrecio: [
      { nombre: 'Normal', precioPorMil: 1_200_000 },
      { nombre: 'Mayorista', precioPorMil: 1_050_000 },
    ],
    stock: {
      arcillaPura: 2.5, // camiones
      arcillaFloja: 1.5,
      lena: 4,
      ladrillos: 30_000,
    },
    empleados: [
      { nombre: 'Ana Benitez', rol: 'Ponedora', tarifaPorMil: 180_000, telefono: '0981123456' },
      { nombre: 'Juan Ruiz', tarifaPorMil: 150_000 },
    ],
    ...cambios,
  };
}

describe('GET /api/setup', () => {
  it('avisa que la configuracion inicial todavia no se hizo', async () => {
    const r = await conSesion('get', '/api/setup');

    expect(r.status).toBe(200);
    expect(r.body.hecha).toBe(false);
  });

  it('exige sesion', async () => {
    const r = await request(app).get('/api/setup');
    expect(r.status).toBe(401);
  });
});

describe('POST /api/setup — el dia de la entrega', () => {
  it('deja el sistema listo para usar con un solo pedido', async () => {
    const r = await conSesion('post', '/api/setup').send(configuracionCompleta());

    expect(r.status).toBe(201);

    // 1) Los parametros del negocio quedaron guardados y la marca puesta.
    const config = await Setting.obtener();
    expect(config.unidadLena).toBe('carga');
    expect(config.ladrillosPorCamion).toBe(25_000);
    expect(config.configuracionInicialHecha).toBe(true);

    // 2) Las listas son las del dueno, no las inventadas del seed.
    const listas = await PriceList.find({ deletedAt: null }).sort({ predeterminada: -1 });
    expect(listas).toHaveLength(2);
    expect(listas[0].nombre).toBe('Normal');
    expect(listas[0].precioPorMil).toBe(1_200_000);
    // Exactamente UNA predeterminada (invariante de priceList.service.js).
    expect(listas.filter((l) => l.predeterminada)).toHaveLength(1);

    // 3) Los empleados estan activos y con su tarifa.
    const empleados = await Employee.find({ deletedAt: null }).sort({ nombre: 1 });
    expect(empleados.map((e) => e.nombre)).toEqual(['Ana Benitez', 'Juan Ruiz']);
    expect(empleados[0].telefono).toBe('0981123456');
    expect(empleados[0].activo).toBe(true);

    // 4) El stock del patio, con la arcilla convertida a ladrillos-equivalentes.
    //    2,5 camiones x 25.000 = 62.500.
    const stock = Object.fromEntries(
      (await Inventory.find()).map((i) => [i.material, i.cantidad]),
    );
    expect(stock.arcilla_pura).toBe(62_500);
    expect(stock.arcilla_floja).toBe(37_500);
    expect(stock.lena).toBe(4);
    expect(stock.ladrillos).toBe(30_000);

    // 5) Y quedo el rastro de por que el stock es ese.
    const movimientos = await InventoryMovement.find({ motivo: 'stock_inicial' });
    expect(movimientos).toHaveLength(4);
    expect(movimientos.every((m) => m.fecha === HOY)).toBe(true);
  });

  it('deja andando las categorias de caja aunque nadie haya corrido el seed', async () => {
    await conSesion('post', '/api/setup').send(configuracionCompleta());

    // Si las categorias de sistema no existieran, el primer gasto reventaria.
    const r = await conSesion('get', '/api/categories');
    expect(r.status).toBe(200);
    expect(r.body.categorias.length).toBeGreaterThan(0);
  });

  it('no se puede correr dos veces: el stock no se duplica', async () => {
    await conSesion('post', '/api/setup').send(configuracionCompleta());

    const segundo = await conSesion('post', '/api/setup').send(configuracionCompleta());

    expect(segundo.status).toBe(409);
    expect(segundo.body.error).toMatch(/ya se hizo/i);

    const ladrillos = await Inventory.findOne({ material: 'ladrillos' });
    expect(ladrillos.cantidad).toBe(30_000); // no 60.000
    expect(await Employee.countDocuments({ deletedAt: null })).toBe(2);
  });

  it('si algo esta mal, no guarda NADA a medias', async () => {
    // Un empleado sin tarifa: el esquema lo rechaza antes de escribir.
    const r = await conSesion('post', '/api/setup').send(
      configuracionCompleta({
        empleados: [{ nombre: 'Ana Benitez' }],
      }),
    );

    expect(r.status).toBe(400);

    // Ni los precios, ni el stock, ni la marca de "ya esta configurado".
    expect(await PriceList.countDocuments({ deletedAt: null })).toBe(0);
    expect(await InventoryMovement.countDocuments()).toBe(0);
    expect((await Setting.obtener()).configuracionInicialHecha).toBe(false);
  });

  it('acepta empezar sin empleados cargados', async () => {
    const r = await conSesion('post', '/api/setup').send(
      configuracionCompleta({ empleados: [] }),
    );

    expect(r.status).toBe(201);
    expect(await Employee.countDocuments({ deletedAt: null })).toBe(0);
  });

  it('exige al menos una lista de precio: sin precio no se puede vender', async () => {
    const r = await conSesion('post', '/api/setup').send(
      configuracionCompleta({ listasDePrecio: [] }),
    );

    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toMatch(/al menos una lista/i);
  });

  it('acepta arrancar con el patio vacio, sin inventar movimientos', async () => {
    const r = await conSesion('post', '/api/setup').send(
      configuracionCompleta({
        stock: { arcillaPura: 0, arcillaFloja: 0, lena: 0, ladrillos: 0 },
      }),
    );

    expect(r.status).toBe(201);
    // Un movimiento de cero no dice nada y ensucia el historial.
    expect(await InventoryMovement.countDocuments()).toBe(0);
  });

  it('si alguien ya probo el sistema, el stock queda en lo que dice el dueno', async () => {
    // Simula una prueba previa a la entrega: alguien cargo 10.000 ladrillos.
    await Inventory.updateOne(
      { material: 'ladrillos' },
      { $set: { cantidad: 10_000 } },
      { upsert: true },
    );

    await conSesion('post', '/api/setup').send(configuracionCompleta());

    // El dueno conto 30.000 en el patio: tienen que quedar 30.000, no 40.000.
    const ladrillos = await Inventory.findOne({ material: 'ladrillos' });
    expect(ladrillos.cantidad).toBe(30_000);

    // Y el movimiento registrado es la diferencia, no el total.
    const movimiento = await InventoryMovement.findOne({
      material: 'ladrillos',
      motivo: 'stock_inicial',
    });
    expect(movimiento.cantidad).toBe(20_000);
  });

  it('exige sesion', async () => {
    const r = await request(app).post('/api/setup').send(configuracionCompleta());
    expect(r.status).toBe(401);
  });
});
