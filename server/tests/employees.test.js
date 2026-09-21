// -----------------------------------------------------------------------------
// employees.test.js — CRUD de empleados con soft delete
// -----------------------------------------------------------------------------
// Criterio de la fase 3: "Alta/edicion/baja de empleados desde el celular".
// Aca verificamos la parte de backend de eso, mas el detalle importante: que
// "baja" signifique MARCAR y no BORRAR.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../src/app.js';
import { Employee } from '../src/models/Employee.js';
import { User } from '../src/models/User.js';

const USUARIO = 'dueno';
const PASSWORD = 'claveDePrueba123';

let token;

beforeEach(async () => {
  await User.create({
    username: USUARIO,
    passwordHash: await User.hashearPassword(PASSWORD),
  });
  const res = await request(app).post('/api/auth/login').send({
    username: USUARIO,
    password: PASSWORD,
  });
  token = res.body.token;
});

/** Atajo: un pedido ya con el token puesto. */
function conSesion(metodo, ruta) {
  return request(app)[metodo](ruta).set('Authorization', `Bearer ${token}`);
}

async function crearEmpleado(datos = {}) {
  return conSesion('post', '/api/employees').send({
    nombre: 'Juan Perez',
    rol: 'cortador',
    tarifaPorMil: 150_000,
    ...datos,
  });
}

describe('Proteccion del modulo', () => {
  it('sin token no se puede listar', async () => {
    const res = await request(app).get('/api/employees');
    expect(res.status).toBe(401);
  });

  it('sin token no se puede crear', async () => {
    const res = await request(app).post('/api/employees').send({ nombre: 'X', tarifaPorMil: 1 });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/employees', () => {
  it('crea un empleado y devuelve 201', async () => {
    const res = await crearEmpleado();

    expect(res.status).toBe(201);
    expect(res.body.empleado.nombre).toBe('Juan Perez');
    expect(res.body.empleado.rol).toBe('cortador');
    expect(res.body.empleado.tarifaPorMil).toBe(150_000);
    expect(res.body.empleado.activo).toBe(true); // por defecto
    expect(res.body.empleado.deletedAt).toBe(null);
    expect(res.body.empleado.id).toBeTruthy();
    expect(res.body.empleado._id).toBeUndefined(); // _id se renombra a id
  });

  it('el rol es opcional', async () => {
    const res = await crearEmpleado({ rol: undefined });
    expect(res.status).toBe(201);
    expect(res.body.empleado.rol).toBe('');
  });

  it('limpia los espacios de sobra del nombre', async () => {
    const res = await crearEmpleado({ nombre: '   Ana Lopez   ' });
    expect(res.body.empleado.nombre).toBe('Ana Lopez');
  });

  it('rechaza una tarifa con decimales (el guarani no tiene centavos)', async () => {
    const res = await crearEmpleado({ tarifaPorMil: 150_000.5 });
    expect(res.status).toBe(400);
    expect(res.body.detalles.some((d) => d.campo === 'tarifaPorMil')).toBe(true);
  });

  it('rechaza una tarifa de cero o negativa', async () => {
    expect((await crearEmpleado({ tarifaPorMil: 0 })).status).toBe(400);
    expect((await crearEmpleado({ tarifaPorMil: -100 })).status).toBe(400);
  });

  it('rechaza una tarifa mandada como texto', async () => {
    // Un error tipico del frontend: mandar "150000" en vez de 150000.
    const res = await crearEmpleado({ tarifaPorMil: '150000' });
    expect(res.status).toBe(400);
  });

  it('rechaza un nombre vacio o demasiado corto', async () => {
    expect((await crearEmpleado({ nombre: '' })).status).toBe(400);
    expect((await crearEmpleado({ nombre: 'A' })).status).toBe(400);
  });
});

describe('GET /api/employees', () => {
  it('devuelve lista vacia cuando no hay nadie', async () => {
    const res = await conSesion('get', '/api/employees');
    expect(res.status).toBe(200);
    expect(res.body.empleados).toEqual([]);
  });

  it('ordena primero los activos y despues por nombre', async () => {
    await crearEmpleado({ nombre: 'Zulma' });
    await crearEmpleado({ nombre: 'Ana' });
    await crearEmpleado({ nombre: 'Beto', activo: false });

    const res = await conSesion('get', '/api/employees');
    const nombres = res.body.empleados.map((e) => e.nombre);

    expect(nombres).toEqual(['Ana', 'Zulma', 'Beto']);
  });

  it('con ?activo=true trae solo los activos', async () => {
    await crearEmpleado({ nombre: 'Activa' });
    await crearEmpleado({ nombre: 'Inactivo', activo: false });

    const res = await conSesion('get', '/api/employees?activo=true');

    expect(res.body.empleados).toHaveLength(1);
    expect(res.body.empleados[0].nombre).toBe('Activa');
  });

  it('rechaza un filtro que no existe', async () => {
    const res = await conSesion('get', '/api/employees?activo=quizas');
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/employees/:id', () => {
  it('cambia solo el campo que se manda', async () => {
    const { body } = await crearEmpleado();

    const res = await conSesion('patch', `/api/employees/${body.empleado.id}`).send({
      tarifaPorMil: 180_000,
    });

    expect(res.status).toBe(200);
    expect(res.body.empleado.tarifaPorMil).toBe(180_000);
    expect(res.body.empleado.nombre).toBe('Juan Perez'); // no se toco
    expect(res.body.empleado.rol).toBe('cortador'); // no se toco
  });

  it('permite desactivar sin eliminar', async () => {
    const { body } = await crearEmpleado();

    const res = await conSesion('patch', `/api/employees/${body.empleado.id}`).send({
      activo: false,
    });

    expect(res.body.empleado.activo).toBe(false);
    expect(res.body.empleado.deletedAt).toBe(null); // sigue vigente
  });

  it('rechaza un PATCH sin ningun campo', async () => {
    const { body } = await crearEmpleado();
    const res = await conSesion('patch', `/api/employees/${body.empleado.id}`).send({});
    expect(res.status).toBe(400);
  });

  it('rechaza valores invalidos al editar', async () => {
    const { body } = await crearEmpleado();
    const res = await conSesion('patch', `/api/employees/${body.empleado.id}`).send({
      tarifaPorMil: -5,
    });
    expect(res.status).toBe(400);
  });

  it('devuelve 404 si el id no existe', async () => {
    const res = await conSesion('patch', '/api/employees/6ab0a39a18ed3cc9f2d963e5').send({
      nombre: 'Nuevo',
    });
    expect(res.status).toBe(404);
  });

  it('devuelve 400 si el id tiene formato invalido', async () => {
    const res = await conSesion('patch', '/api/employees/esto-no-es-un-id').send({
      nombre: 'Nuevo',
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/employees/:id — soft delete', () => {
  it('marca deletedAt en vez de borrar el documento', async () => {
    const { body } = await crearEmpleado();

    const res = await conSesion('delete', `/api/employees/${body.empleado.id}`);
    expect(res.status).toBe(200);
    expect(res.body.empleado.deletedAt).not.toBe(null);

    // Lo importante: el documento SIGUE en la base.
    const enLaBase = await Employee.findById(body.empleado.id);
    expect(enLaBase).not.toBe(null);
    expect(enLaBase.nombre).toBe('Juan Perez');
    expect(enLaBase.deletedAt).toBeInstanceOf(Date);
  });

  it('el eliminado desaparece de la lista', async () => {
    const { body } = await crearEmpleado({ nombre: 'Se va' });
    await crearEmpleado({ nombre: 'Se queda' });

    await conSesion('delete', `/api/employees/${body.empleado.id}`);

    const res = await conSesion('get', '/api/employees');
    expect(res.body.empleados).toHaveLength(1);
    expect(res.body.empleados[0].nombre).toBe('Se queda');
  });

  it('no se puede editar un empleado ya eliminado', async () => {
    const { body } = await crearEmpleado();
    await conSesion('delete', `/api/employees/${body.empleado.id}`);

    const res = await conSesion('patch', `/api/employees/${body.empleado.id}`).send({
      nombre: 'Zombie',
    });
    expect(res.status).toBe(404);
  });

  it('no se puede eliminar dos veces', async () => {
    const { body } = await crearEmpleado();
    await conSesion('delete', `/api/employees/${body.empleado.id}`);

    const res = await conSesion('delete', `/api/employees/${body.empleado.id}`);
    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el id no existe', async () => {
    const res = await conSesion('delete', '/api/employees/6ab0a39a18ed3cc9f2d963e5');
    expect(res.status).toBe(404);
  });
});
