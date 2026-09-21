# Fase 7 — Adelantos

> La fase más corta del plan, y eso **no es casualidad**: es lo que pasa cuando
> las piezas de abajo están bien puestas.
>
> Criterio del plan: *"El adelanto aparece en caja al instante"*. ✅ Cumplido y
> verificado.

---

## Índice

1. [Por qué esta fase es tan corta](#1-por-qué-esta-fase-es-tan-corta)
2. [Qué es un adelanto y qué hace el sistema](#2-qué-es-un-adelanto-y-qué-hace-el-sistema)
3. [Aplicar la regla de la fase 6: copiar o apuntar](#3-aplicar-la-regla-de-la-fase-6-copiar-o-apuntar)
4. [Lo que a propósito NO se valida](#4-lo-que-a-propósito-no-se-valida)
5. [Lo que sí se bloquea](#5-lo-que-sí-se-bloquea)
6. [Una duplicación que limpié de paso](#6-una-duplicación-que-limpié-de-paso)
7. [La pantalla: cuándo un formulario NO va en un modal](#7-la-pantalla-cuándo-un-formulario-no-va-en-un-modal)
8. [Archivos nuevos y modificados](#8-archivos-nuevos-y-modificados)
9. [Cómo probarlo vos mismo](#9-cómo-probarlo-vos-mismo)

---

## 1. Por qué esta fase es tan corta

Un adelanto son **dos escrituras**:

1. el adelanto,
2. el egreso de caja, categoría `adelanto`.

Y las dos ya tenían su herramienta hecha:

| Lo que hace falta | De dónde salió | Fase |
|---|---|---|
| Crear el egreso automático | `crearEgresoDeSistema()` | 4 |
| Anular ese egreso | `anularPorOrigen()` | 4 |
| Que las dos vayan juntas o ninguna | `conTransaccion()` | 4 |
| Saber a qué semana pertenece | `semanaDePago()` | 5 |
| Bloquear si la semana ya se liquidó | el patrón de `payrollId` | 5 |
| Formatear el monto en el mensaje | `formatearGsSimple()` | 6 |
| El molde de la pantalla | `Produccion.jsx` | 5 |

**Acá no se inventó nada nuevo.** Se combinaron cosas que ya funcionaban y ya
estaban testeadas. La categoría `adelanto` incluso ya venía sembrada desde la
fase 4, esperando a que alguien la usara:

```js
// server/src/services/seed.service.js — escrito en la fase 4
{ clave: CATEGORIAS_SISTEMA.ADELANTO, nombre: 'Adelanto', tipo: 'egreso' },
```

Si esta fase hubiera venido primero, habría sido la más larga de todas: habría
que haber construido las transacciones, las categorías, la caja y el cálculo de
la semana solo para poder anotar que se le dieron 500.000 guaraníes a alguien.

> **La lección general:** cuando una tarea nueva resulta sorprendentemente
> corta, casi siempre es la factura a favor de decisiones que se tomaron bien
> hace varias fases. Y al revés: cuando algo que parecía simple se vuelve
> larguísimo, suele ser señal de que falta una pieza abajo.

---

## 2. Qué es un adelanto y qué hace el sistema

Un adelanto es plata que el dueño le entrega a un empleado **antes** del
sábado, a cuenta de lo que va a cobrar. El sábado, en la liquidación (fase 8),
se le descuenta.

El plan (sección 5.8) lo resume en una línea: *"Crea el adelanto **y** un egreso
de caja categoría `adelanto`, en el momento."*

Las dos escrituras van dentro de una transacción:

```js
// server/src/services/advance.service.js
const adelanto = await conTransaccion(async (session) => {
  const [doc] = await Advance.create([{ employeeId: empleado._id, monto, fecha }], { session });

  const egreso = await transactionService.crearEgresoDeSistema({
    claveCategoria: CATEGORIAS_SISTEMA.ADELANTO,
    monto, fecha,
    descripcion: `${detalle} — ${formatearGsSimple(monto)}`,
    origenTipo: 'adelanto',
    origenId: doc._id,
  }, session);

  doc.transactionId = egreso._id;
  await doc.save({ session });
  return doc;
});
```

Sin la transacción podría quedar un adelanto registrado sin que la plata haya
salido de la caja (o al revés). Hay un test que lo verifica forzando un fallo:

```js
it('si algo falla, no queda ni el adelanto ni el egreso (todo o nada)', ...)
```

### "En el momento" significa la fecha del adelanto

El egreso lleva la fecha del **adelanto**, no la del sábado que se liquida ni
la de hoy. La plata salió de la caja el día que se la dieron, y el balance del
mes tiene que reflejarlo ese día.

Es el mismo criterio que en las ventas de la fase 6, donde el ingreso lleva la
fecha del **pago** y no la de la venta: *la caja registra cuándo se mueve la
plata*.

### Los dos campos que apuntan a otra cosa

```js
transactionId -> el egreso de caja que generó
payrollId     -> la liquidación que lo descontó (null hasta la fase 8)
```

`transactionId` existe para poder anular: sin él habría que adivinar cuál de
los egresos corresponde a este adelanto. `payrollId` es la marca de "esto ya se
pagó", y es la que habilita la protección de la sección 5.

---

## 3. Aplicar la regla de la fase 6: copiar o apuntar

En `Production`, cada trabajador lleva su **nombre copiado adentro**. En
`Advance`, **no**. Vale la pena ver por qué, porque es la regla de la fase 6
aplicada de nuevo:

> **"Si el original cambia mañana, ¿este registro tendría que cambiar también?"**

En `Production` el nombre viaja al lado de `tarifaPorMil`, que **sí** tiene que
quedar congelada: si sube la tarifa en octubre, lo que se pagó en septiembre no
cambia. Teniendo que copiar la tarifa igual, copiar el nombre al lado deja la
línea de pago completa y auto-contenida.

Un adelanto **no congela nada**: el único número es el monto, que ya es su
propio campo. Entonces el nombre se **apunta**. Si mañana se corrige un nombre
mal escrito, los adelantos viejos se corrigen solos.

```js
// Se apunta y se trae con populate
.populate('employeeId', 'nombre rol')
```

Y el `toJSON` separa el id del empleado, igual que hace `Sale` con el cliente:

```js
if (ret.employeeId?.nombre) {
  ret.empleado = ret.employeeId;
  ret.employeeId = ret.empleado.id ?? null;
}
```

> Ojo con la comprobación: se pregunta por `.nombre` y **no** por `.id`, porque
> un ObjectId de Mongo *tiene* una propiedad `.id` (el buffer crudo del
> identificador) y daría un falso positivo. Es la misma trampa de la fase 6.

---

## 4. Lo que a propósito NO se valida

Esta es la decisión más interesante de la fase.

Parece razonable controlar que el adelanto no supere lo que el empleado va a
ganar. Es una mala idea, por dos motivos:

**1. El número contra el que compararlo no existe todavía.** El adelanto se da
el martes; cuánto va a producir de acá al sábado, nadie lo sabe.

**2. El plan ya resolvió el caso.** La liquidación (sección 5.9) hace:

```
resultado  = bruto − adelantos − deudaAnterior
neto       = máximo(resultado, 0)     → lo que se le paga
deudaNueva = máximo(−resultado, 0)    → pasa a la semana siguiente
```

O sea que "adelantarse de más" es una situación **prevista**: el neto se va a
cero y la diferencia queda como deuda arrastrada. Bloquearlo sería impedir algo
que el sistema ya sabe manejar.

Hay un test que deja escrita esa decisión, para que nadie la "arregle" sin
querer más adelante:

```js
it('NO controla que el adelanto sea menor a lo que va a ganar', async () => {
  const res = await adelantar({ monto: 50_000_000 });
  expect(res.status).toBe(201);
});
```

> **El principio:** un test no sirve solo para verificar lo que el sistema hace.
> También sirve para dejar constancia de lo que **deliberadamente no hace**, con
> el motivo al lado. Es documentación que se rompe si alguien la contradice.

Lo que sí hay es un tope de cordura (`1.000.000.000`): mil millones no es una
decisión, es un cero de más. Frenarlo es más útil que dejarlo entrar y tener que
anularlo después junto con su egreso.

---

## 5. Lo que sí se bloquea

| Regla | Código | Por qué |
|---|---|---|
| El empleado tiene que existir | 404 | — |
| No puede estar **inactivo** | 400 | Igual que en producción: un inactivo no cobra ni produce. Darle un adelanto a alguien que dejó de venir es, casi siempre, haber elegido mal en la lista. |
| No se puede anular uno de una **semana ya liquidada** | 409 | Plan 5.9. Ese adelanto ya se descontó de un sueldo que el empleado tiene en el bolsillo; anularlo cambiaría una cuenta cerrada. |
| El egreso **no** se puede anular desde Caja | 400 | Heredado de la fase 4: hay que anular el adelanto, y el egreso se va con él. Si no, quedaría plata salida de la caja sin ningún adelanto que la explique. |

Los mensajes dicen el nombre y qué hacer:

```
Ana Benitez figura como inactivo. Activalo en Empleados para darle un adelanto.
Este adelanto pertenece a una semana ya liquidada y no se puede anular.
```

> **Nota sobre la regla del inactivo:** el plan no la menciona explícitamente
> para adelantos (solo dice que un inactivo "no aparece para cargar
> producción"). La decidí por consistencia con la fase 5, porque la razón es la
> misma. Si en la fábrica pasa que a alguien que ya no viene todavía hay que
> darle plata, es **una línea** en `advance.service.js`.

---

## 6. Una duplicación que limpié de paso

La función que calcula "hoy en Paraguay" vivía escondida al final de
`production.controller.js`:

```js
function hoyEnParaguay() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', ... }).format(new Date());
}
```

El controlador de adelantos necesita exactamente lo mismo (para que
`GET /advances` sin parámetros devuelva la semana actual). Había dos caminos:

- **copiarla** al controlador nuevo, o
- **mudarla** a `logic/semana.js`, que es donde viven todas las cuentas de
  fechas, y que los dos la importen.

Mudarla. Cuando la misma función hace falta en dos lugares, copiarla es
garantizar que algún día una de las dos copias reciba un arreglo y la otra no.

Y esta función en particular es delicada: si se le quita el `timeZone`, el
servidor —que suele correr en UTC— a las 22 h de Paraguay ya estaría en el día
siguiente y devolvería la semana equivocada. Un bug así, con dos copias, se
arregla una vez y sigue pasando.

> Es el mismo criterio de las fases anteriores, pero al revés: `format.js` del
> frontend **sí** duplica las cuentas de la semana, y ahí la duplicación está
> justificada (lados distintos de la red, y el servidor es la autoridad). Acá
> son dos archivos del mismo servidor: no hay ninguna justificación.

---

## 7. La pantalla: cuándo un formulario NO va en un modal

Las pantallas de Empleados, Clientes, Ventas y Caja abren su formulario en un
modal. La de Adelantos lo pone **directo en la pantalla**. No es inconsistencia,
es el criterio:

> Un modal sirve cuando el formulario **interrumpe otra cosa**: la lista que el
> usuario estaba mirando sigue ahí, detrás, y vuelve al cerrarlo.

En Adelantos, el formulario **es** la pantalla. Se entra a Adelantos para dar un
adelanto. Meterlo en un cartel agregaría un toque de más a cambio de nada.

### Dos detalles chicos

**El botón dice lo que va a hacer.** En vez de un "Guardar" genérico:

```
Dar Gs 500.000 a Ana Benitez
```

Es la última oportunidad de ver el monto y el nombre juntos antes de que la
plata salga de la caja. Un error de empleado o de monto se detecta ahí, no el
sábado.

**Al guardar se limpia el monto y el empleado, pero queda la fecha.** Si está
cargando varios adelantos del mismo día —el caso común— no tiene que volver a
elegirla cada vez.

### El resumen va agrupado por empleado

Debajo del formulario está la semana, pero lo primero es el **resumen por
empleado**, no la lista cronológica. La pregunta real del sábado es *"¿cuánto le
adelanté a cada uno?"*, no *"¿qué pasó el martes?"*. La lista cronológica está
abajo, para cuando hace falta anular uno en concreto.

### Y los dos estados de error

La pantalla usa la separación que aprendí en la fase 6:

- `errorCarga` → no hay datos que mostrar, se reemplaza la pantalla.
- `errorAccion` → una acción fue rechazada (por ejemplo el 409 de la semana ya
  liquidada); el mensaje va arriba y **la lista se queda donde está**.

---

## 8. Archivos nuevos y modificados

### Backend

| Archivo | Qué hace |
|---|---|
| `models/Advance.js` | **nuevo** · empleado, fecha, monto, y los dos punteros |
| `services/advance.service.js` | **nuevo** · alta con egreso, anulación, resumen semanal |
| `validators/advance.validator.js` | **nuevo** |
| `controllers/advance.controller.js` | **nuevo** |
| `routes/advance.routes.js` | **nuevo** · `/advances` |
| `routes/index.js` | montado debajo de la barrera `requireAuth` |
| `logic/semana.js` | + `hoyEnParaguay()`, mudada desde el controlador de producción |
| `controllers/production.controller.js` | ahora la importa en vez de tener su copia |

### Frontend

| Archivo | Qué hace |
|---|---|
| `api/advances.js` | **nuevo** |
| `pages/Adelantos.jsx` | **nuevo** · formulario directo + semana agrupada |
| `App.jsx`, `Mas.jsx` | ruta real en vez del cartel "en construcción" |

### Tests

| Archivo | Cuántos |
|---|---|
| `tests/advances.test.js` | **nuevo** · 20 tests |

**Total: 251 tests** (eran 231).

---

## 9. Cómo probarlo vos mismo

```bash
npm run dev
```

1. **Más → Adelantos.** Elegí un empleado y poné `500000`.
   → el botón tiene que decir **"Dar Gs 500.000 a \<nombre\>"**.
2. Guardá. Abajo aparece el resumen de la semana y la lista.
3. **Caja** → ahí está el egreso, categoría "Adelanto", con el nombre y el
   monto formateado en la descripción. El balance del mes ya lo resta.
4. Volvé a **Adelantos** y cargá otro al mismo empleado, otro día.
   → el resumen dice **"(2 veces)"** y suma los dos.
5. **Anulá** uno. La confirmación avisa que también se anula el egreso.
6. **Caja** → ese egreso desapareció y el balance volvió.
7. Probá desactivar un empleado en **Empleados** y darle un adelanto: el
   sistema lo frena y te dice su nombre.

---

## Lo que viene

**Fase 8 — Liquidación semanal y tickets.** Es donde se juntan las tres fases
anteriores: la producción de la 5 (el bruto), los adelantos de la 7 (lo que ya
cobró) y la deuda arrastrada de la liquidación anterior.

```
bruto         = suma de sus montos de producción de la semana
adelantos     = suma de sus adelantos de la semana no descontados
deudaAnterior = deudaNueva de su última liquidación pagada (o 0)
resultado     = bruto − adelantos − deudaAnterior
neto          = máximo(resultado, 0)
deudaNueva    = máximo(−resultado, 0)
```

Al marcar pagado, el `payrollId` se completa en todas las producciones y
adelantos de esa semana, y ahí se activan las protecciones que ya están
escritas en las dos fases.

> **Hay una pregunta abierta del plan que conviene resolver antes de la fase 8**
> (sección 9): el **ticket semanal por empleado** — ¿verlo en pantalla,
> imprimirlo, bajarlo como PDF o compartirlo por WhatsApp?
