// -----------------------------------------------------------------------------
// semana.test.js — Las cuentas con fechas
// -----------------------------------------------------------------------------
// El plan pide explicitamente testear el "calculo de lunes/sabado de una
// semana". Son funciones puras, asi que estos tests no tocan la base y corren
// en milisegundos.
//
// Referencia: en 2026, el 21 de septiembre cae LUNES.
//   Lu 21 · Ma 22 · Mi 23 · Ju 24 · Vi 25 · Sa 26 · Do 27
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import {
  diaDeLaSemana,
  diasDeLaSemana,
  esDomingo,
  estaEnRango,
  lunesDeLaSemana,
  nombreDelDia,
  sabadoDeLaSemana,
  semanaDePago,
  sumarDias,
} from '../src/logic/semana.js';

describe('diaDeLaSemana', () => {
  it('identifica los dias correctamente', () => {
    expect(diaDeLaSemana('2026-09-21')).toBe(1); // lunes
    expect(diaDeLaSemana('2026-09-26')).toBe(6); // sabado
    expect(diaDeLaSemana('2026-09-27')).toBe(0); // domingo
  });

  it('NO se corre un dia por la zona horaria', () => {
    // Este es EL test que justifica todo el archivo. Con
    // `new Date('2026-09-21').getDay()` en Paraguay daria domingo (0) en vez
    // de lunes (1), porque esa expresion crea la medianoche UTC.
    expect(diaDeLaSemana('2026-09-21')).toBe(1);
    expect(nombreDelDia('2026-09-21')).toBe('Lunes');
    expect(nombreDelDia('2026-01-01')).toBe('Jueves');
    expect(nombreDelDia('2026-12-31')).toBe('Jueves');
  });

  it('rechaza formatos que no son YYYY-MM-DD', () => {
    expect(() => diaDeLaSemana('21/09/2026')).toThrow();
    expect(() => diaDeLaSemana('2026-9-21')).toThrow();
    expect(() => diaDeLaSemana(null)).toThrow();
  });
});

describe('semanaDePago — lunes a sabado (plan 5.9)', () => {
  it('desde el lunes', () => {
    expect(semanaDePago('2026-09-21')).toEqual({ inicio: '2026-09-21', fin: '2026-09-26' });
  });

  it('desde el miercoles', () => {
    expect(semanaDePago('2026-09-23')).toEqual({ inicio: '2026-09-21', fin: '2026-09-26' });
  });

  it('desde el sabado (el dia de pago)', () => {
    expect(semanaDePago('2026-09-26')).toEqual({ inicio: '2026-09-21', fin: '2026-09-26' });
  });

  it('el domingo cuenta para la semana que EMPIEZA, no la que termino', () => {
    // Decision explicada en logic/semana.js: la semana anterior ya se liquido
    // el sabado. Mandar el domingo hacia adelante hace que se pague el sabado
    // siguiente, en vez de quedar sin cobrar.
    expect(semanaDePago('2026-09-27')).toEqual({ inicio: '2026-09-28', fin: '2026-10-03' });
  });

  it('funciona cruzando el fin de mes', () => {
    expect(semanaDePago('2026-10-01')).toEqual({ inicio: '2026-09-28', fin: '2026-10-03' });
  });

  it('funciona cruzando el fin de ano', () => {
    // 2026-12-31 es jueves; su semana va del lunes 28 al sabado 2 de enero.
    expect(semanaDePago('2026-12-31')).toEqual({ inicio: '2026-12-28', fin: '2027-01-02' });
  });

  it('funciona en un ano bisiesto', () => {
    // 2028 es bisiesto: existe el 29 de febrero.
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(sumarDias('2028-02-29', 1)).toBe('2028-03-01');
    // Y 2027 NO lo es.
    expect(sumarDias('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('los atajos devuelven lo mismo', () => {
    expect(lunesDeLaSemana('2026-09-23')).toBe('2026-09-21');
    expect(sabadoDeLaSemana('2026-09-23')).toBe('2026-09-26');
  });
});

describe('diasDeLaSemana', () => {
  it('devuelve seis dias, de lunes a sabado, sin el domingo', () => {
    const dias = diasDeLaSemana('2026-09-23');

    expect(dias).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
    ]);
    expect(dias.some(esDomingo)).toBe(false);
  });
});

describe('sumarDias', () => {
  it('suma y resta', () => {
    expect(sumarDias('2026-09-21', 1)).toBe('2026-09-22');
    expect(sumarDias('2026-09-21', -1)).toBe('2026-09-20');
    expect(sumarDias('2026-09-21', 0)).toBe('2026-09-21');
  });

  it('cruza meses y anos', () => {
    expect(sumarDias('2026-09-30', 1)).toBe('2026-10-01');
    expect(sumarDias('2026-10-01', -1)).toBe('2026-09-30');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('estaEnRango', () => {
  it('compara textos y funciona igual que comparar fechas', () => {
    expect(estaEnRango('2026-09-23', '2026-09-21', '2026-09-26')).toBe(true);
    expect(estaEnRango('2026-09-21', '2026-09-21', '2026-09-26')).toBe(true); // inclusive
    expect(estaEnRango('2026-09-26', '2026-09-21', '2026-09-26')).toBe(true); // inclusive
    expect(estaEnRango('2026-09-20', '2026-09-21', '2026-09-26')).toBe(false);
    expect(estaEnRango('2026-09-27', '2026-09-21', '2026-09-26')).toBe(false);
  });
});
