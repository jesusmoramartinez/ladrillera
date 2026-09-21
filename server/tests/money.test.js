// -----------------------------------------------------------------------------
// money.test.js — Tests de las cuentas de plata
// -----------------------------------------------------------------------------
// Estos son los tests mas baratos y mas valiosos del proyecto: las funciones de
// logic/ son puras (entran numeros, salen numeros), asi que no hace falta base
// de datos ni servidor. Corren en milisegundos.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { esMontoGsValido, montoPorMil, redondearGs } from '../src/logic/money.js';

describe('redondearGs', () => {
  it('redondea al guarani mas cercano', () => {
    expect(redondearGs(1500.4)).toBe(1500);
    expect(redondearGs(1500.5)).toBe(1501);
    expect(redondearGs(1500.6)).toBe(1501);
  });

  it('deja los enteros como estan', () => {
    expect(redondearGs(1_500_000)).toBe(1_500_000);
    expect(redondearGs(0)).toBe(0);
  });

  it('rechaza lo que no es un numero', () => {
    expect(() => redondearGs('1000')).toThrow();
    expect(() => redondearGs(NaN)).toThrow();
    expect(() => redondearGs(Infinity)).toThrow();
    expect(() => redondearGs(undefined)).toThrow();
  });
});

describe('montoPorMil', () => {
  it('calcula el caso exacto: 1.000 ladrillos a la tarifa completa', () => {
    expect(montoPorMil(1000, 150_000)).toBe(150_000);
  });

  it('es proporcional para MAS de mil', () => {
    // 5.000 ladrillos a 150.000 el millar
    expect(montoPorMil(5000, 150_000)).toBe(750_000);
  });

  it('es proporcional para MENOS de mil (plan 5.7)', () => {
    expect(montoPorMil(500, 800_000)).toBe(400_000);
    expect(montoPorMil(250, 800_000)).toBe(200_000);
    expect(montoPorMil(1, 150_000)).toBe(150);
  });

  it('devuelve siempre un entero, aunque la division no de exacta', () => {
    // 333 x 150.000 / 1000 = 49.950 justo; probemos uno que no cierre:
    const resultado = montoPorMil(333, 100_001);
    expect(Number.isInteger(resultado)).toBe(true);
    expect(resultado).toBe(33_300); // 33.300,333 -> 33.300
  });

  it('ejemplo del plan: venta de 5.000 a 1.000.000 el millar', () => {
    expect(montoPorMil(5000, 1_000_000)).toBe(5_000_000);
  });

  it('con cantidad cero da cero', () => {
    expect(montoPorMil(0, 150_000)).toBe(0);
  });

  it('rechaza cantidades o precios negativos', () => {
    expect(() => montoPorMil(-1, 150_000)).toThrow();
    expect(() => montoPorMil(1000, -5)).toThrow();
  });

  it('no arrastra el error de coma flotante de JavaScript', () => {
    // La trampa clasica: (0.1 + 0.2) !== 0.3 en JS.
    // Si calcularamos cantidad/1000 primero, 2100/1000 = 2.1000000000000005.
    // Multiplicando primero, el resultado es exacto.
    expect(montoPorMil(2100, 70_000)).toBe(147_000);
    expect(montoPorMil(700, 30_000)).toBe(21_000);
  });
});

describe('esMontoGsValido', () => {
  it('acepta enteros no negativos', () => {
    expect(esMontoGsValido(0)).toBe(true);
    expect(esMontoGsValido(1_500_000)).toBe(true);
  });

  it('rechaza decimales, negativos y basura', () => {
    expect(esMontoGsValido(1500.5)).toBe(false);
    expect(esMontoGsValido(-1)).toBe(false);
    expect(esMontoGsValido('1000')).toBe(false);
    expect(esMontoGsValido(NaN)).toBe(false);
    expect(esMontoGsValido(null)).toBe(false);
  });

  it('rechaza numeros mas grandes de lo que JS maneja con exactitud', () => {
    expect(esMontoGsValido(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(esMontoGsValido(Number.MAX_SAFE_INTEGER + 2)).toBe(false);
  });
});
