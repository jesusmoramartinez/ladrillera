// -----------------------------------------------------------------------------
// productions.test.js — La produccion diaria
// -----------------------------------------------------------------------------
// Criterio de la fase 5 en el plan:
//
//   "Cargar 5.000 descuenta 0,2 camion de cada arcilla y suma 5.000 ladrillos"
//
// Ese es literalmente el primer test de este archivo.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../src/app.js';
import { Employee } from '../src/models/Employee.js';
import { InventoryMovement } from '../src/models/InventoryMovement.js';
import { Production } from '../src/models/Production.js';
import { User } from '../src/models/User.js';
import { sembrar } from '../src/services/seed.service.js';

const USUARIO = 'dueno';
const PASSWORD = 'claveDePrueba123';
const LUNES = '2026-09-21';

let token;
let juan;
let ana;

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

  juan = await Employee.create({ nombre: 'Juan', rol: 'cortador', tarifaPorMil: 150_000 });
  ana = await Employee.create({ nombre: 'Ana', rol: 'cargadora', tarifaPorMil: 180_000 });
});

function conSesion(metodo, ruta) {
  return request(app)[metodo](ruta).set('Authorization', `Bearer ${token}`);
}

function cargarProduccion(datos = {}) {
  return conSesion('post', '/api/productions').send({
    fecha: LUNES,
    cantidad: 5000,
    employeeIds: [String(juan._id)],
    ...datos,
  });
}

/** Compra arcilla para tener stock de donde descontar. */
async function comprarArcilla(camiones = 4) {
  for (const material of ['arcilla_pura', 'arcilla_floja']) {
    await conSesion('post', '/api/inventory/compras').send({
      material,
      cantidad: camiones,
      monto: 5_000_000,
      fecha: LUNES,
    });
  }
}

const stockActual = async () => (await conSesion('get', '/api/inventory')).body.stock;

// ---------------------------------------------------------------------------

describe('Proteccion del modulo', () => {
  it('sin token no se puede listar ni cargar', async () => {
    expect((await request(app).get('/api/productions')).status).toBe(401);
    expect((await request(app).post('/api/productions').send({})).status).toBe(401);
  });
});

describe('POST /api/productions — el criterio de la fase', () => {
  it('cargar 5.000 descuenta 0,2 camion de CADA arcilla y suma 5.000 ladrillos', async () => {
    await comprarArcilla(4); // 100.000 de cada una

    const res = await cargarProduccion({ cantidad: 5000 });
    expect(res.status).toBe(201);

    const stock = await stockActual();

    // Arcilla: 100.000 − 5.000 = 95.000 en las DOS.
    expect(stock.arcilla_pura.cantidad).toBe(95_000);
    expect(stock.arcilla_floja.cantidad).toBe(95_000);

    // Lo mismo, dicho en camiones: 4 − 0,2 = 3,8.
    expect(stock.arcilla_pura.camiones).toBe(3.8);
    expect(stock.arcilla_floja.camiones).toBe(3.8);

    // Y los ladrillos entraron al patio.
    expect(stock.ladrillos.fisico).toBe(5000);
  });

  it('la lena NO se toca (plan 5.6b)', async () => {
    await comprarArcilla();
    await conSesion('post', '/api/inventory/compras').send({
      material: 'lena',
      cantidad: 10,
      monto: 900_000,
      fecha: LUNES,
    });

    await cargarProduccion();

    expect((await stockActual()).lena.cantidad).toBe(10);
  });

  it('NO genera ningun movimiento de caja: los sueldos se pagan el sabado', async () => {
    await comprarArcilla();
    const cajaAntes = (await conSesion('get', '/api/transactions?mes=2026-09')).body;

    await cargarProduccion();

    const cajaDespues = (await conSesion('get', '/api/transactions?mes=2026-09')).body;
    expect(cajaDespues.movimientos).toHaveLength(cajaAntes.movimientos.length);
  });

  it('deja los tres movimientos en el historial de stock', async () => {
    await comprarArcilla();
    await cargarProduccion({ cantidad: 5000 });

    const movimientos = await InventoryMovement.find({ motivo: 'produccion' }).sort({ material: 1 });

    expect(movimientos).toHaveLength(3);
    expect(movimientos.map((m) => [m.material, m.cantidad])).toEqual([
      ['arcilla_floja', -5000],
      ['arcilla_pura', -5000],
      ['ladrillos', 5000],
    ]);
  });
});

describe('La cantidad se le asigna a CADA empleado (plan, seccion 1)', () => {
  it('no se reparte: con tres personas, cada una cobra por el total', async () => {
    await comprarArcilla();
    const pedro = await Employee.create({ nombre: 'Pedro', tarifaPorMil: 150_000 });

    const res = await cargarProduccion({
      cantidad: 5000,
      employeeIds: [String(juan._id), String(ana._id), String(pedro._id)],
    });

    const { trabajadores } = res.body.produccion;
    expect(trabajadores).toHaveLength(3);

    // Juan: 5.000 / 1.000 x 150.000 = 750.000 (NO 250.000)
    expect(trabajadores.find((t) => t.nombre === 'Juan').monto).toBe(750_000);
    expect(trabajadores.find((t) => t.nombre === 'Pedro').monto).toBe(750_000);
    // Ana cobra mas porque su tarifa es mayor: 5.000 / 1.000 x 180.000
    expect(trabajadores.find((t) => t.nombre === 'Ana').monto).toBe(900_000);

    expect(res.body.manoDeObra).toBe(2_400_000);
  });

  it('calcula proporcional para menos de mil ladrillos', async () => {
    await comprarArcilla();

    const res = await cargarProduccion({ cantidad: 500 });
    // 500 / 1.000 x 150.000 = 75.000
    expect(res.body.produccion.trabajadores[0].monto).toBe(75_000);
  });
});

describe('Snapshot de la tarifa (plan, seccion 4.3)', () => {
  it('guarda nombre y tarifa del momento dentro de la produccion', async () => {
    await comprarArcilla();
    const res = await cargarProduccion();

    const trabajador = res.body.produccion.trabajadores[0];
    expect(trabajador.nombre).toBe('Juan');
    expect(trabajador.tarifaPorMil).toBe(150_000);
    expect(trabajador.employeeId).toBe(String(juan._id));
  });

  it('subir la tarifa NO cambia las producciones ya cargadas', async () => {
    await comprarArcilla();
    await cargarProduccion({ cantidad: 5000 }); // con tarifa 150.000

    // En octubre le suben la tarifa.
    await conSesion('patch', `/api/employees/${juan._id}`).send({ tarifaPorMil: 200_000 });

    const semana = (await conSesion('get', `/api/productions?semana=${LUNES}`)).body;
    const trabajador = semana.producciones[0].trabajadores[0];

    // La produccion vieja sigue con la tarifa vieja.
    expect(trabajador.tarifaPorMil).toBe(150_000);
    expect(trabajador.monto).toBe(750_000);

    // Pero una produccion nueva usa la tarifa nueva.
    const nueva = await cargarProduccion({ fecha: '2026-09-22', cantidad: 5000 });
    expect(nueva.body.produccion.trabajadores[0].tarifaPorMil).toBe(200_000);
    expect(nueva.body.produccion.trabajadores[0].monto).toBe(1_000_000);
  });

  it('eliminar al empleado NO rompe las producciones viejas', async () => {
    await comprarArcilla();
    await cargarProduccion();

    await conSesion('delete', `/api/employees/${juan._id}`);

    const semana = (await conSesion('get', `/api/productions?semana=${LUNES}`)).body;
    expect(semana.producciones[0].trabajadores[0].nombre).toBe('Juan');
    expect(semana.resumen.totalManoObra).toBe(750_000);
  });
});

describe('Validaciones', () => {
  it('exige al menos un empleado', async () => {
    const res = await cargarProduccion({ employeeIds: [] });
    expect(res.status).toBe(400);
  });

  it('rechaza cantidades con decimales, cero o negativas', async () => {
    await comprarArcilla();
    expect((await cargarProduccion({ cantidad: 1000.5 })).status).toBe(400);
    expect((await cargarProduccion({ cantidad: 0 })).status).toBe(400);
    expect((await cargarProduccion({ cantidad: -100 })).status).toBe(400);
  });

  it('frena una cantidad absurda (un cero de mas)', async () => {
    const res = await cargarProduccion({ cantidad: 5_000_000 });
    expect(res.status).toBe(400);
  });

  it('rechaza una fecha mal escrita', async () => {
    expect((await cargarProduccion({ fecha: '21/09/2026' })).status).toBe(400);
  });

  it('avisa si se marco a un empleado inactivo, con su nombre', async () => {
    await comprarArcilla();
    await conSesion('patch', `/api/employees/${ana._id}`).send({ activo: false });

    const res = await cargarProduccion({ employeeIds: [String(juan._id), String(ana._id)] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Ana');
  });

  it('rechaza un empleado que ya no existe', async () => {
    await conSesion('delete', `/api/employees/${ana._id}`);
    const res = await cargarProduccion({ employeeIds: [String(ana._id)] });
    expect(res.status).toBe(404);
  });

  it('marcar dos veces al mismo no lo cuenta doble', async () => {
    await comprarArcilla();
    const res = await cargarProduccion({
      employeeIds: [String(juan._id), String(juan._id)],
    });

    expect(res.status).toBe(201);
    expect(res.body.produccion.trabajadores).toHaveLength(1);
  });
});

describe('Sin arcilla suficiente: avisa, no bloquea (plan 5.7)', () => {
  it('deja cargar y el stock queda en negativo', async () => {
    // Sin comprar nada: el stock esta en cero.
    const res = await cargarProduccion({ cantidad: 5000 });

    expect(res.status).toBe(201);

    const stock = await stockActual();
    expect(stock.arcilla_pura.cantidad).toBe(-5000);
    expect(stock.ladrillos.fisico).toBe(5000);

    // Y la respuesta ya trae la alerta, para que la pantalla pueda avisar.
    expect(res.body.stock.alertaArcilla.alerta).toBe(true);
  });
});

describe('GET /api/productions — por semana', () => {
  it('devuelve la semana de lunes a sabado y su resumen', async () => {
    await comprarArcilla(10);

    await cargarProduccion({ fecha: '2026-09-21', cantidad: 5000 }); // lunes
    await cargarProduccion({ fecha: '2026-09-26', cantidad: 3000 }); // sabado
    await cargarProduccion({ fecha: '2026-09-27', cantidad: 1000 }); // domingo: otra semana
    await cargarProduccion({ fecha: '2026-09-20', cantidad: 9000 }); // domingo anterior: otra

    const res = await conSesion('get', '/api/productions?semana=2026-09-23');

    expect(res.body.semana).toEqual({ inicio: '2026-09-21', fin: '2026-09-26' });
    expect(res.body.producciones).toHaveLength(2);
    expect(res.body.resumen.totalLadrillos).toBe(8000);
  });

  it('el resumen agrupa por empleado y suma sus dias', async () => {
    await comprarArcilla(10);

    await cargarProduccion({
      fecha: '2026-09-21',
      cantidad: 5000,
      employeeIds: [String(juan._id), String(ana._id)],
    });
    await cargarProduccion({
      fecha: '2026-09-22',
      cantidad: 3000,
      employeeIds: [String(juan._id)],
    });

    const res = await conSesion('get', '/api/productions?semana=2026-09-21');
    const { porEmpleado } = res.body.resumen;

    const deJuan = porEmpleado.find((e) => e.nombre === 'Juan');
    expect(deJuan.dias).toBe(2);
    expect(deJuan.ladrillos).toBe(8000);
    expect(deJuan.monto).toBe(1_200_000); // (5000 + 3000) / 1000 x 150.000

    const deAna = porEmpleado.find((e) => e.nombre === 'Ana');
    expect(deAna.dias).toBe(1);
    expect(deAna.ladrillos).toBe(5000);
    expect(deAna.monto).toBe(900_000);
  });

  it('sin parametro usa la semana de hoy', async () => {
    const res = await conSesion('get', '/api/productions');
    expect(res.status).toBe(200);
    expect(res.body.semana.inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('DELETE /api/productions/:id — anulacion con reversion', () => {
  it('devuelve la arcilla y saca los ladrillos', async () => {
    await comprarArcilla(4); // 100.000 de cada una
    const creada = await cargarProduccion({ cantidad: 5000 });

    const res = await conSesion('delete', `/api/productions/${creada.body.produccion.id}`);
    expect(res.status).toBe(200);

    const stock = await stockActual();
    expect(stock.arcilla_pura.cantidad).toBe(100_000); // volvio
    expect(stock.arcilla_floja.cantidad).toBe(100_000);
    expect(stock.ladrillos.fisico).toBe(0); // se fueron
  });

  it('no borra el documento: lo marca (soft delete)', async () => {
    await comprarArcilla();
    const creada = await cargarProduccion();
    await conSesion('delete', `/api/productions/${creada.body.produccion.id}`);

    const enLaBase = await Production.findById(creada.body.produccion.id);
    expect(enLaBase).not.toBe(null);
    expect(enLaBase.deletedAt).toBeInstanceOf(Date);
    expect(enLaBase.cantidad).toBe(5000);
  });

  it('desaparece del listado de la semana', async () => {
    await comprarArcilla();
    const creada = await cargarProduccion();
    await conSesion('delete', `/api/productions/${creada.body.produccion.id}`);

    const res = await conSesion('get', `/api/productions?semana=${LUNES}`);
    expect(res.body.producciones).toHaveLength(0);
    expect(res.body.resumen.totalLadrillos).toBe(0);
  });

  it('el historial de stock cuenta las dos cosas', async () => {
    await comprarArcilla();
    const creada = await cargarProduccion();
    await conSesion('delete', `/api/productions/${creada.body.produccion.id}`);

    const anulaciones = await InventoryMovement.find({ motivo: 'anulacion' });
    expect(anulaciones).toHaveLength(3);

    const porMaterial = Object.fromEntries(anulaciones.map((m) => [m.material, m.cantidad]));
    expect(porMaterial.arcilla_pura).toBe(5000); // devuelta
    expect(porMaterial.arcilla_floja).toBe(5000);
    expect(porMaterial.ladrillos).toBe(-5000); // sacados
  });

  it('no se puede anular dos veces', async () => {
    await comprarArcilla();
    const creada = await cargarProduccion();
    const id = creada.body.produccion.id;

    expect((await conSesion('delete', `/api/productions/${id}`)).status).toBe(200);
    expect((await conSesion('delete', `/api/productions/${id}`)).status).toBe(404);
  });

  it('NO se puede anular si la semana ya se liquido (plan 5.9)', async () => {
    await comprarArcilla();
    const creada = await cargarProduccion();

    // Simulamos que la fase 8 ya la liquido.
    await Production.updateOne(
      { _id: creada.body.produccion.id },
      { payrollId: '6ab0a39a18ed3cc9f2d963e5' },
    );

    const res = await conSesion('delete', `/api/productions/${creada.body.produccion.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/liquidada/i);
  });

  it('devuelve 404 si el id no existe', async () => {
    const res = await conSesion('delete', '/api/productions/6ab0a39a18ed3cc9f2d963e5');
    expect(res.status).toBe(404);
  });
});

describe('Transaccion: todo o nada', () => {
  it('si falla a mitad de camino, no queda arcilla descontada ni ladrillos sumados', async () => {
    await comprarArcilla(4); // 100.000 de cada arcilla

    // Guardar una produccion toca el stock tres veces, en este orden:
    //   1ra) arcilla pura      2da) arcilla floja      3ra) ladrillos
    //
    // Reemplazamos Inventory.updateOne por una version que deja pasar las dos
    // primeras y explota en la tercera. O sea: la arcilla YA se descontó
    // cuando aparece el error.
    //
    // Sin transaccion, el resultado seria material gastado sin ladrillos
    // hechos. Con transaccion, la base deshace todo sola.
    const { Inventory } = await import('../src/models/Inventory.js');
    const original = Inventory.updateOne.bind(Inventory);
    let llamadas = 0;

    Inventory.updateOne = (...args) => {
      llamadas += 1;
      if (llamadas === 3) throw new Error('fallo simulado al sumar los ladrillos');
      return original(...args);
    };

    try {
      const res = await cargarProduccion({ cantidad: 5000 });
      expect(res.status).toBe(500);
    } finally {
      // Se restaura si o si, aunque el test falle: si no, los tests que
      // siguen heredarian el modelo roto.
      Inventory.updateOne = original;
    }

    // Lo importante: todo quedo como estaba.
    const stock = await stockActual();
    expect(stock.arcilla_pura.cantidad).toBe(100_000);
    expect(stock.arcilla_floja.cantidad).toBe(100_000);
    expect(stock.ladrillos.fisico).toBe(0);
    expect(await Production.countDocuments()).toBe(0);
  });
});
