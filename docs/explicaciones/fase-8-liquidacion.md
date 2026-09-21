# Fase 8 — Liquidación semanal y tickets por WhatsApp

> La fase donde se juntan tres módulos: la **producción** (fase 5) da el bruto,
> los **adelantos** (fase 7) dan lo que ya cobró, y la **liquidación anterior**
> da la deuda arrastrada.
>
> Criterio del plan: *"Caso de prueba con deuda arrastrada da los números
> esperados"*. ✅ Cumplido y verificado.
>
> Decisión tuya, que estaba abierta en el plan: el ticket se manda por
> **WhatsApp**. Eso definió bastante de esta fase — está explicado en la
> sección 6.

---

## Índice

1. [Las cinco líneas que son el corazón de la fase](#1-las-cinco-líneas-que-son-el-corazón-de-la-fase)
2. [La cadena de las deudas](#2-la-cadena-de-las-deudas)
3. [Acá SÍ se guarda todo (y por qué no es una contradicción)](#3-acá-sí-se-guarda-todo-y-por-qué-no-es-una-contradicción)
4. [Preview y pagar hacen la misma cuenta, dos veces](#4-preview-y-pagar-hacen-la-misma-cuenta-dos-veces)
5. [Las protecciones que recién ahora se activan](#5-las-protecciones-que-recién-ahora-se-activan)
6. [WhatsApp: qué hace el botón y qué NO hace](#6-whatsapp-qué-hace-el-botón-y-qué-no-hace)
7. [El cero que rompe todo (teléfonos paraguayos)](#7-el-cero-que-rompe-todo-teléfonos-paraguayos)
8. [El ticket: escribir para WhatsApp](#8-el-ticket-escribir-para-whatsapp)
9. [Tres casos raros que hay que contemplar](#9-tres-casos-raros-que-hay-que-contemplar)
10. [Las pantallas](#10-las-pantallas)
11. [Archivos nuevos y modificados](#11-archivos-nuevos-y-modificados)
12. [Cómo probarlo vos mismo](#12-cómo-probarlo-vos-mismo)

---

## 1. Las cinco líneas que son el corazón de la fase

Todo lo demás de este documento gira alrededor de esto (plan, sección 5.9):

```js
resultado  = bruto − adelantos − deudaAnterior
neto       = máximo(resultado, 0)      // lo que se le paga el sábado
deudaNueva = máximo(−resultado, 0)     // lo que queda debiendo
```

Parece poco. La parte difícil no es la cuenta: es entender **por qué hay dos
resultados en vez de uno**.

### El caso que lo explica

Un empleado hizo 600.000 de trabajo, pero ya le adelantaron 800.000. El
resultado da **−200.000**. ¿Y eso qué significa?

La respuesta ingenua sería "que devuelva 200.000". Pero eso no pasa en la vida
real: nadie devuelve plata el sábado. Lo que pasa es que esa semana **no cobra
nada**, y esos 200.000 quedan pendientes para la semana que viene.

Por eso el número se parte en dos:

- el **neto**, que es lo que sale de la caja — **nunca negativo**, porque la
  plata solo va en una dirección;
- la **deuda nueva**, que no es plata: es *información* que viaja a la semana
  siguiente.

```js
it('el neto NUNCA es negativo: la plata solo va en una direccion', () => {
  const r = calcularNeto({ bruto: 0, adelantos: 1_000_000 });
  expect(r.neto).toBe(0);
  expect(r.deudaNueva).toBe(1_000_000);
});
```

### Por qué es una función pura

`logic/payroll.js` no toca la base ni HTTP. Es la cuenta de la que depende que
a una persona le paguen bien, y aislada así se puede probar con veinte casos en
milisegundos —incluidos los que en la fábrica pasan una vez al año.

---

## 2. La cadena de las deudas

Esta es la idea que hace que el sistema funcione en el tiempo:

> **La `deudaNueva` de esta liquidación es la `deudaAnterior` de la próxima.**

Cada sábado cierra un eslabón y abre el siguiente. En el test del criterio de la
fase se ve entero:

```
SEMANA 1
  Ana produce 3.000 ladrillos ........ bruto     540.000
  se adelanta ........................ adelantos 800.000
  resultado = −260.000  →  neto 0 · deudaNueva 260.000
  (total a pagar de la semana: 0 → NO se crea egreso de sueldos)

SEMANA 2
  Ana produce 5.000 ladrillos ........ bruto     900.000
  deudaAnterior (viene de la semana 1) 260.000
  resultado = 640.000   →  neto 640.000 · deudaNueva 0
  (egreso de sueldos por 640.000, con fecha del sábado)

SEMANA 3
  Ya no arrastra nada: si no trabaja, no aparece.
```

### Cómo se busca la deuda anterior

Es una agregación en el modelo, y el orden de los pasos es el truco:

```js
// server/src/models/Payroll.js
{ $match: { estado: 'pagada', semanaInicio: { $lt: semanaInicio } } },  // 1
{ $sort:  { semanaInicio: -1 } },                                       // 2
{ $unwind: '$detalle' },                                                // 3
{ $group: { _id: '$detalle.employeeId', deuda: { $first: '$detalle.deudaNueva' } } },  // 4
{ $match: { deuda: { $gt: 0 } } },                                      // 5
```

Como vienen ordenadas **de nueva a vieja** (paso 2), el `$first` del paso 4 es
la liquidación más reciente **de cada uno**. Eso importa: un empleado puede no
figurar en la última liquidación (no trabajó esa semana) pero sí en la anterior.

El paso 5 saca a los que quedaron en cero: si no, aparecerían en la liquidación
empleados que no tienen nada que ver con esta semana.

---

## 3. Acá SÍ se guarda todo (y por qué no es una contradicción)

En la fase 6 la regla era: **si se puede calcular, no se guarda**. Acá pasa lo
contrario. El modelo `Payroll` guarda nombre, ladrillos, bruto, adelantos,
deuda, neto, deuda nueva y hasta el detalle día por día.

No es una contradicción. Es la **misma pregunta** con otra respuesta:

> "Si el original cambia mañana, ¿este registro tendría que cambiar?"

Un ticket de sueldo es un **comprobante de algo que ya pasó**: el sábado 26 de
septiembre, a Ana se le pagaron 1.120.000 guaraníes. Ese número no puede
cambiar nunca más, pase lo que pase con las producciones, las tarifas o los
adelantos.

Si se recalculara cada vez que se abre, un arreglo hecho en octubre reescribiría
lo que se pagó en septiembre, y el papel que el empleado tiene en el bolsillo
dejaría de coincidir con el sistema.

```js
it('subir la tarifa DESPUES no cambia lo ya liquidado (snapshot)', async () => {
  await conSesion('post', `/api/payrolls/${S1_LUNES}/pagar`);
  await conSesion('patch', `/api/employees/${ana.id}`).send({ tarifaPorMil: 500_000 });

  const res = await conSesion('get', `/api/payrolls/preview?semana=${S1_LUNES}`);
  expect(deAna.bruto).toBe(900_000); // la de septiembre
});
```

> **La regla que sale de comparar las dos fases:** no es "calcular es mejor" ni
> "guardar es mejor". Es **qué representa el dato**. Un saldo representa el
> presente → se calcula. Un comprobante representa el pasado → se congela.

---

## 4. Preview y pagar hacen la misma cuenta, dos veces

```js
preview(semana)  // calcula y NO guarda nada
pagar(semana)    // calcula OTRA VEZ, y esa vez sí guarda
```

Fijate que `pagar()` **no recibe** el resultado del preview: lo recalcula desde
cero. Parece trabajo repetido y es a propósito.

Entre que el dueño mira la pantalla y toca "Marcar pagado" pueden pasar
minutos, y en el medio alguien pudo cargar una producción o un adelanto. Si se
guardara lo que el navegador tiene en pantalla, se pagaría **una foto vieja**.
Recalculando al momento de pagar, lo que se guarda es lo que era cierto en el
instante en que salió la plata.

Es el mismo principio que en las ventas: **lo que se guarda lo decide el
servidor, no la pantalla.** Por eso el validador de esta fase es el más corto
de todo el sistema:

```js
export const previewSchema = z.object({
  semana: fecha.optional(),
});
```

Al liquidar **no se manda ningún número**. Solo se dice qué semana.

### "Reiniciar contadores" no existe

El MVP hablaba de un botón para reiniciar los contadores cada semana. No hace
falta y sería peligroso: los totales **siempre** se calculan por rango de
fechas, así que el lunes arrancan en cero solos. No hay nada que reiniciar, y
por lo tanto no hay ningún botón que pueda borrar una semana por error.

---

## 5. Las protecciones que recién ahora se activan

Esto es lo más satisfactorio de la fase. En las fases 5 y 7 escribí esto:

```js
// production.service.js (fase 5)
if (produccion.payrollId) {
  throw new ApiError(409, 'Esta produccion pertenece a una semana ya liquidada...');
}
```

…y **nunca se ejecutaba**, porque nadie completaba `payrollId`. Era código
esperando.

El paso 3 de `pagar()` lo completa:

```js
await Production.updateMany({ _id: { $in: idsProducciones } }, { payrollId: payroll._id }, { session });
await Advance.updateMany({ _id: { $in: idsAdelantos } },     { payrollId: payroll._id }, { session });
```

Y de golpe las dos protecciones cobran vida, sin haber tocado esos archivos.
Hay un test que lo muestra en los dos estados:

```js
it('ANTES de liquidar, las dos se pueden anular', ...)      // 200
it('DESPUES de liquidar, ninguna de las dos se puede anular', ...)  // 409
```

> **La lección:** cuando una fase temprana deja escrita una protección para una
> condición que todavía no puede darse, no es código muerto: es un contrato.
> La fase que puede cumplirlo llega después y no hay que tocar nada.

---

## 6. WhatsApp: qué hace el botón y qué NO hace

Vos pediste un botón "Enviar por WhatsApp" que le mande el ticket a cada
empleado usando su número cargado. Así quedó, y hay una parte importante que
conviene que sepas:

> **El botón abre WhatsApp con el mensaje ya escrito. El sistema NO lo manda
> solo — vos tocás Enviar.**

Técnicamente se usa un link `wa.me`:

```
https://wa.me/595981123456?text=<el ticket codificado>
```

Se abre WhatsApp (la app en el celular, o WhatsApp Web en la computadora) en la
conversación con esa persona, con el texto puesto en el campo.

### Por qué así, y no envío automático

Envío realmente automático existe, pero necesita la **API de WhatsApp
Business**: hay que registrar la empresa, aprobar plantillas de mensaje con
Meta, y se paga por conversación. Para esta fábrica eso sería agregar un
trámite, un costo mensual y una dependencia externa.

Y la versión "manual" tiene tres ventajas reales:

1. **Funciona hoy, gratis, desde el celular del dueño.** Sin registros ni
   aprobaciones.
2. **El dueño VE el mensaje antes de que salga.** Un sistema que manda mensajes
   solo a los celulares de sus empleados es un sistema al que hay que tenerle
   mucha más confianza, y con razón.
3. **Sale desde su propio WhatsApp.** El empleado recibe un mensaje de su
   patrón, no de un número desconocido que le habla de plata.

> Si alguna vez la fábrica crece y mandar 15 tickets de a uno se vuelve
> molesto, el paso siguiente es la API de Business. El texto del ticket ya lo
> arma el servidor (`logic/ticket.js`), así que ese cambio tocaría un solo
> archivo.

### El botón se deshabilita solo

Si el empleado no tiene celular cargado, no aparece un link roto: aparece la
explicación de qué hacer.

```
Juan Ruiz no tiene celular cargado.
Agregaselo en Mas → Empleados para poder mandarle el ticket.
```

Para eso hubo que **agregarle el campo `telefono` a `Employee`**, que antes no
existía. Es opcional: el sistema funciona igual para alguien sin celular, lo
único que no va a poder es recibir el ticket.

---

## 7. El cero que rompe todo (teléfonos paraguayos)

Este es el detalle chico que hubiera hecho fallar todo en silencio.

En Paraguay los celulares se escriben con un **0 adelante**: `0981 123 456`. Ese
cero es el *prefijo nacional*: sirve para llamar **dentro** del país y **no
forma parte del número**. El número de verdad es `981 123 456`, y desde afuera
se marca `+595 981 123 456`.

WhatsApp necesita el formato internacional, solo dígitos, sin el `+`:

```
0981 123 456  →  595981123456
```

O sea que al agregar el `595` hay que **sacar el cero**. Si no, quedaría
`5950981123456`, que no es el número de nadie — y WhatsApp abriría diciendo
que el contacto no existe.

**Es un error silencioso y molesto:** el link "funciona", el botón anda, no hay
ningún mensaje rojo. Simplemente no llega. Se descubriría el sábado, con el
empleado esperando.

Por eso `logic/telefono.js` es una función pura con su propio archivo de tests,
que cubre los formatos que la gente escribe de verdad:

```js
'0981123456'      → '595981123456'
'0981 123 456'    → '595981123456'
'0981-123-456'    → '595981123456'
'(0981) 123456'   → '595981123456'
'+595 981 123 456'→ '595981123456'
'+5950981123456'  → '595981123456'   ← el caso mixto: código de país Y cero
'123'             → null             ← no es un teléfono
```

---

## 8. El ticket: escribir para WhatsApp

Que el destino sea WhatsApp condicionó cómo se escribe el ticket:

- **Nada de tablas alineadas con espacios.** WhatsApp usa tipografía de ancho
  variable: las columnas quedan torcidas. Cada línea lleva su etiqueta adelante.
- **Negrita con cuentagotas.** WhatsApp entiende `*texto*`. Se usa solo en el
  número que importa: el neto.
- **Corto.** Se lee en un celular, muchas veces al sol y con una mano.

Así sale:

```
*Ladrillera* — Semana del 21/09 al 26/09

Ana Benitez

Lun 21/09: 5.000 ladrillos — Gs 900.000
Mie 23/09: 4.000 ladrillos — Gs 720.000

Total ladrillos: 9.000
Bruto: Gs 1.620.000
Adelantos: -Gs 500.000

*A cobrar: Gs 1.120.000*
```

### Dos detalles del texto

**Las líneas en cero no se escriben.** Un "Adelantos: Gs 0" no informa nada y le
saca lugar a lo que sí importa.

**El caso incómodo se explica.** Cuando cobra cero y además queda debiendo:

```
*A cobrar: Gs 0*

Queda un saldo de Gs 200.000 que se descuenta la semana que viene.
```

Es **el** momento en que el empleado necesita entender por qué no le toca plata.
Un ticket que solo diga "A cobrar: Gs 0" genera una discusión el sábado a la
tarde.

### El texto lo arma el servidor

Podría armarlo la pantalla, y sería un error: el ticket que se **ve**, el que se
**manda** y el que algún día se **imprima** tienen que ser el mismo. Armándolo
en un solo lugar, el día que haya que cambiar una línea se cambia una sola vez.

---

## 9. Tres casos raros que hay que contemplar

### 9.1 Nadie cobra nada, pero igual hay que liquidar

Si **todos** se adelantaron más de lo que ganaron, el total a pagar es cero.
Entonces:

- **No se crea egreso de sueldos.** Esa plata ya salió de la caja con cada
  adelanto; contarla de nuevo sería pagarla dos veces. Y un movimiento de 0 Gs
  no significa nada.
- **La liquidación igual se guarda**, porque las deudas nuevas tienen que viajar
  a la semana siguiente.

```js
expect(await Transaction.countDocuments({ 'origen.tipo': 'liquidacion' })).toBe(0);
```

### 9.2 El que no trabajó pero debe

Si alguien no produjo nada esta semana pero arrastra deuda, **tiene que
aparecer** en la liquidación, con bruto 0. Si se lo salteara, su deuda
desaparecería del sistema sin que nadie la haya pagado.

Por eso `armarLiquidacion()` junta los ids de **tres** fuentes —producciones,
adelantos y deudas anteriores— en un `Set`:

```js
for (const p of producciones) for (const t of p.trabajadores) ids.add(String(t.employeeId));
for (const a of adelantos) ids.add(String(a.employeeId));
for (const id of deudasAnteriores.keys()) ids.add(String(id));
```

El `Set` es porque alguien puede aparecer en las tres y tiene que contarse una
sola vez.

### 9.3 Dos producciones el mismo día

Si se cargó la mañana y después la tarde, el ticket no tiene que mostrar dos
líneas del mismo día: se agrupan por fecha.

```js
it('junta dos producciones del MISMO dia en una sola linea', ...)
```

---

## 10. Las pantallas

### Liquidación — el sábado a la tarde

Es la pantalla más delicada del sistema, porque de acá sale la plata que cobra
cada persona. Tres decisiones:

**1. Cada empleado muestra la cuenta entera, no solo el neto.**

```
Ana Benitez
  Producción (9.000 ladrillos)    Gs 1.620.000
  Adelantos                     − Gs   500.000
  ─────────────────────────────────────────────
  A cobrar                        Gs 1.120.000
```

Si el empleado pregunta *"¿por qué cobro esto?"*, la respuesta está en la
pantalla y no hay que reconstruirla de memoria.

**2. "Marcar pagado" pide confirmación y dice el total en guaraníes.** Es una
acción que no se puede deshacer: después de pagarla, las producciones y los
adelantos de esa semana quedan trabados para siempre.

**3. Una vez pagada, la pantalla cambia de tono.** Desaparece el botón y
aparecen los tickets. Ya no hay nada que decidir, solo algo que repartir.

### El ticket

Se abre en un cartel, muestra el texto **tal cual le va a llegar** al empleado,
y abajo el botón verde de WhatsApp. También hay un "Copiar texto", por si hay
que mandarlo por otro lado.

> **Detalle técnico:** el texto va en un `<pre>` con `white-space: pre-wrap`.
> Un `<p>` común colapsaría todos los saltos de línea y el ticket saldría en un
> solo párrafo; `pre` solo generaría scroll horizontal en el celular. Las dos
> cosas juntas conservan los saltos **y** cortan las líneas largas.

---

## 11. Archivos nuevos y modificados

### Backend

| Archivo | Qué hace |
|---|---|
| `logic/payroll.js` | **nuevo** · las cinco líneas del sueldo + armado de la liquidación |
| `logic/telefono.js` | **nuevo** · teléfono paraguayo → formato WhatsApp |
| `logic/ticket.js` | **nuevo** · el texto del ticket |
| `logic/semana.js` | (fase 7) ya tenía `hoyEnParaguay()` |
| `models/Payroll.js` | **nuevo** · la liquidación congelada + la cadena de deudas |
| `models/Employee.js` | + `telefono` (opcional) |
| `services/payroll.service.js` | **nuevo** · preview, pagar, historial, tickets |
| `validators/payroll.validator.js` | **nuevo** · el más corto del sistema |
| `controllers/payroll.controller.js` | **nuevo** |
| `routes/payroll.routes.js` | **nuevo** · `/payrolls` |
| `validators/employee.validator.js` | + `telefono` (sin default en el editar) |

### Frontend

| Archivo | Qué hace |
|---|---|
| `api/payrolls.js` | **nuevo** |
| `pages/Liquidacion.jsx` | **nuevo** · la tabla de la semana + marcar pagado |
| `components/Ticket.jsx` | **nuevo** · el ticket y el botón de WhatsApp |
| `pages/Empleados.jsx` | + campo Celular |
| `App.jsx`, `Mas.jsx`, `index.css` | ruta real, menú y estilos |

> Desde esta fase **ya no queda ninguna pantalla "en construcción"** en la barra
> inferior ni en el menú Más, salvo Ajustes (fase 10).

### Tests

| Archivo | Cuántos |
|---|---|
| `tests/payroll-logic.test.js` | **nuevo** · 31 tests de funciones puras |
| `tests/payrolls.test.js` | **nuevo** · 25 tests contra la API |

**Total: 307 tests** (eran 251).

---

## 12. Cómo probarlo vos mismo

```bash
npm run dev
```

**Preparar:**

1. **Más → Empleados.** Editá a alguien y cargale el celular (`0981 123 456`).
   Dejá a otro **sin** celular, para ver los dos casos.
2. **Producción.** Cargá un día con los dos marcados.
3. **Más → Adelantos.** Dale un adelanto a uno de ellos.

**Liquidar:**

4. **Más → Liquidación.** Ahí está la semana: cada uno con su bruto, sus
   adelantos y su neto.
5. Tocá **Marcar pagado** → la confirmación dice el total. Confirmá.
6. **Caja** → apareció el egreso "Sueldos" por el total neto, con fecha del
   sábado.
7. **Producción** → intentá anular el día que cargaste: el sistema ya no te
   deja. Lo mismo con el adelanto.

**El ticket:**

8. Volvé a **Liquidación** y tocá **Ticket** en el que tiene celular.
   → Ahí está el ticket, y el botón verde. Tocalo: se abre WhatsApp con el
   mensaje escrito. **Vos tocás Enviar.**
9. Tocá **Ticket** en el que NO tiene celular → el botón no aparece, y te dice
   dónde cargárselo.

**La deuda arrastrada (el caso interesante):**

10. Pasá a la semana siguiente con la flecha ›. Dale a alguien un adelanto
    **mayor** a lo que produjo esa semana, y liquidá.
    → Su neto da Gs 0 y aparece *"Queda un saldo de … que se descuenta la
    semana que viene"*.
11. Pasá a la semana siguiente y cargale producción.
    → Ahí está el **Saldo anterior** descontándose solo.

---

## Lo que viene

**Fase 9 — Dashboard.** El endpoint `/dashboard` y la pantalla de Inicio con
datos reales: balance del mes, ladrillos de la semana, alerta roja de arcilla,
los tres números del stock, total por cobrar y total por entregar.

Es una fase de **lectura**: no crea reglas nuevas, junta las que ya existen en
una sola pantalla. Casi todo ya está hecho —`obtenerStock()`,
`Sale.totalesPendientes()`, el balance de la caja, el resumen de producción—;
falta juntarlo y que responda rápido.

Después quedan la **fase 10** (configuración inicial, PWA, deploy) y la **11**
(piloto).

> **Preguntas abiertas del plan que conviene ir resolviendo** (sección 9):
> ¿hay buena señal de internet en la fábrica? (si no, habría que pensar modo sin
> conexión, que es bastante más complejo) y ¿qué presupuesto hay para el
> hosting? Las dos pegan en la fase 10.
