// -----------------------------------------------------------------------------
// payroll-logic.test.js — La cuenta del sueldo, y el telefono para WhatsApp
// -----------------------------------------------------------------------------
// El plan pide explicitamente testear "liquidacion con adelanto mayor a lo
// ganado". Ese es el caso que mas importa, porque es el unico donde el neto y
// la deuda se separan.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { armarLiquidacion, calcularNeto, detalleDiario } from '../src/logic/payroll.js';
import { aFormatoWhatsApp, linkWhatsApp, sirveParaWhatsApp } from '../src/logic/telefono.js';
import { textoDelTicket } from '../src/logic/ticket.js';

describe('calcularNeto — el caso normal', () => {
  it('bruto sin adelantos ni deuda: cobra todo', () => {
    expect(calcularNeto({ bruto: 1_620_000 })).toEqual({
      resultado: 1_620_000,
      neto: 1_620_000,
      deudaNueva: 0,
    });
  });

  it('descuenta los adelantos', () => {
    expect(calcularNeto({ bruto: 1_620_000, adelantos: 500_000 })).toEqual({
      resultado: 1_120_000,
      neto: 1_120_000,
      deudaNueva: 0,
    });
  });

  it('descuenta tambien la deuda de la semana anterior', () => {
    expect(calcularNeto({ bruto: 1_000_000, adelantos: 200_000, deudaAnterior: 300_000 })).toEqual({
      resultado: 500_000,
      neto: 500_000,
      deudaNueva: 0,
    });
  });
});

describe('calcularNeto — EL CASO DEL PLAN: adelanto mayor a lo ganado', () => {
  it('el neto se va a cero y la diferencia queda como deuda', () => {
    // Gano 600.000 pero ya le adelantaron 800.000.
    expect(calcularNeto({ bruto: 600_000, adelantos: 800_000 })).toEqual({
      resultado: -200_000,
      neto: 0, // esa semana no cobra nada
      deudaNueva: 200_000, // y arrastra 200.000
    });
  });

  it('el neto NUNCA es negativo: la plata solo va en una direccion', () => {
    const r = calcularNeto({ bruto: 0, adelantos: 1_000_000 });
    expect(r.neto).toBe(0);
    expect(r.deudaNueva).toBe(1_000_000);
  });

  it('una semana sin trabajar arrastra toda la deuda anterior', () => {
    expect(calcularNeto({ bruto: 0, deudaAnterior: 200_000 })).toEqual({
      resultado: -200_000,
      neto: 0,
      deudaNueva: 200_000,
    });
  });

  it('la deuda se va achicando a medida que trabaja', () => {
    // Semana 1: se pasa por 200.000
    const s1 = calcularNeto({ bruto: 600_000, adelantos: 800_000 });
    expect(s1.deudaNueva).toBe(200_000);

    // Semana 2: trabaja normal, y la deuda de la 1 es su deudaAnterior
    const s2 = calcularNeto({ bruto: 900_000, deudaAnterior: s1.deudaNueva });
    expect(s2.neto).toBe(700_000);
    expect(s2.deudaNueva).toBe(0);
  });

  it('exacto: si el adelanto iguala al bruto, no cobra ni debe', () => {
    expect(calcularNeto({ bruto: 500_000, adelantos: 500_000 })).toEqual({
      resultado: 0,
      neto: 0,
      deudaNueva: 0,
    });
  });
});

describe('calcularNeto — lo que no acepta', () => {
  it('rechaza montos negativos o rotos', () => {
    expect(() => calcularNeto({ bruto: -1 })).toThrow();
    expect(() => calcularNeto({ bruto: 1000.5 })).toThrow();
    expect(() => calcularNeto({ bruto: NaN })).toThrow();
  });
});

describe('detalleDiario', () => {
  const producciones = [
    {
      fecha: '2026-09-21',
      cantidad: 5000,
      trabajadores: [
        { employeeId: 'ana', monto: 900_000 },
        { employeeId: 'juan', monto: 750_000 },
      ],
    },
    {
      fecha: '2026-09-23',
      cantidad: 4000,
      trabajadores: [{ employeeId: 'ana', monto: 720_000 }],
    },
  ];

  it('trae solo los dias de ese empleado, ordenados', () => {
    expect(detalleDiario(producciones, 'ana')).toEqual([
      { fecha: '2026-09-21', cantidad: 5000, monto: 900_000 },
      { fecha: '2026-09-23', cantidad: 4000, monto: 720_000 },
    ]);

    expect(detalleDiario(producciones, 'juan')).toEqual([
      { fecha: '2026-09-21', cantidad: 5000, monto: 750_000 },
    ]);
  });

  it('junta dos producciones del MISMO dia en una sola linea', () => {
    const dobles = [
      { fecha: '2026-09-21', cantidad: 3000, trabajadores: [{ employeeId: 'ana', monto: 540_000 }] },
      { fecha: '2026-09-21', cantidad: 2000, trabajadores: [{ employeeId: 'ana', monto: 360_000 }] },
    ];

    expect(detalleDiario(dobles, 'ana')).toEqual([
      { fecha: '2026-09-21', cantidad: 5000, monto: 900_000 },
    ]);
  });

  it('de alguien que no trabajo devuelve lista vacia, no error', () => {
    expect(detalleDiario(producciones, 'pedro')).toEqual([]);
  });
});

describe('armarLiquidacion', () => {
  const producciones = [
    {
      fecha: '2026-09-21',
      cantidad: 5000,
      trabajadores: [
        { employeeId: 'ana', monto: 900_000 },
        { employeeId: 'juan', monto: 750_000 },
      ],
    },
  ];
  const nombres = new Map([
    ['ana', 'Ana Benitez'],
    ['juan', 'Juan Ruiz'],
    ['pedro', 'Pedro Lopez'],
  ]);

  it('suma el bruto y resta los adelantos de cada uno', () => {
    const { detalle, totalAPagar } = armarLiquidacion({
      producciones,
      adelantos: [{ employeeId: 'ana', monto: 300_000 }],
      nombres,
    });

    const ana = detalle.find((d) => d.nombre === 'Ana Benitez');
    expect(ana).toMatchObject({
      ladrillos: 5000,
      bruto: 900_000,
      adelantos: 300_000,
      deudaAnterior: 0,
      neto: 600_000,
      deudaNueva: 0,
    });

    const juan = detalle.find((d) => d.nombre === 'Juan Ruiz');
    expect(juan.neto).toBe(750_000);

    expect(totalAPagar).toBe(1_350_000);
  });

  it('INCLUYE a quien no trabajo pero arrastra deuda', () => {
    // Si se lo salteara, su deuda desapareceria sin que nadie la haya pagado.
    const { detalle } = armarLiquidacion({
      producciones,
      adelantos: [],
      deudasAnteriores: new Map([['pedro', 200_000]]),
      nombres,
    });

    const pedro = detalle.find((d) => d.nombre === 'Pedro Lopez');
    expect(pedro).toMatchObject({
      ladrillos: 0,
      bruto: 0,
      deudaAnterior: 200_000,
      neto: 0,
      deudaNueva: 200_000, // sigue viajando
    });
  });

  it('INCLUYE a quien no trabajo pero recibio un adelanto', () => {
    const { detalle } = armarLiquidacion({
      producciones: [],
      adelantos: [{ employeeId: 'pedro', monto: 150_000 }],
      nombres,
    });

    expect(detalle).toHaveLength(1);
    expect(detalle[0]).toMatchObject({ bruto: 0, adelantos: 150_000, deudaNueva: 150_000 });
  });

  it('no cuenta dos veces a quien aparece en las tres listas', () => {
    const { detalle } = armarLiquidacion({
      producciones,
      adelantos: [{ employeeId: 'ana', monto: 100_000 }],
      deudasAnteriores: new Map([['ana', 50_000]]),
      nombres,
    });

    expect(detalle.filter((d) => d.nombre === 'Ana Benitez')).toHaveLength(1);
  });

  it('el total a pagar suma NETOS, no brutos', () => {
    // Los adelantos ya salieron de la caja cuando se dieron. Sumar brutos
    // seria pagarlos dos veces.
    const { totalAPagar } = armarLiquidacion({
      producciones,
      adelantos: [
        { employeeId: 'ana', monto: 900_000 },
        { employeeId: 'juan', monto: 750_000 },
      ],
      nombres,
    });

    expect(totalAPagar).toBe(0);
  });

  it('viene ordenado por nombre', () => {
    const { detalle } = armarLiquidacion({ producciones, adelantos: [], nombres });
    expect(detalle.map((d) => d.nombre)).toEqual(['Ana Benitez', 'Juan Ruiz']);
  });

  it('una semana sin nada da lista vacia y total cero', () => {
    expect(armarLiquidacion({ producciones: [], adelantos: [] })).toEqual({
      detalle: [],
      totalAPagar: 0,
    });
  });

  it('a quien ya no esta en la lista lo llama "Empleado eliminado"', () => {
    const { detalle } = armarLiquidacion({
      producciones,
      adelantos: [],
      nombres: new Map([['ana', 'Ana Benitez']]), // falta juan
    });

    expect(detalle.map((d) => d.nombre)).toContain('Empleado eliminado');
  });
});

// ---------------------------------------------------------------------------

describe('aFormatoWhatsApp — el telefono paraguayo', () => {
  it('saca el cero nacional y pone el codigo de pais', () => {
    // El cero de "0981" sirve para llamar dentro del pais y NO es parte del
    // numero. Dejarlo daria 5950981..., que no es el numero de nadie.
    expect(aFormatoWhatsApp('0981123456')).toBe('595981123456');
  });

  it('acepta los formatos que la gente escribe de verdad', () => {
    const esperado = '595981123456';
    expect(aFormatoWhatsApp('0981 123 456')).toBe(esperado);
    expect(aFormatoWhatsApp('0981-123-456')).toBe(esperado);
    expect(aFormatoWhatsApp('(0981) 123456')).toBe(esperado);
    expect(aFormatoWhatsApp('+595 981 123 456')).toBe(esperado);
    expect(aFormatoWhatsApp('595981123456')).toBe(esperado);
    expect(aFormatoWhatsApp('  0981123456  ')).toBe(esperado);
  });

  it('arregla el caso mixto: codigo de pais Y cero nacional', () => {
    expect(aFormatoWhatsApp('+5950981123456')).toBe('595981123456');
  });

  it('descarta lo que claramente no es un telefono', () => {
    expect(aFormatoWhatsApp('')).toBeNull();
    expect(aFormatoWhatsApp('   ')).toBeNull();
    expect(aFormatoWhatsApp('123')).toBeNull();
    expect(aFormatoWhatsApp('no tengo')).toBeNull();
    expect(aFormatoWhatsApp(null)).toBeNull();
    expect(aFormatoWhatsApp(undefined)).toBeNull();
    expect(aFormatoWhatsApp('9819819819819819')).toBeNull(); // demasiado largo
  });

  it('sirveParaWhatsApp contesta si el boton va habilitado', () => {
    expect(sirveParaWhatsApp('0981123456')).toBe(true);
    expect(sirveParaWhatsApp('')).toBe(false);
  });
});

describe('linkWhatsApp', () => {
  it('arma el link con el mensaje codificado', () => {
    const link = linkWhatsApp('0981123456', 'Hola Ana\nGs 1.000');

    expect(link.startsWith('https://wa.me/595981123456?text=')).toBe(true);
    // El salto de linea y los espacios van codificados: sin eso, el mensaje
    // llegaria cortado en el primer espacio.
    expect(link).toContain('%0A');
    expect(link).not.toContain(' ');
  });

  it('sin telefono valido devuelve null en vez de un link roto', () => {
    expect(linkWhatsApp('', 'hola')).toBeNull();
    expect(linkWhatsApp('123', 'hola')).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('textoDelTicket', () => {
  const semana = { inicio: '2026-09-21', fin: '2026-09-26' };

  const ana = {
    nombre: 'Ana Benitez',
    ladrillos: 9000,
    bruto: 1_620_000,
    adelantos: 500_000,
    deudaAnterior: 0,
    neto: 1_120_000,
    deudaNueva: 0,
    diario: [
      { fecha: '2026-09-21', cantidad: 5000, monto: 900_000 },
      { fecha: '2026-09-23', cantidad: 4000, monto: 720_000 },
    ],
  };

  it('arma el ticket completo, con los dias y las cuentas', () => {
    const texto = textoDelTicket({ semana, empleado: ana });

    expect(texto).toContain('Semana del 21/09 al 26/09');
    expect(texto).toContain('Ana Benitez');
    expect(texto).toContain('Lun 21/09: 5.000 ladrillos — Gs 900.000');
    expect(texto).toContain('Mie 23/09: 4.000 ladrillos — Gs 720.000');
    expect(texto).toContain('Total ladrillos: 9.000');
    expect(texto).toContain('Bruto: Gs 1.620.000');
    expect(texto).toContain('Adelantos: -Gs 500.000');
    // El numero que importa, en negrita de WhatsApp.
    expect(texto).toContain('*A cobrar: Gs 1.120.000*');
  });

  it('NO escribe las lineas que valen cero', () => {
    const sinAdelantos = { ...ana, adelantos: 0, neto: 1_620_000 };
    const texto = textoDelTicket({ semana, empleado: sinAdelantos });

    expect(texto).not.toContain('Adelantos');
    expect(texto).not.toContain('Saldo anterior');
  });

  it('EXPLICA el caso de cobrar cero y quedar debiendo', () => {
    // Es el momento en que el empleado mas necesita entender por que no le
    // toca plata. Un ticket que solo diga "A cobrar: Gs 0" genera una
    // discusion el sabado a la tarde.
    const texto = textoDelTicket({
      semana,
      empleado: {
        ...ana,
        bruto: 600_000,
        adelantos: 800_000,
        neto: 0,
        deudaNueva: 200_000,
      },
    });

    expect(texto).toContain('*A cobrar: Gs 0*');
    expect(texto).toContain('Queda un saldo de Gs 200.000');
    expect(texto).toContain('semana que viene');
  });

  it('funciona para quien no trabajo pero arrastra deuda', () => {
    const texto = textoDelTicket({
      semana,
      empleado: {
        nombre: 'Pedro Lopez',
        ladrillos: 0,
        bruto: 0,
        adelantos: 0,
        deudaAnterior: 200_000,
        neto: 0,
        deudaNueva: 200_000,
        diario: [],
      },
    });

    expect(texto).toContain('Sin produccion esta semana.');
    expect(texto).toContain('Saldo anterior: -Gs 200.000');
  });
});
