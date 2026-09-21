// -----------------------------------------------------------------------------
// clients.test.js — El CRUD de clientes y, sobre todo, sus saldos
// -----------------------------------------------------------------------------
// El alta y la edicion son iguales a las de empleados. Lo que de verdad hay
// que probar acá es que el saldo de cada cliente salga bien, porque no es un
// campo guardado: se calcula desde sus ventas con una agregacion.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../src/app.js';
import { Client } from '../src/models/Client.js';
import { PriceList } from '../src/models/PriceList.js';
import { User } from '../src/models/User.js';
import { sembrar } from '../src/services/seed.service.js';

const USUARIO = 'dueno';
const PASSWORD = 'claveDePrueba123';
const HOY = '2026-09-21';

let token;
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
});

function conSesion(metodo, ruta) {
  return request(app)[metodo](ruta).set('Authorization', `Bearer ${token}`);
}

async function crearCliente(nombre) {
  const res = await conSesion('post', '/api/clients').send({ nombre });
  return res.body.cliente;
}

function vender(clientId, datos = {}) {
  return conSesion('post', '/api/sales').send({
    fecha: HOY,
    clientId,
    cantidad: 5000,
    listaPrecioId: String(listaNormal._id),
    ...datos,
  });
}

// ---------------------------------------------------------------------------

describe('Proteccion del modulo', () => {
  it('sin token no se ven los clientes', async () => {
    expect((await request(app).get('/api/clients')).status).toBe(401);
  });
});

describe('Alta y edicion', () => {
  it('crea con lo minimo: solo el nombre', async () => {
    const res = await conSesion('post', '/api/clients').send({ nombre: 'Juan Perez' });

    expect(res.status).toBe(201);
    expect(res.body.cliente.nombre).toBe('Juan Perez');
    expect(res.body.cliente.telefono).toBe('');
    expect(res.body.cliente.id).toBeDefined();
  });

  it('guarda el telefono como texto, sin perder el cero de adelante', async () => {
    const res = await conSesion('post', '/api/clients').send({
      nombre: 'Maria Gonzalez',
      telefono: '0981 123 456',
    });

    expect(res.body.cliente.telefono).toBe('0981 123 456');
  });

  it('rechaza un nombre demasiado corto', async () => {
    const res = await conSesion('post', '/api/clients').send({ nombre: 'A' });
    expect(res.status).toBe(400);
  });

  it('un PATCH parcial NO borra los otros campos', async () => {
    // Este es el bug que nos mordio en la fase 3: un .default() colado en el
    // esquema de editar vaciaba lo que no venia en el pedido.
    const creado = (
      await conSesion('post', '/api/clients').send({
        nombre: 'Juan Perez',
        telefono: '0981 111 222',
        notas: 'Paga a fin de mes',
      })
    ).body.cliente;

    const res = await conSesion('patch', `/api/clients/${creado.id}`).send({
      nombre: 'Juan Perez Gimenez',
    });

    expect(res.status).toBe(200);
    expect(res.body.cliente.nombre).toBe('Juan Perez Gimenez');
    expect(res.body.cliente.telefono).toBe('0981 111 222');
    expect(res.body.cliente.notas).toBe('Paga a fin de mes');
  });

  it('corregir el nombre se ve en sus ventas viejas (es referencia, no snapshot)', async () => {
    const cliente = await crearCliente('Juan Peres'); // con error de tipeo
    const venta = (await vender(cliente.id)).body.venta;

    await conSesion('patch', `/api/clients/${cliente.id}`).send({ nombre: 'Juan Perez' });

    const despues = (await conSesion('get', `/api/sales/${venta.id}`)).body.venta;
    expect(despues.cliente.nombre).toBe('Juan Perez');
  });
});

describe('Saldos — el dato calculado', () => {
  it('un cliente sin ventas arranca en cero', async () => {
    await crearCliente('Juan Perez');

    const res = await conSesion('get', '/api/clients');
    expect(res.body.clientes[0]).toMatchObject({
      porCobrar: 0,
      porEntregar: 0,
      ventasPendientes: 0,
    });
  });

  it('suma lo pendiente de varias ventas del mismo cliente', async () => {
    const cliente = await crearCliente('Juan Perez');
    await vender(cliente.id, { cantidad: 2000 }); // debe 2.000.000 y 2.000 ladrillos
    await vender(cliente.id, { cantidad: 3000, pagadoCompleto: true }); // solo ladrillos

    const res = await conSesion('get', '/api/clients');
    const juan = res.body.clientes.find((c) => c.nombre === 'Juan Perez');

    expect(juan.porCobrar).toBe(2_000_000);
    expect(juan.porEntregar).toBe(5000);
    expect(juan.ventasPendientes).toBe(2);
  });

  it('no mezcla los saldos de dos clientes', async () => {
    const juan = await crearCliente('Juan Perez');
    const maria = await crearCliente('Maria Gonzalez');

    await vender(juan.id, { cantidad: 1000 });
    await vender(maria.id, { cantidad: 4000 });

    const { clientes } = (await conSesion('get', '/api/clients')).body;
    expect(clientes.find((c) => c.nombre === 'Juan Perez').porCobrar).toBe(1_000_000);
    expect(clientes.find((c) => c.nombre === 'Maria Gonzalez').porCobrar).toBe(4_000_000);
  });

  it('el saldo baja solo al cobrar: no hay ningun total que actualizar', async () => {
    const cliente = await crearCliente('Juan Perez');
    const venta = (await vender(cliente.id, { cantidad: 5000 })).body.venta;

    await conSesion('post', `/api/sales/${venta.id}/pagos`).send({
      fecha: HOY,
      monto: 2_000_000,
    });

    const { clientes } = (await conSesion('get', '/api/clients')).body;
    expect(clientes[0].porCobrar).toBe(3_000_000);
  });

  it('y vuelve a subir al anular el pago', async () => {
    const cliente = await crearCliente('Juan Perez');
    const venta = (await vender(cliente.id, { pagadoCompleto: true })).body.venta;

    await conSesion('delete', `/api/sales/${venta.id}/pagos/${venta.pagos[0].id}`);

    const { clientes } = (await conSesion('get', '/api/clients')).body;
    expect(clientes[0].porCobrar).toBe(5_000_000);
  });

  it('?conSaldo=true deja solo a los que deben algo', async () => {
    const juan = await crearCliente('Juan Perez');
    await crearCliente('Maria Gonzalez'); // sin ventas
    await vender(juan.id);

    const res = await conSesion('get', '/api/clients?conSaldo=true');
    expect(res.body.clientes).toHaveLength(1);
    expect(res.body.clientes[0].nombre).toBe('Juan Perez');
  });
});

describe('Eliminar', () => {
  it('se puede si no tiene nada pendiente', async () => {
    const cliente = await crearCliente('Juan Perez');

    const res = await conSesion('delete', `/api/clients/${cliente.id}`);
    expect(res.status).toBe(200);

    // Soft delete: desaparece de la lista pero sigue en la base.
    expect((await conSesion('get', '/api/clients')).body.clientes).toHaveLength(0);
    expect(await Client.countDocuments({})).toBe(1);
  });

  it('NO se puede si debe plata', async () => {
    const cliente = await crearCliente('Juan Perez');
    await vender(cliente.id, { cantidad: 5000, entregadoCompleto: true });

    const res = await conSesion('delete', `/api/clients/${cliente.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/debe/i);
  });

  it('NO se puede si le faltan ladrillos', async () => {
    const cliente = await crearCliente('Juan Perez');
    await vender(cliente.id, { cantidad: 5000, pagadoCompleto: true });

    const res = await conSesion('delete', `/api/clients/${cliente.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ladrillos/i);
  });

  it('se puede una vez cerrada la venta', async () => {
    const cliente = await crearCliente('Juan Perez');
    await vender(cliente.id, {
      cantidad: 5000,
      pagadoCompleto: true,
      entregadoCompleto: true,
    });

    expect((await conSesion('delete', `/api/clients/${cliente.id}`)).status).toBe(200);
  });
});
