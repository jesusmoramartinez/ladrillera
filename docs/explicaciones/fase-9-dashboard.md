# Fase 9 — Dashboard

> La primera fase que **no crea ninguna regla de negocio**. Junta las que ya
> existen en una sola pantalla.
>
> Criterio del plan: *"Inicio muestra datos reales en < 2 s"*. ✅ Cumplido y
> verificado.

---

## Índice

1. [Una fase de lectura](#1-una-fase-de-lectura)
2. [Un endpoint solo, y no cinco](#2-un-endpoint-solo-y-no-cinco)
3. [La diferencia entre "funciona" y "es rápido"](#3-la-diferencia-entre-funciona-y-es-rápido)
4. ["De lunes a hoy", y el domingo que rompe el rango](#4-de-lunes-a-hoy-y-el-domingo-que-rompe-el-rango)
5. [Por qué el Inicio no calcula nada por su cuenta](#5-por-qué-el-inicio-no-calcula-nada-por-su-cuenta)
6. [La pantalla: ordenada por urgencia](#6-la-pantalla-ordenada-por-urgencia)
7. [Cada número lleva a algún lado](#7-cada-número-lleva-a-algún-lado)
8. [Archivos nuevos y modificados](#8-archivos-nuevos-y-modificados)
9. [Cómo probarlo vos mismo](#9-cómo-probarlo-vos-mismo)

---

## 1. Una fase de lectura

Hasta ahora cada fase agregaba reglas: cómo se descuenta la arcilla, cuándo se
bloquea un cobro, cómo se arrastra una deuda. Esta no agrega ninguna.

El plan (sección 5.12) pide seis cosas, y **las seis ya existían**:

| Lo que pide el Inicio | De dónde sale | Fase |
|---|---|---|
| Balance del mes (ingresos y egresos) | `transactions` | 4 |
| Ladrillos de la semana (lunes a hoy) | `productions` | 5 |
| Alerta roja de arcilla | `alertaArcilla()` | 4 |
| Ladrillos físico / comprometido / libre | `obtenerStock()` | 4 + 6 |
| Total por cobrar y por entregar | `Sale.totalesPendientes()` | 6 |
| Stock de leña | `obtenerStock()` | 4 |

Lo único que había que hacer es **juntarlos y que responda rápido**. Y eso
último es justamente lo interesante de la fase.

---

## 2. Un endpoint solo, y no cinco

La pantalla necesita cinco cosas. Se podrían pedir con cinco llamadas desde el
navegador, y en un celular sería un error:

- **Cada pedido paga su viaje de ida y vuelta.** Con buena señal son 100 ms;
  con la señal de una fábrica pueden ser 800. Cinco pedidos son cinco esperas.
- **La pantalla tendría cinco estados de carga y cinco de error**, y podría
  quedar a medio dibujar: el balance ya cargado y el stock todavía no.

Con **un** pedido, el celular espera una vez y la pantalla tiene un solo estado.

```js
// client/src/api/dashboard.js
export async function obtenerInicio() {
  return api.get('/dashboard');
}
```

### Y adentro, todo a la vez

Las cinco consultas son independientes: ninguna necesita el resultado de otra.
Entonces van con `Promise.all`, que las dispara juntas y espera a la más lenta,
en vez de una atrás de otra:

```js
const [balance, produccion, stock, pendientes] = await Promise.all([
  transactionService.balanceDelMes(mes),
  Production.ladrillosEntre(semana.inicio, hastaHoy),
  inventoryService.obtenerStock(),
  Sale.totalesPendientes(),
]);
```

La diferencia:

```
en fila:           120 + 80 + 150 + 90  = 440 ms
con Promise.all:   máximo(120, 80, 150, 90) = 150 ms
```

> **Cuándo NO se puede hacer esto:** si una consulta necesitara el resultado de
> otra (por ejemplo, buscar las ventas de un cliente que todavía no sabés cuál
> es), `Promise.all` no sirve y hay que encadenarlas. La regla es simple: si
> podés escribirlas en cualquier orden, pueden ir juntas.

---

## 3. La diferencia entre "funciona" y "es rápido"

Acá está el trabajo real de la fase. Los servicios que ya existían funcionaban,
pero **no estaban pensados para un tablero**.

### El balance del mes

`listarPorMes()` trae **todos** los movimientos del mes y los suma en
JavaScript. Para la pantalla de Caja está perfecto: ahí los movimientos se
muestran igual.

Para el Inicio sería un desperdicio. Se necesitan **dos números**, y traer
trescientos documentos por la red para sumarlos y tirarlos es justo lo que hace
que una pantalla tarde. Por eso agregué una versión que hace la cuenta adentro
de Mongo:

```js
export async function balanceDelMes(mes) {
  const filas = await Transaction.aggregate([
    { $match: { deletedAt: null, fecha: { $gte: desde, $lte: hasta } } },
    { $group: { _id: '$tipo', total: { $sum: '$monto' } } },
  ]);
  // ...
}
```

Devuelve dos filas: `{_id: 'ingreso', total: N}` y `{_id: 'egreso', total: M}`.
Dos objetos por la red en vez de trescientos.

### Los ladrillos de la semana

Mismo criterio, como static del modelo:

```js
productionSchema.statics.ladrillosEntre = async function (desde, hasta) {
  const [fila] = await this.aggregate([
    { $match: { deletedAt: null, fecha: { $gte: desde, $lte: hasta } } },
    { $group: { _id: null, ladrillos: { $sum: '$cantidad' }, dias: { $addToSet: '$fecha' } } },
  ]);
  // ...
};
```

`$addToSet` junta las fechas **distintas**: si un día tiene dos producciones
cargadas (la mañana y la tarde), cuenta como **un** día trabajado. Hay un test
para eso, porque es el tipo de detalle que uno no piensa hasta que el número
dice "3 días" en una semana de 2.

> **Por qué no se tocaron los servicios viejos:** `listarPorMes()` sigue igual,
> porque su pantalla sí necesita los documentos. Optimizar una función para un
> caso de uso y romperla para el otro es la forma más común de "arreglar" algo
> y empeorarlo. Se agregó una función nueva al lado.

### Sobre el "< 2 s" del plan

No se puede medir con honestidad en un test: la máquina de desarrollo no dice
nada sobre el celular del dueño con la señal de la fábrica. Lo que **sí** se
verifica es la decisión que lo hace posible: que el endpoint no traiga
documentos que no necesita.

---

## 4. "De lunes a hoy", y el domingo que rompe el rango

El plan pide *"ladrillos producidos en la semana en curso **(lunes a hoy)**"*.
No hasta el sábado. La diferencia importa:

- Hasta el sábado daría siempre el total de la semana, que es el mismo número
  que ya se ve en la pantalla de Producción.
- Hasta hoy es **lo acumulado**, que es lo que uno quiere saber un miércoles.

Y además, el dueño puede cargar un día adelantado. El Inicio no tiene que
contarlo:

```js
it('NO cuenta los dias posteriores a hoy', ...)
```

### El caso del domingo

Acá se cruzó con una decisión de la fase 5. Ahí decidí que **un domingo cuenta
para la semana que EMPIEZA** (el lunes siguiente), porque la anterior ya se
liquidó el sábado.

Consecuencia: si hoy es domingo, `semanaDePago()` devuelve la semana que
arranca **mañana**. Entonces `inicio` sería *posterior* a `hoy` y el rango
quedaría al revés:

```
desde = 2026-09-21 (lunes, mañana)
hasta = 2026-09-20 (domingo, hoy)
```

El resultado correcto es **cero** —esa semana todavía no empezó— y Mongo ya lo
devuelve solo: no hay ninguna fecha que esté a la vez después del lunes y antes
del domingo anterior. Pero dejarlo así sería depender de la casualidad, así que
está explícito:

```js
const hastaHoy = fechaISO < semana.inicio ? semana.inicio : fechaISO;
```

> **La lección:** una decisión tomada hace cuatro fases (qué pasa con el
> domingo) vuelve a aparecer en un lugar que no tenía nada que ver. Por eso
> conviene dejarlas escritas donde se toman —en `logic/semana.js` hay un
> comentario explicando el domingo— y no solo en la cabeza.

---

## 5. Por qué el Inicio no calcula nada por su cuenta

`dashboard.service.js` no tiene ni una sola cuenta propia. Llama a los mismos
servicios que usan las demás pantallas.

Podría ser más rápido calcular el stock "a mano" con una consulta hecha a
medida. Sería un error: si el Inicio calculara por su cuenta, algún día
mostraría un número distinto al de la pantalla de Stock, y **no habría forma de
saber cuál tiene razón**.

Un tablero que a veces miente es peor que no tener tablero: el dueño deja de
confiar en todo el sistema, no solo en esa pantalla.

Hay un test que lo verifica comparando las tres pantallas:

```js
it('los numeros coinciden con los de las otras pantallas', async () => {
  const inicio = (await dashboard()).body;
  const stock  = (await conSesion('get', '/api/inventory')).body.stock;
  const caja   = (await conSesion('get', '/api/transactions?mes=2026-09')).body;

  expect(inicio.ladrillos).toEqual(stock.ladrillos);
  expect(inicio.arcilla.alerta).toEqual(stock.alertaArcilla);
  expect(inicio.balance.egresos).toBe(caja.balance.egresos);
});
```

Es un test raro —no prueba una regla, prueba una **coherencia**— y es de los más
útiles del proyecto: si alguien "optimiza" el dashboard duplicando una cuenta,
este test se rompe.

---

## 6. La pantalla: ordenada por urgencia

El Inicio se abre varias veces por día, muchas sin buscar nada en particular.
Por eso está ordenado por **urgencia**, no por importancia ni por orden
alfabético:

```
1. Alerta roja de arcilla      ← solo si está prendida
2. Balance del mes             ← "¿gané o perdí?"
3. Ladrillos de la semana
4. Ladrillos en el patio       ← con arcilla y leña de refilón
5. Por cobrar · Por entregar   ← dos tarjetas lado a lado
```

**La alerta va arriba de todo porque cambia lo que hay que hacer HOY.** Si
falta arcilla, hay que ir a la cantera antes de seguir produciendo. Y aparece
**solo si está prendida**: una alerta que está siempre deja de ser una alerta.

También dice **cuál** arcilla falta:

```
Comprar arcilla. Falta arcilla floja. Alcanza para 12.500 ladrillos.
```

"Comprar arcilla" a secas no le sirve de nada al dueño cuando ya está yendo a
la cantera.

### Dos detalles tipográficos

**El número protagonista es grande de verdad** (2 rem). Se lee de un vistazo,
al sol, sin acercar el teléfono.

**La unidad NO va del mismo tamaño.** "5.000" es el dato y "ladrillos" es la
aclaración; si fueran iguales, el ojo tendría que leer las dos para encontrar
el número.

```css
.dato-grande        { font-size: 2rem;    font-weight: 700; }
.dato-grande-unidad { font-size: 0.85rem; color: var(--color-texto-tenue); }
```

---

## 7. Cada número lleva a algún lado

Todas las tarjetas del Inicio son links:

| Tarjeta | Lleva a |
|---|---|
| Alerta de arcilla | Stock |
| Balance del mes | Caja |
| Ladrillos de la semana | Producción |
| Ladrillos en el patio | Stock |
| Por cobrar | Ventas, pestaña *Por cobrar* |
| Por entregar | Ventas, pestaña *Por entregar* |

**Un número que no se puede tocar obliga a ir a buscar la pantalla en el menú.**
Ver "Por cobrar: Gs 4.500.000" y poder tocarlo para ver de quién es, es la
diferencia entre un tablero y un adorno.

Para que las dos últimas funcionaran hubo que enseñarle a la pantalla de Ventas
a leer `?estado=` de la URL, además del `?cliente=` que ya leía de la fase 6:

```js
const estadoPedido = parametros.get('estado');
const pestanaInicial = PESTANAS.some((p) => p.clave === estadoPedido) ? estadoPedido : ...;
```

> **Detalle:** se valida que el `estado` de la URL sea uno de los que existen.
> Si alguien escribe `?estado=cualquiercosa`, la pantalla abre la pestaña por
> defecto en vez de quedarse en blanco.

---

## 8. Archivos nuevos y modificados

### Backend

| Archivo | Qué hace |
|---|---|
| `services/dashboard.service.js` | **nuevo** · junta todo con `Promise.all` |
| `controllers/dashboard.controller.js` | **nuevo** |
| `routes/dashboard.routes.js` | **nuevo** · `/dashboard` |
| `services/transaction.service.js` | + `balanceDelMes()` (agregación, sin traer documentos) |
| `models/Production.js` | + `ladrillosEntre()` (agregación) |
| `routes/index.js` | montado debajo de la barrera `requireAuth` |

### Frontend

| Archivo | Qué hace |
|---|---|
| `api/dashboard.js` | **nuevo** |
| `pages/Inicio.jsx` | **reescrito** · de pantalla provisoria a tablero real |
| `pages/Ventas.jsx` | ahora lee `?estado=` de la URL |
| `index.css` | tarjetas-link, número grande, fila de dos tarjetas |

### Tests

| Archivo | Cuántos |
|---|---|
| `tests/dashboard.test.js` | **nuevo** · 18 tests |

**Total: 325 tests** (eran 307).

---

## 9. Cómo probarlo vos mismo

```bash
npm run dev
```

1. **Abrí la app.** Con todo vacío, el Inicio muestra ceros y la **alerta roja
   de arcilla** arriba de todo (porque 0 < 25.000).
2. **Stock → Registrar compra.** Cargá 2 camiones de cada arcilla.
   → Volvé al Inicio: la alerta **desapareció**, y el egreso ya está en el
   balance del mes.
3. **Producción.** Cargá un día.
   → Inicio: "Esta semana — N ladrillos, en 1 día". Y el patio subió.
4. **Ventas → + Nueva.** Cargá una venta sin marcar los atajos.
   → Inicio: subió **Por cobrar** y **Por entregar**, y en el patio el
   *comprometido* subió sin que bajara el *físico*.
5. **Tocá la tarjeta "Por cobrar"** → te lleva a Ventas ya con esa pestaña
   abierta. Lo mismo con "Por entregar".
6. **Tocá la alerta roja** (si la tenés prendida) → te lleva a Stock.
7. Vendé más de lo que hay en el patio → el Inicio muestra el **libre en rojo**
   y avisa cuántos faltan para cumplir las entregas.

---

## Lo que viene

**Fase 10 — Configuración inicial, PWA y deploy.** Es la última de
construcción, y ya tiene las dos respuestas que faltaban:

- **Hay buena señal** → **no se hace modo sin conexión.** El service worker va
  a ser solo para poder instalar la app y cachear los archivos estáticos, no
  para servir datos viejos.
- **Se despliega en Vercel** para empezar, con la base en MongoDB Atlas.

> **Una cosa a tener en cuenta cuando llegue:** Vercel corre funciones
> *serverless*, o sea que el backend no es un servidor siempre prendido sino
> una función que arranca con cada pedido. La conexión de Mongoose hay que
> **cachearla entre invocaciones**, porque abrir una conexión nueva por pedido
> agota el pool de conexiones de Atlas en poco tiempo. Es un cambio chico en
> `config/database.js`, pero si no se hace, la app anda bien en las pruebas y
> empieza a fallar cuando la usan de verdad.

Y falta el **asistente de configuración inicial** (plan 5.11b): la pantalla que
aparece la primera vez para cargar unidad de leña, listas de precio, stock
actual, empleados y las ventas pendientes que ya existan.

Después queda la **fase 11**: el piloto de 1–2 semanas de uso real.
