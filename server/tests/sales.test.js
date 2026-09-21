// -----------------------------------------------------------------------------
// sales.test.js — Ventas, pagos y entregas contra la API de verdad
// -----------------------------------------------------------------------------
// Criterio de la fase 6 en el plan: "Venta pagada hoy y entregada en 2 partes
// deja caja y stock correctos". Ese es el primer test de este archivo, y el
// resto son los bordes.
//
// Corren contra un MongoDB real levantado como replica set (setup-global.js),
// que es lo que permite probar las transacciones de verdad.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../src/app.js';
import { InventoryMovement } from '../src/models/InventoryMovement.js';
import { PriceList } from '../src/models/PriceList.js';
import { Sale } from '../src/models/Sale.js';
import { Transaction } from '../src/models/Transaction.js';
import { User } from '../src/models/User.js';
import { sembrar } from '../src/services/seed.service.js';

const USUARIO = 'dueno';
const PASSWORD = 'claveDePrueba123';
const HOY = '2026-09-21';

let token;
let listaNormal;
let cliente;

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

  // La lista "Normal" del seed vale 1.000.000 el millar.
  listaNormal = await PriceList.findOne({ nombre: 'Normal' });

  const res = await conSesion('post', '/api/clients').send({ nombre: 'Juan Perez' });
  cliente = res.body.cliente;
});

function conSesion(metodo, ruta) {
  return request(app)[metodo](ruta).set('Authorization', `Bearer ${token}`);
}

/** Pone ladrillos en el patio sin pasar por produccion. */
async function ponerLadrillos(cantidad) {
  await conSesion('post', '/api/inventory/ajustes').send({
    material: 'ladrillos',
    cantidadReal: cantidad,
    fecha: HOY,
  });
}

function vender(datos = {}) {
  return conSesion('post', '/api/sales').send({
    fecha: HOY,
    clientId: cliente.id,
    cantidad: 5000,
    listaPrecioId: String(listaNormal._id),
    ...datos,
  });
}

// ---------------------------------------------------------------------------

describe('Proteccion del modulo', () => {
  it('sin token no se ven las ventas', async () => {
    expect((await request(app).get('/api/sales')).status).toBe(401);
  });

  it('sin token no se puede vender', async () => {
    expect((await request(app).post('/api/sales').send({ cantidad: 1 })).status).toBe(401);
  });
});

describe('EL CRITERIO DE LA FASE: pagada hoy, entregada en dos partes', () => {
  it('deja la caja y el stock correctos', async () => {
    await ponerLadrillos(10_000);

    // 5.000 ladrillos a 1.000.000 el millar = 5.000.000, pagado completo.
    const venta = (await vender({ pagadoCompleto: true })).body.venta;

    expect(venta.montoTotal).toBe(5_000_000);
    expect(venta.estadoPago).toBe('pagado');
    expect(venta.porCobrar).toBe(0);
    expect(venta.estadoEntrega).toBe('pendiente');

    // --- La caja: un ingreso de 5.000.000 categoria "Venta" ---
    const ingresos = await Transaction.find({ tipo: 'ingreso', deletedAt: null });
    expect(ingresos).toHaveLength(1);
    expect(ingresos[0].monto).toBe(5_000_000);
    expect(ingresos[0].categoriaNombre).toBe('Venta');
    expect(ingresos[0].origen.tipo).toBe('pago_venta');

    // --- El stock: nada salio del patio todavia, pero esta comprometido ---
    let stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.ladrillos.fisico).toBe(10_000);
    expect(stock.ladrillos.comprometido).toBe(5_000);
    expect(stock.ladrillos.libre).toBe(5_000);

    // --- Primera entrega: 2.000 ---
    const e1 = await conSesion('post', `/api/sales/${venta.id}/entregas`).send({
      fecha: HOY,
      cantidad: 2000,
    });
    expect(e1.status).toBe(201);
    expect(e1.body.venta.estadoEntrega).toBe('parcial');
    expect(e1.body.venta.porEntregar).toBe(3000);

    stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.ladrillos.fisico).toBe(8_000); // salieron 2.000
    expect(stock.ladrillos.comprometido).toBe(3_000); // bajo solo
    expect(stock.ladrillos.libre).toBe(5_000); // no cambio: ya estaban apartados

    // --- Segunda entrega: los 3.000 que faltan ---
    const e2 = await conSesion('post', `/api/sales/${venta.id}/entregas`).send({
      fecha: '2026-09-23',
      cantidad: 3000,
    });
    expect(e2.body.venta.estadoEntrega).toBe('entregado');
    expect(e2.body.venta.porEntregar).toBe(0);

    stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.ladrillos.fisico).toBe(5_000);
    expect(stock.ladrillos.comprometido).toBe(0);
    expect(stock.ladrillos.libre).toBe(5_000);

    // La caja no se movio con las entregas: la plata entro al pagar.
    expect(await Transaction.countDocuments({ tipo: 'ingreso', deletedAt: null })).toBe(1);

    // Y el historial de stock tiene las dos salidas, con su motivo.
    const movimientos = await InventoryMovement.find({ motivo: 'entrega' }).sort({ createdAt: 1 });
    expect(movimientos.map((m) => m.cantidad)).toEqual([-2000, -3000]);
  });
});

describe('POST /api/sales — el precio lo calcula el servidor', () => {
  it('usa el precio de la lista y lo congela adentro de la venta', async () => {
    const venta = (await vender()).body.venta;

    expect(venta.precioPorMil).toBe(1_000_000);
    expect(venta.listaPrecioNombre).toBe('Normal');
    expect(venta.subtotal).toBe(5_000_000);
    expect(venta.montoTotal).toBe(5_000_000);
  });

  it('cambiar la lista DESPUES no cambia las ventas ya hechas (snapshot)', async () => {
    const venta = (await vender()).body.venta;

    await conSesion('patch', `/api/price-lists/${listaNormal._id}`).send({
      precioPorMil: 1_500_000,
    });

    const despues = (await conSesion('get', `/api/sales/${venta.id}`)).body.venta;
    expect(despues.precioPorMil).toBe(1_000_000);
    expect(despues.montoTotal).toBe(5_000_000);
  });

  it('aplica el descuento en porcentaje (ejemplo del plan)', async () => {
    const res = await vender({
      cantidad: 5000,
      descuento: { tipo: 'porcentaje', valor: 10 },
    });

    expect(res.body.venta.descuentoGs).toBe(500_000);
    expect(res.body.venta.montoTotal).toBe(4_500_000);
    // El "10 %" queda guardado, no solo su resultado.
    expect(res.body.venta.descuento).toEqual({ tipo: 'porcentaje', valor: 10 });
  });

  it('aplica el descuento en guaranies', async () => {
    const res = await vender({ descuento: { tipo: 'monto', valor: 350_000 } });
    expect(res.body.venta.montoTotal).toBe(4_650_000);
  });

  it('rechaza un porcentaje mayor a 100', async () => {
    const res = await vender({ descuento: { tipo: 'porcentaje', valor: 120 } });
    expect(res.status).toBe(400);
  });

  it('rechaza un descuento en guaranies mayor al subtotal', async () => {
    const res = await vender({ descuento: { tipo: 'monto', valor: 9_000_000 } });
    expect(res.status).toBe(400);
  });

  it('IGNORA un montoTotal mandado desde afuera', async () => {
    // Si el servidor confiara en el navegador, esta venta saldria 1 Gs.
    const res = await vender({ montoTotal: 1, subtotal: 1 });
    expect(res.body.venta.montoTotal).toBe(5_000_000);
  });
});

describe('El cliente es obligatorio si queda algo pendiente (plan 5.7)', () => {
  it('sin cliente y sin atajos, rechaza', async () => {
    const res = await vender({ clientId: null });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cliente/i);
  });

  it('sin cliente pero pagada y entregada en el acto, acepta', async () => {
    await ponerLadrillos(10_000);
    const res = await vender({
      clientId: null,
      pagadoCompleto: true,
      entregadoCompleto: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.venta.clientId).toBeNull();
    expect(res.body.venta.estadoPago).toBe('pagado');
    expect(res.body.venta.estadoEntrega).toBe('entregado');
  });

  it('pagada pero no entregada SI necesita cliente', async () => {
    const res = await vender({ clientId: null, pagadoCompleto: true });
    expect(res.status).toBe(400);
  });

  it('rechaza un cliente que no existe', async () => {
    const res = await vender({ clientId: '0123456789abcdef01234567' });
    expect(res.status).toBe(404);
  });
});

describe('Avisos de stock — avisan, no bloquean (plan 5.7)', () => {
  it('vender mas que el libre avisa pero guarda igual', async () => {
    await ponerLadrillos(2_000);

    const res = await vender({ cantidad: 5000 });

    expect(res.status).toBe(201);
    expect(res.body.aviso).toEqual({ aviso: true, libre: 2_000, faltan: 3_000 });
  });

  it('entregar mas que el fisico avisa pero guarda igual, y el stock queda negativo', async () => {
    await ponerLadrillos(1_000);
    const venta = (await vender({ cantidad: 5000 })).body.venta;

    const res = await conSesion('post', `/api/sales/${venta.id}/entregas`).send({
      fecha: HOY,
      cantidad: 3000,
    });

    expect(res.status).toBe(201);
    expect(res.body.aviso.aviso).toBe(true);
    expect(res.body.aviso.fisico).toBe(1_000);
    // El patio manda: si el camion cargo, cargo.
    expect(res.body.stock.ladrillos.fisico).toBe(-2_000);
  });

  it('una segunda venta ve el comprometido de la primera', async () => {
    await ponerLadrillos(10_000);
    await vender({ cantidad: 8000 });

    const res = await vender({ cantidad: 5000 });
    expect(res.body.aviso).toEqual({ aviso: true, libre: 2_000, faltan: 3_000 });
  });
});

describe('Pagos', () => {
  it('cobra en dos veces y el estado va acompanando', async () => {
    const venta = (await vender()).body.venta;

    const p1 = await conSesion('post', `/api/sales/${venta.id}/pagos`).send({
      fecha: HOY,
      monto: 2_000_000,
    });
    expect(p1.body.venta.estadoPago).toBe('parcial');
    expect(p1.body.venta.porCobrar).toBe(3_000_000);

    const p2 = await conSesion('post', `/api/sales/${venta.id}/pagos`).send({
      fecha: '2026-10-05',
      monto: 3_000_000,
    });
    expect(p2.body.venta.estadoPago).toBe('pagado');
    expect(p2.body.venta.porCobrar).toBe(0);
  });

  it('BLOQUEA cobrar mas de lo que falta', async () => {
    const venta = (await vender()).body.venta;

    const res = await conSesion('post', `/api/sales/${venta.id}/pagos`).send({
      fecha: HOY,
      monto: 6_000_000,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mas de lo que falta/i);
    // Y no se creo ningun ingreso fantasma.
    expect(await Transaction.countDocuments({ tipo: 'ingreso', deletedAt: null })).toBe(0);
  });

  it('BLOQUEA cobrar una venta ya saldada', async () => {
    const venta = (await vender({ pagadoCompleto: true })).body.venta;

    const res = await conSesion('post', `/api/sales/${venta.id}/pagos`).send({
      fecha: HOY,
      monto: 1_000,
    });
    expect(res.status).toBe(409);
  });

  it('el ingreso de caja lleva la fecha del PAGO, no la de la venta', async () => {
    // Plan 5.7: una venta de septiembre cobrada en octubre suma en octubre.
    const venta = (await vender()).body.venta;
    await conSesion('post', `/api/sales/${venta.id}/pagos`).send({
      fecha: '2026-10-05',
      monto: 5_000_000,
    });

    const septiembre = (await conSesion('get', '/api/transactions?mes=2026-09')).body;
    const octubre = (await conSesion('get', '/api/transactions?mes=2026-10')).body;

    expect(septiembre.balance.ingresos).toBe(0);
    expect(octubre.balance.ingresos).toBe(5_000_000);
  });

  it('anular un pago anula su ingreso y la deuda vuelve a aparecer', async () => {
    const venta = (await vender({ pagadoCompleto: true })).body.venta;
    const pagoId = venta.pagos[0].id;

    const res = await conSesion('delete', `/api/sales/${venta.id}/pagos/${pagoId}`);

    expect(res.status).toBe(200);
    expect(res.body.venta.estadoPago).toBe('pendiente');
    expect(res.body.venta.porCobrar).toBe(5_000_000);
    // El pago anulado ya no aparece en la lista.
    expect(res.body.venta.pagos).toHaveLength(0);

    // El ingreso quedo marcado, no borrado.
    expect(await Transaction.countDocuments({ tipo: 'ingreso', deletedAt: null })).toBe(0);
    expect(await Transaction.countDocuments({ tipo: 'ingreso' })).toBe(1);
  });

  it('no se puede anular dos veces el mismo pago', async () => {
    const venta = (await vender({ pagadoCompleto: true })).body.venta;
    const pagoId = venta.pagos[0].id;

    await conSesion('delete', `/api/sales/${venta.id}/pagos/${pagoId}`);
    const segunda = await conSesion('delete', `/api/sales/${venta.id}/pagos/${pagoId}`);
    expect(segunda.status).toBe(404);
  });

  it('el ingreso de una venta NO se puede anular desde Caja', async () => {
    await vender({ pagadoCompleto: true });
    const ingreso = await Transaction.findOne({ tipo: 'ingreso' });

    const res = await conSesion('delete', `/api/transactions/${ingreso._id}`);
    expect(res.status).toBe(400);
  });
});

describe('Entregas', () => {
  it('BLOQUEA entregar mas de lo vendido', async () => {
    const venta = (await vender({ cantidad: 5000 })).body.venta;

    const res = await conSesion('post', `/api/sales/${venta.id}/entregas`).send({
      fecha: HOY,
      cantidad: 6000,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mas de lo que falta/i);
  });

  it('anular una entrega devuelve los ladrillos al patio', async () => {
    await ponerLadrillos(10_000);
    const venta = (await vender({ cantidad: 5000, entregadoCompleto: true })).body.venta;

    expect((await conSesion('get', '/api/inventory')).body.stock.ladrillos.fisico).toBe(5_000);

    const entregaId = venta.entregas[0].id;
    const res = await conSesion('delete', `/api/sales/${venta.id}/entregas/${entregaId}`);

    expect(res.status).toBe(200);
    expect(res.body.venta.estadoEntrega).toBe('pendiente');
    expect(res.body.venta.porEntregar).toBe(5000);

    const stock = (await conSesion('get', '/api/inventory')).body.stock;
    expect(stock.ladrillos.fisico).toBe(10_000); // volvieron
    expect(stock.ladrillos.comprometido).toBe(5_000); // y se volvieron a apartar

    // El historial cuenta las dos cosas: la entrega y su anulacion.
    const movimientos = await InventoryMovement.find({ material: 'ladrillos' }).sort({
      createdAt: 1,
    });
    expect(movimientos.map((m) => m.motivo)).toEqual(['ajuste', 'entrega', 'anulacion']);
  });
});

describe('Anular la venta entera (plan 5.11)', () => {
  it('se puede si esta limpia', async () => {
    const venta = (await vender()).body.venta;

    const res = await conSesion('delete', `/api/sales/${venta.id}`);
    expect(res.status).toBe(200);

    // Desaparece de la lista, pero sigue en la base.
    expect((await conSesion('get', '/api/sales')).body.ventas).toHaveLength(0);
    expect(await Sale.countDocuments({})).toBe(1);

    // Y deja de comprometer stock.
    expect((await conSesion('get', '/api/inventory')).body.stock.ladrillos.comprometido).toBe(0);
  });

  it('NO se puede si tiene pagos', async () => {
    const venta = (await vender({ pagadoCompleto: true })).body.venta;
    const res = await conSesion('delete', `/api/sales/${venta.id}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/pagos/i);
  });

  it('se puede despues de anular sus pagos', async () => {
    const venta = (await vender({ pagadoCompleto: true })).body.venta;
    await conSesion('delete', `/api/sales/${venta.id}/pagos/${venta.pagos[0].id}`);

    expect((await conSesion('delete', `/api/sales/${venta.id}`)).status).toBe(200);
  });
});

describe('GET /api/sales — filtros', () => {
  beforeEach(async () => {
    await ponerLadrillos(50_000);
    // 1) pendiente de todo
    await vender({ cantidad: 1000 });
    // 2) pagada, falta entregar
    await vender({ cantidad: 2000, pagadoCompleto: true });
    // 3) entregada, falta cobrar
    await vender({ cantidad: 3000, entregadoCompleto: true });
    // 4) cerrada
    await vender({ cantidad: 4000, pagadoCompleto: true, entregadoCompleto: true });
  });

  it('sin filtro devuelve todas', async () => {
    const res = await conSesion('get', '/api/sales');
    expect(res.body.ventas).toHaveLength(4);
  });

  it('por-cobrar devuelve solo las que deben plata', async () => {
    const res = await conSesion('get', '/api/sales?estado=por-cobrar');
    expect(res.body.ventas.map((v) => v.cantidad).sort((a, b) => a - b)).toEqual([1000, 3000]);
  });

  it('por-entregar devuelve solo las que deben ladrillos', async () => {
    const res = await conSesion('get', '/api/sales?estado=por-entregar');
    expect(res.body.ventas.map((v) => v.cantidad).sort((a, b) => a - b)).toEqual([1000, 2000]);
  });

  it('devuelve los totales pendientes del sistema', async () => {
    const res = await conSesion('get', '/api/sales');
    // Falta cobrar: 1000 + 3000 ladrillos a 1.000.000 el millar = 4.000.000
    expect(res.body.totales.porCobrar).toBe(4_000_000);
    // Falta entregar: 1000 + 2000
    expect(res.body.totales.porEntregar).toBe(3000);
  });

  it('filtra por cliente', async () => {
    const otro = (await conSesion('post', '/api/clients').send({ nombre: 'Maria Gonzalez' })).body
      .cliente;
    await vender({ clientId: otro.id, cantidad: 7000 });

    const res = await conSesion('get', `/api/sales?cliente=${otro.id}`);
    expect(res.body.ventas).toHaveLength(1);
    expect(res.body.ventas[0].cantidad).toBe(7000);
    // Y viene con el cliente adentro, no solo su id.
    expect(res.body.ventas[0].cliente.nombre).toBe('Maria Gonzalez');
  });
});
