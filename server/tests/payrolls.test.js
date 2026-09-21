// -----------------------------------------------------------------------------
// payrolls.test.js — La liquidacion del sabado, contra la API de verdad
// -----------------------------------------------------------------------------
// Criterio de la fase 8 en el plan: "Caso de prueba con deuda arrastrada da los
// numeros esperados". Ese es el test grande de este archivo: dos semanas
// seguidas, con la deuda de la primera apareciendo en la segunda.
//
// Es la fase donde se juntan tres modulos, asi que estos tests tambien
// verifican que las PROTECCIONES escritas en las fases 5 y 7 recien ahora se
// activen.
//
// Referencia: en 2026 el 21 de septiembre cae LUNES.
//   Semana 1: Lu 21 ... Sa 26
//   Semana 2: Lu 28 ... Sa 3/10
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../src/app.js';
import { Advance } from '../src/models/Advance.js';
import { Payroll } from '../src/models/Payroll.js';
import { Production } from '../src/models/Production.js';
import { Transaction } from '../src/models/Transaction.js';
import { User } from '../src/models/User.js';
import { sembrar } from '../src/services/seed.service.js';

const USUARIO = 'dueno';
const PASSWORD = 'claveDePrueba123';

const S1_LUNES = '2026-09-21';
const S1_MIERCOLES = '2026-09-23';
const S1_SABADO = '2026-09-26';
const S2_LUNES = '2026-09-28';
const S2_SABADO = '2026-10-03';

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

  // Ana cobra 180.000 el millar, Juan 150.000.
  ana = (
    await conSesion('post', '/api/employees').send({
      nombre: 'Ana Benitez',
      tarifaPorMil: 180_000,
      telefono: '0981 123 456',
    })
  ).body.empleado;

  juan = (
    await conSesion('post', '/api/employees').send({
      nombre: 'Juan Ruiz',
      tarifaPorMil: 150_000,
      // Juan NO tiene telefono cargado: sirve para probar el caso del boton
      // de WhatsApp deshabilitado.
    })
  ).body.empleado;

  // Arcilla para que la produccion no de negativo.
  await conSesion('post', '/api/inventory/ajustes').send({
    material: 'arcilla_pura',
    cantidadReal: 20,
    fecha: S1_LUNES,
  });
  await conSesion('post', '/api/inventory/ajustes').send({
    material: 'arcilla_floja',
    cantidadReal: 20,
    fecha: S1_LUNES,
  });
});

function conSesion(metodo, ruta) {
  return request(app)[metodo](ruta).set('Authorization', `Bearer ${token}`);
}

function producir({ fecha, cantidad, quienes }) {
  return conSesion('post', '/api/productions').send({ fecha, cantidad, employeeIds: quienes });
}

function adelantar({ employeeId, monto, fecha }) {
  return conSesion('post', '/api/advances').send({ employeeId, monto, fecha });
}

// ---------------------------------------------------------------------------

describe('Proteccion del modulo', () => {
  it('sin token no se ve la liquidacion', async () => {
    expect((await request(app).get('/api/payrolls/preview')).status).toBe(401);
  });

  it('sin token no se puede pagar', async () => {
    expect((await request(app).post(`/api/payrolls/${S1_LUNES}/pagar`)).status).toBe(401);
  });
});

describe('GET /api/payrolls/preview', () => {
  it('calcula el bruto de cada uno desde sus producciones', async () => {
    // 5.000 ladrillos: Ana cobra 900.000, Juan 750.000.
    await producir({ fecha: S1_LUNES, cantidad: 5000, quienes: [ana.id, juan.id] });
    // 4.000 mas, solo Ana: 720.000.
    await producir({ fecha: S1_MIERCOLES, cantidad: 4000, quienes: [ana.id] });

    const res = await conSesion('get', `/api/payrolls/preview?semana=${S1_MIERCOLES}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('borrador');
    expect(res.body.semana).toEqual({ inicio: S1_LUNES, fin: S1_SABADO });

    const deAna = res.body.detalle.find((d) => d.nombre === 'Ana Benitez');
    expect(deAna).toMatchObject({
      ladrillos: 9000,
      bruto: 1_620_000,
      adelantos: 0,
      deudaAnterior: 0,
      neto: 1_620_000,
      deudaNueva: 0,
    });
    expect(deAna.diario).toHaveLength(2);

    const deJuan = res.body.detalle.find((d) => d.nombre === 'Juan Ruiz');
    expect(deJuan.neto).toBe(750_000);

    expect(res.body.totalAPagar).toBe(2_370_000);
  });

  it('resta los adelantos de la semana', async () => {
    await producir({ fecha: S1_LUNES, cantidad: 5000, quienes: [ana.id] });
    await adelantar({ employeeId: ana.id, monto: 300_000, fecha: S1_MIERCOLES });

    const res = await conSesion('get', `/api/payrolls/preview?semana=${S1_LUNES}`);
    const deAna = res.body.detalle[0];

    expect(deAna.bruto).toBe(900_000);
    expect(deAna.adelantos).toBe(300_000);
    expect(deAna.neto).toBe(600_000);
  });

  it('NO mezcla los adelantos de otra semana', async () => {
    await producir({ fecha: S1_LUNES, cantidad: 5000, quienes: [ana.id] });
    await adelantar({ employeeId: ana.id, monto: 300_000, fecha: S2_LUNES });

    const res = await conSesion('get', `/api/payrolls/preview?semana=${S1_LUNES}`);
    expect(res.body.detalle[0].adelantos).toBe(0);
  });

  it('no guarda nada: se puede llamar mil veces', async () => {
    await producir({ fecha: S1_LUNES, cantidad: 5000, quienes: [ana.id] });

    await conSesion('get', `/api/payrolls/preview?semana=${S1_LUNES}`);
    await conSesion('get', `/api/payrolls/preview?semana=${S1_LUNES}`);
    await conSesion('get', `/api/payrolls/preview?semana=${S1_LUNES}`);

    expect(await Payroll.countDocuments({})).toBe(0);
    // Y las producciones siguen sin liquidar.
    expect(await Production.countDocuments({ payrollId: null })).toBe(1);
  });

  it('una semana vacia devuelve lista vacia, no un error', async () => {
    const res = await conSesion('get', `/api/payrolls/preview?semana=${S1_LUNES}`);
    expect(res.status).toBe(200);
    expect(res.body.detalle).toEqual([]);
    expect(res.body.totalAPagar).toBe(0);
  });
});

describe('EL CRITERIO DE LA FASE: deuda arrastrada entre dos semanas', () => {
  it('da los numeros esperados', async () => {
    // ---------- SEMANA 1 ----------
    // Ana produce poco: 3.000 ladrillos = 540.000
    await producir({ fecha: S1_LUNES, cantidad: 3000, quienes: [ana.id] });
    // pero se adelanta 800.000
    await adelantar({ employeeId: ana.id, monto: 800_000, fecha: S1_MIERCOLES });

    const preview1 = await conSesion('get', `/api/payrolls/preview?semana=${S1_LUNES}`);
    const ana1 = preview1.body.detalle.find((d) => d.nombre === 'Ana Benitez');

    expect(ana1.bruto).toBe(540_000);
    expect(ana1.adelantos).toBe(800_000);
    expect(ana1.neto).toBe(0); // no cobra nada
    expect(ana1.deudaNueva).toBe(260_000); // y arrastra 260.000
    expect(preview1.body.totalAPagar).toBe(0);

    // Se paga la semana 1.
    const pago1 = await conSesion('post', `/api/payrolls/${S1_LUNES}/pagar`);
    expect(pago1.status).toBe(201);
    expect(pago1.body.payroll.estado).toBe('pagada');

    // Como el total es 0, NO se crea egreso de sueldos: la plata ya salio con
    // el adelanto, y contarla de nuevo seria pagarla dos veces.
    expect(await Transaction.countDocuments({ 'origen.tipo': 'liquidacion' })).toBe(0);

    // ---------- SEMANA 2 ----------
    // Ana trabaja normal: 5.000 ladrillos = 900.000
    await producir({ fecha: S2_LUNES, cantidad: 5000, quienes: [ana.id] });

    const preview2 = await conSesion('get', `/api/payrolls/preview?semana=${S2_LUNES}`);
    const ana2 = preview2.body.detalle.find((d) => d.nombre === 'Ana Benitez');

    // ACA ESTA LA CADENA: la deudaNueva de la semana 1 es la deudaAnterior
    // de la semana 2.
    expect(ana2.deudaAnterior).toBe(260_000);
    expect(ana2.bruto).toBe(900_000);
    expect(ana2.adelantos).toBe(0);
    expect(ana2.neto).toBe(640_000); // 900.000 - 260.000
    expect(ana2.deudaNueva).toBe(0); // saldada

    // Se paga la semana 2: ahora SI sale plata.
    await conSesion('post', `/api/payrolls/${S2_LUNES}/pagar`);

    const egreso = await Transaction.findOne({ 'origen.tipo': 'liquidacion' });
    expect(egreso.monto).toBe(640_000);
    expect(egreso.categoriaNombre).toBe('Sueldos');
    // Con la fecha del SABADO, que es el dia de pago.
    expect(egreso.fecha).toBe(S2_SABADO);

    // ---------- SEMANA 3 ----------
    // Ya no arrastra nada: si no trabaja, no aparece.
    const preview3 = await conSesion('get', '/api/payrolls/preview?semana=2026-10-05');
    expect(preview3.body.detalle).toEqual([]);
  });

  it('la deuda sobrevive a una semana sin trabajar', async () => {
    await producir({ fecha: S1_LUNES, cantidad: 1000, quienes: [ana.id] }); // 180.000
    await adelantar({ employeeId: ana.id, monto: 500_000, fecha: S1_LUNES });
    await conSesion('post', `/api/payrolls/${S1_LUNES}/pagar`);
    // Queda debiendo 320.000

    // Semana 2: no trabaja nada. Igual tiene que aparecer, o la deuda
    // desapareceria sin que nadie la haya pagado.
    const preview2 = await conSesion('get', `/api/payrolls/preview?semana=${S2_LUNES}`);
    const ana2 = preview2.body.detalle.find((d) => d.nombre === 'Ana Benitez');

    expect(ana2).toBeDefined();
    expect(ana2.bruto).toBe(0);
    expect(ana2.deudaAnterior).toBe(320_000);
    expect(ana2.deudaNueva).toBe(320_000);
  });
});

describe('POST /api/payrolls/:semana/pagar', () => {
  beforeEach(async () => {
    await producir({ fecha: S1_LUNES, cantidad: 5000, quienes: [ana.id, juan.id] });
    await adelantar({ employeeId: ana.id, monto: 300_000, fecha: S1_MIERCOLES });
  });

  it('crea el egreso de sueldos por el total neto', async () => {
    const res = await conSesion('post', `/api/payrolls/${S1_LUNES}/pagar`);

    expect(res.status).toBe(201);
    // Ana: 900.000 - 300.000 = 600.000 · Juan: 750.000 -> total 1.350.000
    expect(res.body.payroll.totalAPagar).toBe(1_350_000);

    const egreso = await Transaction.findOne({ 'origen.tipo': 'liquidacion' });
    expect(egreso.monto).toBe(1_350_000);
    expect(egreso.tipo).toBe('egreso');
    expect(egreso.categoriaNombre).toBe('Sueldos');
    expect(egreso.descripcion).toContain('Gs 1.350.000');
  });

  it('marca las producciones y los adelantos de la semana', async () => {
    const res = await conSesion('post', `/api/payrolls/${S1_LUNES}/pagar`);
    const payrollId = res.body.payroll.id;

    const produccion = await Production.findOne({});
    const adelanto = await Advance.findOne({});

    expect(String(produccion.payrollId)).toBe(String(payrollId));
    expect(String(adelanto.payrollId)).toBe(String(payrollId));
  });

  it('BLOQUEA pagar dos veces la misma semana', async () => {
    await conSesion('post', `/api/payrolls/${S1_LUNES}/pagar`);

    const segunda = await conSesion('post', `/api/payrolls/${S1_LUNES}/pagar`);
    expect(segunda.status).toBe(409);
    expect(segunda.body.error).toMatch(/ya fue liquidada/i);

    // Y no se duplico el egreso.
    expect(await Transaction.countDocuments({ 'origen.tipo': 'liquidacion' })).toBe(1);
  });

  it('sirve cualquier dia de la semana en la URL', async () => {
    const res = await conSesion('post', `/api/payrolls/${S1_MIERCOLES}/pagar`);
    expect(res.status).toBe(201);
    expect(res.body.payroll.semanaInicio).toBe(S1_LUNES);
  });

  it('rechaza liquidar una semana sin nada', async () => {
    const res = await conSesion('post', '/api/payrolls/2026-11-02/pagar');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nada que liquidar/i);
  });

  it('el preview de una semana pagada devuelve lo GUARDADO, no un recalculo', async () => {
    await conSesion('post', `/api/payrolls/${S1_LUNES}/pagar`);

    const res = await conSesion('get', `/api/payrolls/preview?semana=${S1_LUNES}`);
    expect(res.body.estado).toBe('pagada');
    expect(res.body.totalAPagar).toBe(1_350_000);
    expect(res.body.payrollId).toBeTruthy();
  });

  it('subir la tarifa DESPUES no cambia lo ya liquidado (snapshot)', async () => {
    await conSesion('post', `/api/payrolls/${S1_LUNES}/pagar`);

    await conSesion('patch', `/api/employees/${ana.id}`).send({ tarifaPorMil: 500_000 });

    const res = await conSesion('get', `/api/payrolls/preview?semana=${S1_LUNES}`);
    const deAna = res.body.detalle.find((d) => d.nombre === 'Ana Benitez');
    expect(deAna.bruto).toBe(900_000); // la de septiembre
  });
});

describe('Las protecciones de las fases 5 y 7 se activan al liquidar', () => {
  let produccionId;
  let adelantoId;

  beforeEach(async () => {
    produccionId = (
      await producir({ fecha: S1_LUNES, cantidad: 5000, quienes: [ana.id] })
    ).body.produccion.id;
    adelantoId = (
      await adelantar({ employeeId: ana.id, monto: 200_000, fecha: S1_LUNES })
    ).body.adelanto.id;
  });

  it('ANTES de liquidar, las dos se pueden anular', async () => {
    expect((await conSesion('delete', `/api/productions/${produccionId}`)).status).toBe(200);
    expect((await conSesion('delete', `/api/advances/${adelantoId}`)).status).toBe(200);
  });

  it('DESPUES de liquidar, ninguna de las dos se puede anular', async () => {
    await conSesion('post', `/api/payrolls/${S1_LUNES}/pagar`);

    const p = await conSesion('delete', `/api/productions/${produccionId}`);
    expect(p.status).toBe(409);
    expect(p.body.error).toMatch(/liquidada/i);

    const a = await conSesion('delete', `/api/advances/${adelantoId}`);
    expect(a.status).toBe(409);
    expect(a.body.error).toMatch(/liquidada/i);
  });

  it('el egreso de sueldos NO se puede anular desde Caja', async () => {
    await conSesion('post', `/api/payrolls/${S1_LUNES}/pagar`);
    const egreso = await Transaction.findOne({ 'origen.tipo': 'liquidacion' });

    expect((await conSesion('delete', `/api/transactions/${egreso._id}`)).status).toBe(400);
  });
});

describe('GET /api/payrolls — historial', () => {
  it('lista las semanas pagadas, de la mas nueva a la mas vieja', async () => {
    await producir({ fecha: S1_LUNES, cantidad: 5000, quienes: [ana.id] });
    await conSesion('post', `/api/payrolls/${S1_LUNES}/pagar`);

    await producir({ fecha: S2_LUNES, cantidad: 3000, quienes: [ana.id] });
    await conSesion('post', `/api/payrolls/${S2_LUNES}/pagar`);

    const res = await conSesion('get', '/api/payrolls');
    expect(res.body.liquidaciones).toHaveLength(2);
    expect(res.body.liquidaciones[0].semanaInicio).toBe(S2_LUNES);
    expect(res.body.liquidaciones[1].semanaInicio).toBe(S1_LUNES);
  });
});

describe('GET /api/payrolls/:id/ticket/:employeeId', () => {
  let payrollId;

  beforeEach(async () => {
    await producir({ fecha: S1_LUNES, cantidad: 5000, quienes: [ana.id, juan.id] });
    await producir({ fecha: S1_MIERCOLES, cantidad: 4000, quienes: [ana.id] });
    await adelantar({ employeeId: ana.id, monto: 500_000, fecha: S1_MIERCOLES });

    payrollId = (await conSesion('post', `/api/payrolls/${S1_LUNES}/pagar`)).body.payroll.id;
  });

  it('arma el texto del ticket con el dia a dia', async () => {
    const res = await conSesion('get', `/api/payrolls/${payrollId}/ticket/${ana.id}`);

    expect(res.status).toBe(200);
    expect(res.body.texto).toContain('Ana Benitez');
    expect(res.body.texto).toContain('Lun 21/09: 5.000 ladrillos — Gs 900.000');
    expect(res.body.texto).toContain('Mie 23/09: 4.000 ladrillos — Gs 720.000');
    expect(res.body.texto).toContain('Adelantos: -Gs 500.000');
    expect(res.body.texto).toContain('*A cobrar: Gs 1.120.000*');
  });

  it('con telefono cargado, se puede mandar por WhatsApp', async () => {
    const res = await conSesion('get', `/api/payrolls/${payrollId}/ticket/${ana.id}`);

    expect(res.body.puedeWhatsApp).toBe(true);
    // "0981 123 456" -> sin el cero nacional, con el codigo de pais.
    expect(res.body.numeroWhatsApp).toBe('595981123456');
  });

  it('SIN telefono, avisa que no se puede en vez de dar un link roto', async () => {
    const res = await conSesion('get', `/api/payrolls/${payrollId}/ticket/${juan.id}`);

    expect(res.status).toBe(200);
    expect(res.body.puedeWhatsApp).toBe(false);
    expect(res.body.numeroWhatsApp).toBeNull();
    // El ticket igual se arma: se puede leer en pantalla.
    expect(res.body.texto).toContain('Juan Ruiz');
  });

  it('el telefono se lee AHORA, no del snapshot de la liquidacion', async () => {
    // Si cambio de numero despues de que se le pago, el ticket tiene que ir al
    // numero nuevo: el telefono no es parte del comprobante.
    await conSesion('patch', `/api/employees/${juan.id}`).send({ telefono: '0971 555 111' });

    const res = await conSesion('get', `/api/payrolls/${payrollId}/ticket/${juan.id}`);
    expect(res.body.puedeWhatsApp).toBe(true);
    expect(res.body.numeroWhatsApp).toBe('595971555111');
  });

  it('404 si el empleado no figura en esa liquidacion', async () => {
    const otro = (
      await conSesion('post', '/api/employees').send({ nombre: 'Pedro Lopez', tarifaPorMil: 100_000 })
    ).body.empleado;

    const res = await conSesion('get', `/api/payrolls/${payrollId}/ticket/${otro.id}`);
    expect(res.status).toBe(404);
  });
});
