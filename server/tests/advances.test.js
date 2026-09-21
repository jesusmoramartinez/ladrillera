// -----------------------------------------------------------------------------
// advances.test.js — Adelantos y su egreso de caja
// -----------------------------------------------------------------------------
// Criterio de la fase 7 en el plan: "El adelanto aparece en caja al instante".
// Ese es el primer test; el resto son los bordes.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../src/app.js';
import { Advance } from '../src/models/Advance.js';
import { Transaction } from '../src/models/Transaction.js';
import { User } from '../src/models/User.js';
import { sembrar } from '../src/services/seed.service.js';

const USUARIO = 'dueno';
const PASSWORD = 'claveDePrueba123';

// En 2026 el 21 de septiembre cae LUNES. La semana va del 21 al sabado 26.
const LUNES = '2026-09-21';
const MIERCOLES = '2026-09-23';
const SABADO = '2026-09-26';

let token;
let ana;
let juan;

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

  ana = (
    await conSesion('post', '/api/employees').send({ nombre: 'Ana Benitez', tarifaPorMil: 180_000 })
  ).body.empleado;
  juan = (
    await conSesion('post', '/api/employees').send({ nombre: 'Juan Ruiz', tarifaPorMil: 150_000 })
  ).body.empleado;
});

function conSesion(metodo, ruta) {
  return request(app)[metodo](ruta).set('Authorization', `Bearer ${token}`);
}

function adelantar(datos = {}) {
  return conSesion('post', '/api/advances').send({
    employeeId: ana.id,
    monto: 500_000,
    fecha: LUNES,
    ...datos,
  });
}

// ---------------------------------------------------------------------------

describe('Proteccion del modulo', () => {
  it('sin token no se ven los adelantos', async () => {
    expect((await request(app).get('/api/advances')).status).toBe(401);
  });

  it('sin token no se puede adelantar', async () => {
    expect((await request(app).post('/api/advances').send({ monto: 1 })).status).toBe(401);
  });
});

describe('EL CRITERIO DE LA FASE: el adelanto aparece en caja al instante', () => {
  it('crea el adelanto y su egreso, en el mismo momento', async () => {
    const res = await adelantar({ monto: 500_000 });

    expect(res.status).toBe(201);
    expect(res.body.adelanto.monto).toBe(500_000);
    expect(res.body.adelanto.empleado.nombre).toBe('Ana Benitez');

    // --- La caja ---
    const egresos = await Transaction.find({ tipo: 'egreso', deletedAt: null });
    expect(egresos).toHaveLength(1);
    expect(egresos[0].monto).toBe(500_000);
    expect(egresos[0].categoriaNombre).toBe('Adelanto');
    expect(egresos[0].origen.tipo).toBe('adelanto');
    expect(egresos[0].fecha).toBe(LUNES);
    expect(egresos[0].descripcion).toContain('Ana Benitez');
    // El monto va formateado adentro del texto que lee el dueno.
    expect(egresos[0].descripcion).toContain('Gs 500.000');

    // Y el adelanto quedo apuntando a su egreso, para poder anularlo despues.
    expect(String(res.body.adelanto.transactionId)).toBe(String(egresos[0]._id));

    // --- El balance del mes lo refleja ya ---
    const caja = (await conSesion('get', '/api/transactions?mes=2026-09')).body;
    expect(caja.balance.egresos).toBe(500_000);
  });

  it('el egreso lleva la fecha del ADELANTO, no la de hoy', async () => {
    // La plata salio de la caja el dia que se la dieron.
    await adelantar({ fecha: MIERCOLES });

    const egreso = await Transaction.findOne({ tipo: 'egreso' });
    expect(egreso.fecha).toBe(MIERCOLES);
  });
});

describe('POST /api/advances — lo que no se acepta', () => {
  it('rechaza un empleado que no existe', async () => {
    const res = await adelantar({ employeeId: '0123456789abcdef01234567' });
    expect(res.status).toBe(404);
  });

  it('rechaza un empleado INACTIVO, y lo dice por su nombre', async () => {
    await conSesion('patch', `/api/employees/${ana.id}`).send({ activo: false });

    const res = await adelantar();
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Ana Benitez/);
    expect(res.body.error).toMatch(/inactivo/i);
  });

  it('rechaza monto cero o negativo', async () => {
    expect((await adelantar({ monto: 0 })).status).toBe(400);
    expect((await adelantar({ monto: -100_000 })).status).toBe(400);
  });

  it('rechaza monto con decimales: el guarani no tiene centavos', async () => {
    expect((await adelantar({ monto: 500_000.5 })).status).toBe(400);
  });

  it('rechaza una fecha con formato equivocado', async () => {
    expect((await adelantar({ fecha: '21/09/2026' })).status).toBe(400);
  });

  it('NO controla que el adelanto sea menor a lo que va a ganar', async () => {
    // A proposito (plan 5.9): al dar el adelanto todavia no se sabe cuanto va
    // a producir, y si se pasa, la diferencia queda como deuda de la semana
    // siguiente. Es un caso previsto, no un error.
    const res = await adelantar({ monto: 50_000_000 });
    expect(res.status).toBe(201);
  });

  it('si algo falla, no queda ni el adelanto ni el egreso (todo o nada)', async () => {
    await conSesion('patch', `/api/employees/${ana.id}`).send({ activo: false });
    await adelantar();

    expect(await Advance.countDocuments({})).toBe(0);
    expect(await Transaction.countDocuments({ tipo: 'egreso' })).toBe(0);
  });
});

describe('GET /api/advances — la semana', () => {
  it('trae los de la semana y los agrupa por empleado', async () => {
    await adelantar({ employeeId: ana.id, monto: 500_000, fecha: LUNES });
    await adelantar({ employeeId: ana.id, monto: 200_000, fecha: MIERCOLES });
    await adelantar({ employeeId: juan.id, monto: 300_000, fecha: SABADO });

    const res = await conSesion('get', `/api/advances?semana=${MIERCOLES}`);

    expect(res.status).toBe(200);
    expect(res.body.semana).toEqual({ inicio: LUNES, fin: SABADO });
    expect(res.body.adelantos).toHaveLength(3);
    expect(res.body.resumen.total).toBe(1_000_000);

    const deAna = res.body.resumen.porEmpleado.find((e) => e.nombre === 'Ana Benitez');
    expect(deAna.monto).toBe(700_000);
    expect(deAna.veces).toBe(2);

    const deJuan = res.body.resumen.porEmpleado.find((e) => e.nombre === 'Juan Ruiz');
    expect(deJuan.monto).toBe(300_000);
    expect(deJuan.veces).toBe(1);
  });

  it('NO trae los de otra semana', async () => {
    await adelantar({ fecha: LUNES });
    await adelantar({ fecha: '2026-09-28' }); // el lunes siguiente

    const res = await conSesion('get', `/api/advances?semana=${LUNES}`);
    expect(res.body.adelantos).toHaveLength(1);
  });

  it('el domingo cuenta para la semana que EMPIEZA (igual que produccion)', async () => {
    const res = await conSesion('get', '/api/advances?semana=2026-09-27');
    expect(res.body.semana).toEqual({ inicio: '2026-09-28', fin: '2026-10-03' });
  });

  it('sin adelantos devuelve la semana vacia, no un error', async () => {
    const res = await conSesion('get', `/api/advances?semana=${LUNES}`);
    expect(res.status).toBe(200);
    expect(res.body.adelantos).toEqual([]);
    expect(res.body.resumen.total).toBe(0);
  });

  it('cada adelanto viene con su empleado adentro, no solo el id', async () => {
    await adelantar();
    const res = await conSesion('get', `/api/advances?semana=${LUNES}`);

    expect(res.body.adelantos[0].empleado.nombre).toBe('Ana Benitez');
    expect(typeof res.body.adelantos[0].employeeId).toBe('string');
  });
});

describe('DELETE /api/advances/:id — anular', () => {
  it('anula el adelanto Y su egreso de caja', async () => {
    const adelanto = (await adelantar()).body.adelanto;

    const res = await conSesion('delete', `/api/advances/${adelanto.id}`);
    expect(res.status).toBe(200);

    // Desaparece de la lista...
    const lista = await conSesion('get', `/api/advances?semana=${LUNES}`);
    expect(lista.body.adelantos).toHaveLength(0);
    // ...pero sigue en la base (soft delete).
    expect(await Advance.countDocuments({})).toBe(1);

    // Y el egreso quedo marcado, no borrado.
    expect(await Transaction.countDocuments({ tipo: 'egreso', deletedAt: null })).toBe(0);
    expect(await Transaction.countDocuments({ tipo: 'egreso' })).toBe(1);

    // El balance del mes vuelve a cero.
    const caja = (await conSesion('get', '/api/transactions?mes=2026-09')).body;
    expect(caja.balance.egresos).toBe(0);
  });

  it('no se puede anular dos veces', async () => {
    const adelanto = (await adelantar()).body.adelanto;

    await conSesion('delete', `/api/advances/${adelanto.id}`);
    expect((await conSesion('delete', `/api/advances/${adelanto.id}`)).status).toBe(404);
  });

  it('BLOQUEA anular uno de una semana ya liquidada (plan 5.9)', async () => {
    const adelanto = (await adelantar()).body.adelanto;

    // Simulamos que la fase 8 ya lo descontó de un sueldo.
    await Advance.updateOne(
      { _id: adelanto.id },
      { payrollId: '0123456789abcdef01234567' },
    );

    const res = await conSesion('delete', `/api/advances/${adelanto.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/liquidada/i);

    // Y el egreso sigue en pie: no se toco nada.
    expect(await Transaction.countDocuments({ tipo: 'egreso', deletedAt: null })).toBe(1);
  });

  it('el egreso de un adelanto NO se puede anular desde Caja', async () => {
    await adelantar();
    const egreso = await Transaction.findOne({ tipo: 'egreso' });

    const res = await conSesion('delete', `/api/transactions/${egreso._id}`);
    expect(res.status).toBe(400);
  });
});
