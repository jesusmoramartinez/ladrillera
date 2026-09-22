// -----------------------------------------------------------------------------
// dashboard.test.js — El Inicio
// -----------------------------------------------------------------------------
// Criterio de la fase 9 en el plan: "Inicio muestra datos reales en < 2 s".
//
// La parte de "datos reales" se testea acá. La de "< 2 s" no se puede medir
// con honestidad en un test (la maquina de desarrollo no dice nada sobre el
// celular del dueno con la señal de la fabrica), asi que lo que SI se verifica
// es la decision que la hace posible: que el endpoint no traiga documentos
// que no necesita.
//
// Referencia: en 2026 el 21 de septiembre cae LUNES.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../src/app.js';
import { PriceList } from '../src/models/PriceList.js';
import { User } from '../src/models/User.js';
import { sembrar } from '../src/services/seed.service.js';

const USUARIO = 'dueno';
const PASSWORD = 'claveDePrueba123';

const LUNES = '2026-09-21';
const MIERCOLES = '2026-09-23';
const DOMINGO_ANTERIOR = '2026-09-20';

let token;
let ana;
let listaNormal;

beforeEach(async () => {
  await sembrar({ silencioso: true });

  await User.create({
    username: USUARIO,
    passwordHash: await User.hashearPassword(PASSWORD),
  });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: USUARIO, password: PASSWORD });
  token = login.body.token;

  listaNormal = await PriceList.findOne({ nombre: 'Normal' });

  ana = (
    await conSesion('post', '/api/employees').send({ nombre: 'Ana Benitez', tarifaPorMil: 180_000 })
  ).body.empleado;
});

function conSesion(metodo, ruta) {
  return request(app)[metodo](ruta).set('Authorization', `Bearer ${token}`);
}

/** El dashboard de un dia concreto, sin depender de cuando corran los tests. */
function dashboard(fecha = MIERCOLES) {
  return conSesion('get', `/api/dashboard?fecha=${fecha}`);
}

async function ajustar(material, cantidadReal) {
  await conSesion('post', '/api/inventory/ajustes').send({
    material,
    cantidadReal,
    fecha: LUNES,
  });
}

// ---------------------------------------------------------------------------

describe('Proteccion del modulo', () => {
  it('sin token no se ve el dashboard', async () => {
    expect((await request(app).get('/api/dashboard')).status).toBe(401);
  });
});

describe('GET /api/dashboard — sistema vacio', () => {
  it('devuelve todo en cero, no un error', async () => {
    const res = await dashboard();

    expect(res.status).toBe(200);
    expect(res.body.balance).toMatchObject({ ingresos: 0, egresos: 0, resultado: 0 });
    expect(res.body.produccion.ladrillos).toBe(0);
    expect(res.body.ladrillos).toEqual({ fisico: 0, comprometido: 0, libre: 0 });
    expect(res.body.pendientes).toEqual({ porCobrar: 0, porEntregar: 0 });
  });

  it('con el stock en cero, la alerta de arcilla esta prendida', async () => {
    // 0 < 25.000, asi que hay que comprar.
    const res = await dashboard();
    expect(res.body.arcilla.alerta.alerta).toBe(true);
    expect(res.body.arcilla.alerta.faltante).toEqual(['arcilla_pura', 'arcilla_floja']);
  });

  it('sin ?fecha usa hoy y responde igual', async () => {
    const res = await conSesion('get', '/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rechaza una fecha con formato equivocado', async () => {
    expect((await conSesion('get', '/api/dashboard?fecha=23/09/2026')).status).toBe(400);
  });
});

describe('Balance del mes', () => {
  it('muestra ingresos y egresos por separado, no solo el resultado', async () => {
    // Un resultado de 500.000 no dice lo mismo si se movieron 600.000 que si
    // se movieron 20.000.000.
    await conSesion('post', '/api/inventory/compras').send({
      material: 'arcilla_pura',
      cantidad: 2,
      monto: 3_000_000,
      fecha: LUNES,
    });

    const cliente = (await conSesion('post', '/api/clients').send({ nombre: 'Juan Perez' })).body
      .cliente;
    await conSesion('post', '/api/sales').send({
      fecha: LUNES,
      clientId: cliente.id,
      cantidad: 5000,
      listaPrecioId: String(listaNormal._id),
      pagadoCompleto: true,
    });

    const res = await dashboard();

    expect(res.body.balance.ingresos).toBe(5_000_000);
    expect(res.body.balance.egresos).toBe(3_000_000);
    expect(res.body.balance.resultado).toBe(2_000_000);
    expect(res.body.mes).toBe('2026-09');
  });

  it('NO mezcla los movimientos de otro mes', async () => {
    await conSesion('post', '/api/inventory/compras').send({
      material: 'lena',
      cantidad: 1,
      monto: 500_000,
      fecha: '2026-10-05',
    });

    const septiembre = await dashboard(MIERCOLES);
    expect(septiembre.body.balance.egresos).toBe(0);

    const octubre = await dashboard('2026-10-07');
    expect(octubre.body.balance.egresos).toBe(500_000);
  });
});

describe('Ladrillos de la semana — de lunes a HOY', () => {
  beforeEach(async () => {
    await ajustar('arcilla_pura', 20);
    await ajustar('arcilla_floja', 20);
  });

  it('suma los dias de la semana hasta hoy', async () => {
    await conSesion('post', '/api/productions').send({
      fecha: LUNES,
      cantidad: 5000,
      employeeIds: [ana.id],
    });
    await conSesion('post', '/api/productions').send({
      fecha: MIERCOLES,
      cantidad: 4000,
      employeeIds: [ana.id],
    });

    const res = await dashboard(MIERCOLES);
    expect(res.body.produccion.ladrillos).toBe(9000);
    expect(res.body.produccion.dias).toBe(2);
    expect(res.body.produccion.desde).toBe(LUNES);
    expect(res.body.produccion.hasta).toBe(MIERCOLES);
  });

  it('NO cuenta los dias posteriores a hoy', async () => {
    // El dueno puede cargar un dia adelantado; el Inicio muestra lo ACUMULADO
    // hasta hoy, no el total de la semana.
    await conSesion('post', '/api/productions').send({
      fecha: LUNES,
      cantidad: 5000,
      employeeIds: [ana.id],
    });
    await conSesion('post', '/api/productions').send({
      fecha: '2026-09-25', // viernes
      cantidad: 8000,
      employeeIds: [ana.id],
    });

    const res = await dashboard(MIERCOLES);
    expect(res.body.produccion.ladrillos).toBe(5000);
  });

  it('NO cuenta la semana anterior', async () => {
    await conSesion('post', '/api/productions').send({
      fecha: '2026-09-16', // miercoles de la semana pasada
      cantidad: 7000,
      employeeIds: [ana.id],
    });

    const res = await dashboard(MIERCOLES);
    expect(res.body.produccion.ladrillos).toBe(0);
  });

  it('dos producciones el MISMO dia cuentan como un dia', async () => {
    for (const cantidad of [3000, 2000]) {
      await conSesion('post', '/api/productions').send({
        fecha: LUNES,
        cantidad,
        employeeIds: [ana.id],
      });
    }

    const res = await dashboard(LUNES);
    expect(res.body.produccion.ladrillos).toBe(5000);
    expect(res.body.produccion.dias).toBe(1);
  });

  it('un domingo no rompe el rango: la semana todavia no empezo', async () => {
    // El domingo cuenta para la semana que EMPIEZA (decision de la fase 5),
    // asi que el lunes es MAÑANA y el acumulado correcto es cero.
    await conSesion('post', '/api/productions').send({
      fecha: '2026-09-16',
      cantidad: 7000,
      employeeIds: [ana.id],
    });

    const res = await dashboard(DOMINGO_ANTERIOR);
    expect(res.status).toBe(200);
    expect(res.body.produccion.ladrillos).toBe(0);
    expect(res.body.semana.inicio).toBe(LUNES); // la que arranca mañana
  });
});

describe('Stock y alerta de arcilla', () => {
  it('trae los tres numeros de los ladrillos', async () => {
    await ajustar('ladrillos', 20_000);

    const cliente = (await conSesion('post', '/api/clients').send({ nombre: 'Juan Perez' })).body
      .cliente;
    await conSesion('post', '/api/sales').send({
      fecha: LUNES,
      clientId: cliente.id,
      cantidad: 5000,
      listaPrecioId: String(listaNormal._id),
    });

    const res = await dashboard();
    expect(res.body.ladrillos).toEqual({ fisico: 20_000, comprometido: 5_000, libre: 15_000 });
  });

  it('apaga la alerta cuando hay arcilla suficiente', async () => {
    await ajustar('arcilla_pura', 2); // 2 camiones = 50.000
    await ajustar('arcilla_floja', 2);

    const res = await dashboard();
    expect(res.body.arcilla.alerta.alerta).toBe(false);
    expect(res.body.arcilla.pura.camiones).toBe(2);
  });

  it('avisa CUAL arcilla falta, no solo que falta', async () => {
    await ajustar('arcilla_pura', 5); // sobra
    await ajustar('arcilla_floja', 0.5); // 12.500, falta

    const res = await dashboard();
    expect(res.body.arcilla.alerta.alerta).toBe(true);
    expect(res.body.arcilla.alerta.faltante).toEqual(['arcilla_floja']);
  });

  it('incluye la lena con su unidad', async () => {
    await ajustar('lena', 3);

    const res = await dashboard();
    expect(res.body.lena.cantidad).toBe(3);
    expect(res.body.lena.unidad).toBe('carga');
  });
});

describe('Por cobrar y por entregar', () => {
  it('suma lo pendiente de todas las ventas', async () => {
    const cliente = (await conSesion('post', '/api/clients').send({ nombre: 'Juan Perez' })).body
      .cliente;

    // Una pendiente de todo
    await conSesion('post', '/api/sales').send({
      fecha: LUNES,
      clientId: cliente.id,
      cantidad: 2000,
      listaPrecioId: String(listaNormal._id),
    });
    // Una ya cobrada, falta entregar
    await conSesion('post', '/api/sales').send({
      fecha: LUNES,
      clientId: cliente.id,
      cantidad: 3000,
      listaPrecioId: String(listaNormal._id),
      pagadoCompleto: true,
    });

    const res = await dashboard();
    expect(res.body.pendientes.porCobrar).toBe(2_000_000); // solo la primera
    expect(res.body.pendientes.porEntregar).toBe(5000); // las dos
  });
});

describe('Coherencia con el resto del sistema', () => {
  it('los numeros coinciden con los de las otras pantallas', async () => {
    // Si el Inicio calculara por su cuenta, podria discrepar con Stock o Caja
    // y no habria forma de saber cual tiene razon. Usa los mismos servicios.
    await ajustar('ladrillos', 12_000);
    await conSesion('post', '/api/inventory/compras').send({
      material: 'lena',
      cantidad: 2,
      monto: 800_000,
      fecha: LUNES,
    });

    const inicio = (await dashboard()).body;
    const stock = (await conSesion('get', '/api/inventory')).body.stock;
    const caja = (await conSesion('get', '/api/transactions?mes=2026-09')).body;

    expect(inicio.ladrillos).toEqual(stock.ladrillos);
    expect(inicio.arcilla.alerta).toEqual(stock.alertaArcilla);
    expect(inicio.balance.egresos).toBe(caja.balance.egresos);
    expect(inicio.balance.resultado).toBe(caja.balance.resultado);
  });
});
