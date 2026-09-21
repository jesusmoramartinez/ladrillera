// -----------------------------------------------------------------------------
// sales-logic.test.js — Las cuentas de una venta
// -----------------------------------------------------------------------------
// El plan pide explicitamente testear "estados de venta (pago/entrega
// parcial)", "total con lista de precio y descuento % / Gs" y
// "fisico/comprometido/libre". Todo eso son funciones puras, asi que estos
// tests no tocan la base y corren en milisegundos.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { stockLadrillos } from '../src/logic/inventory.js';
import {
  avisoEntregaSinStock,
  avisoVentaSinStock,
  calcularDescuentoGs,
  calcularTotales,
  estadoDeEntrega,
  estadoDePago,
  resumenVenta,
  sumarVigentes,
} from '../src/logic/sales.js';

describe('calcularTotales — el ejemplo del plan (5.7)', () => {
  it('5.000 ladrillos a 1.000.000 el millar con 10 % da 4.500.000', () => {
    expect(
      calcularTotales({
        cantidad: 5000,
        precioPorMil: 1_000_000,
        descuento: { tipo: 'porcentaje', valor: 10 },
      }),
    ).toEqual({ subtotal: 5_000_000, descuentoGs: 500_000, montoTotal: 4_500_000 });
  });

  it('sin descuento, el total es el subtotal', () => {
    expect(calcularTotales({ cantidad: 5000, precioPorMil: 1_000_000 })).toEqual({
      subtotal: 5_000_000,
      descuentoGs: 0,
      montoTotal: 5_000_000,
    });
  });

  it('con descuento en guaranies, se resta tal cual', () => {
    expect(
      calcularTotales({
        cantidad: 5000,
        precioPorMil: 1_000_000,
        descuento: { tipo: 'monto', valor: 350_000 },
      }),
    ).toEqual({ subtotal: 5_000_000, descuentoGs: 350_000, montoTotal: 4_650_000 });
  });

  it('es proporcional para menos de mil ladrillos', () => {
    // 500 ladrillos a 800.000 el millar -> 400.000 (plan, 5.7)
    expect(calcularTotales({ cantidad: 500, precioPorMil: 800_000 }).montoTotal).toBe(400_000);
  });

  it('el resultado SIEMPRE es entero, aunque la cuenta no de exacta', () => {
    // 333 x 1.000.000 / 1000 = 333.000 justo; probemos uno feo:
    // 777 ladrillos a 850.000 el millar = 660.450
    const { subtotal, descuentoGs, montoTotal } = calcularTotales({
      cantidad: 777,
      precioPorMil: 850_000,
      descuento: { tipo: 'porcentaje', valor: 7 },
    });

    expect(Number.isInteger(subtotal)).toBe(true);
    expect(Number.isInteger(descuentoGs)).toBe(true);
    expect(Number.isInteger(montoTotal)).toBe(true);
    expect(subtotal).toBe(660_450);
    expect(descuentoGs).toBe(46_232); // 660450 x 7 / 100 = 46231,5 -> 46232
    expect(montoTotal).toBe(614_218);
  });

  it('un 100 % de descuento deja el total en cero, no en negativo', () => {
    expect(
      calcularTotales({
        cantidad: 1000,
        precioPorMil: 900_000,
        descuento: { tipo: 'porcentaje', valor: 100 },
      }).montoTotal,
    ).toBe(0);
  });
});

describe('calcularDescuentoGs — lo que NO se acepta', () => {
  it('rechaza un porcentaje fuera de 0 a 100', () => {
    expect(() => calcularDescuentoGs(1000, { tipo: 'porcentaje', valor: 101 })).toThrow();
    expect(() => calcularDescuentoGs(1000, { tipo: 'porcentaje', valor: -1 })).toThrow();
  });

  it('rechaza un descuento en guaranies mayor al subtotal', () => {
    // Si se aceptara, la fabrica le estaria pagando al cliente.
    expect(() => calcularDescuentoGs(1_000_000, { tipo: 'monto', valor: 1_500_000 })).toThrow();
  });

  it('rechaza un tipo desconocido', () => {
    expect(() => calcularDescuentoGs(1000, { tipo: 'regalo', valor: 5 })).toThrow();
  });

  it('sin descuento devuelve cero', () => {
    expect(calcularDescuentoGs(1000, null)).toBe(0);
  });
});

describe('sumarVigentes — los anulados no cuentan', () => {
  it('saltea las lineas con deletedAt', () => {
    const pagos = [
      { monto: 1_000_000, deletedAt: null },
      { monto: 500_000, deletedAt: new Date() }, // anulado
      { monto: 250_000, deletedAt: null },
    ];
    expect(sumarVigentes(pagos, 'monto')).toBe(1_250_000);
  });

  it('con lista vacia o sin lista devuelve cero', () => {
    expect(sumarVigentes([], 'monto')).toBe(0);
    expect(sumarVigentes(undefined, 'monto')).toBe(0);
  });
});

describe('estadoDePago', () => {
  it('sin pagos es pendiente', () => {
    expect(estadoDePago(1_000_000, 0)).toBe('pendiente');
  });

  it('con una parte es parcial', () => {
    expect(estadoDePago(1_000_000, 400_000)).toBe('parcial');
  });

  it('completo es pagado', () => {
    expect(estadoDePago(1_000_000, 1_000_000)).toBe('pagado');
  });

  it('una venta de total cero nace pagada, no pendiente', () => {
    // Si preguntaramos primero por el cero, esta venta quedaria para siempre
    // en la lista de deudores por una deuda de cero guaranies.
    expect(estadoDePago(0, 0)).toBe('pagado');
  });
});

describe('estadoDeEntrega', () => {
  it('recorre los tres estados', () => {
    expect(estadoDeEntrega(5000, 0)).toBe('pendiente');
    expect(estadoDeEntrega(5000, 2000)).toBe('parcial');
    expect(estadoDeEntrega(5000, 5000)).toBe('entregado');
  });
});

describe('resumenVenta — pago y entrega parciales e independientes', () => {
  it('calcula las dos cosas por separado', () => {
    const venta = {
      cantidad: 5000,
      montoTotal: 4_500_000,
      pagos: [{ monto: 2_000_000, deletedAt: null }],
      entregas: [
        { cantidad: 1000, deletedAt: null },
        { cantidad: 2000, deletedAt: null },
      ],
    };

    expect(resumenVenta(venta)).toEqual({
      cobrado: 2_000_000,
      porCobrar: 2_500_000,
      estadoPago: 'parcial',
      entregado: 3000,
      porEntregar: 2000,
      estadoEntrega: 'parcial',
    });
  });

  it('una venta puede estar pagada y sin entregar', () => {
    const venta = {
      cantidad: 5000,
      montoTotal: 4_500_000,
      pagos: [{ monto: 4_500_000, deletedAt: null }],
      entregas: [],
    };

    const r = resumenVenta(venta);
    expect(r.estadoPago).toBe('pagado');
    expect(r.estadoEntrega).toBe('pendiente');
    expect(r.porEntregar).toBe(5000);
  });

  it('anular un pago devuelve la venta a pendiente, sin tocar ningun total', () => {
    const venta = {
      cantidad: 5000,
      montoTotal: 4_500_000,
      pagos: [{ monto: 4_500_000, deletedAt: new Date() }], // anulado
      entregas: [],
    };

    expect(resumenVenta(venta).cobrado).toBe(0);
    expect(resumenVenta(venta).estadoPago).toBe('pendiente');
  });
});

describe('fisico / comprometido / libre (plan, 5.7)', () => {
  it('libre es fisico menos comprometido', () => {
    expect(stockLadrillos(20_000, 5_000)).toEqual({
      fisico: 20_000,
      comprometido: 5_000,
      libre: 15_000,
    });
  });

  it('el libre PUEDE ser negativo, y eso es informacion, no un error', () => {
    // Significa que hay mas vendido que fabricado: hay que reponer antes de
    // las entregas.
    expect(stockLadrillos(3_000, 10_000).libre).toBe(-7_000);
  });

  it('sin ventas, libre es igual a fisico', () => {
    expect(stockLadrillos(8_000).libre).toBe(8_000);
  });
});

describe('avisos de stock — avisan, no bloquean', () => {
  it('vender mas que el libre avisa y dice cuantos faltan', () => {
    expect(avisoVentaSinStock(10_000, 4_000)).toEqual({
      aviso: true,
      libre: 4_000,
      faltan: 6_000,
    });
  });

  it('vender dentro del libre no avisa', () => {
    expect(avisoVentaSinStock(3_000, 4_000).aviso).toBe(false);
  });

  it('entregar mas que el fisico avisa', () => {
    expect(avisoEntregaSinStock(5_000, 2_000)).toEqual({
      aviso: true,
      fisico: 2_000,
      faltan: 3_000,
    });
  });

  it('con libre negativo, faltan nunca queda al reves', () => {
    expect(avisoVentaSinStock(1_000, -500).faltan).toBe(1_500);
  });
});
