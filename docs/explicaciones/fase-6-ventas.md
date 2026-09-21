# Fase 6 — Clientes y Ventas

> La fase más grande del plan. Una venta es la única operación del sistema que
> toca **todo**: la caja, el stock, los clientes y las listas de precio.
>
> Criterio del plan: *"Venta pagada hoy y entregada en 2 partes deja caja y
> stock correctos"*. ✅ Cumplido y verificado.

---

## Índice

1. [La idea que ordena toda la fase: tres momentos independientes](#1-la-idea-que-ordena-toda-la-fase-tres-momentos-independientes)
2. [El concepto central: dato derivado vs dato guardado](#2-el-concepto-central-dato-derivado-vs-dato-guardado)
3. [Snapshot vs referencia: cuándo copiar y cuándo apuntar](#3-snapshot-vs-referencia-cuándo-copiar-y-cuándo-apuntar)
4. [Los tres números del stock de ladrillos](#4-los-tres-números-del-stock-de-ladrillos)
5. [Quién calcula el precio (y por qué no el navegador)](#5-quién-calcula-el-precio-y-por-qué-no-el-navegador)
6. [Qué bloquea y qué solo avisa](#6-qué-bloquea-y-qué-solo-avisa)
7. [Agregaciones: cuentas hechas adentro de la base](#7-agregaciones-cuentas-hechas-adentro-de-la-base)
8. [El problema de las importaciones circulares](#8-el-problema-de-las-importaciones-circulares)
9. [Anular sin borrar, otra vez](#9-anular-sin-borrar-otra-vez)
10. [Las pantallas](#10-las-pantallas)
11. [Dos cosas que arreglé después de verlas funcionando](#11-dos-cosas-que-arreglé-después-de-verlas-funcionando)
12. [Archivos nuevos y modificados](#12-archivos-nuevos-y-modificados)
13. [Cómo probarlo vos mismo](#13-cómo-probarlo-vos-mismo)

---

## 1. La idea que ordena toda la fase: tres momentos independientes

Si te quedás con una sola cosa de este documento, que sea esta tabla. Está en
el plan (sección 5.7) y explica por qué el código está armado como está:

| Acción | Efecto en la caja | Efecto en el stock |
|---|---|---|
| **Crear la venta** | ninguno | ninguno en el físico; sube el **comprometido** |
| **Registrar un pago** | **ingreso** por ese monto | ninguno |
| **Registrar una entrega** | ninguno | **físico − cantidad** |

Los tres momentos son **independientes**. Se puede:

- cobrar sin entregar (el cliente paga por adelantado),
- entregar sin cobrar (cliente de confianza, paga a fin de mes),
- cobrar en tres veces y entregar en dos,
- cobrar y entregar todo junto en el acto (el caso más común).

### Por qué eso descarta la solución "obvia"

Lo natural sería poner un campo `estado` en la venta que vaya cambiando:
`pendiente` → `parcial` → `pagada`. Es lo primero que se le ocurre a
cualquiera, y es una trampa.

Con tres momentos independientes, un solo `estado` no alcanza: ¿qué pongo en
una venta cobrada pero no entregada? ¿`pagada`? Entonces pierdo que todavía
debo ladrillos. ¿`parcial`? Entonces no sé si lo parcial es la plata o los
ladrillos.

Por eso **son dos estados separados** (`estadoPago` y `estadoEntrega`) y, como
vas a ver en la sección siguiente, **ninguno de los dos se guarda**.

### Pero el caso común no tiene que ser el más largo

La venta típica de la ladrillera se cobra y se entrega en el acto. Si para eso
hubiera que crear la venta, después entrar al detalle, después registrar el
pago y después registrar la entrega, el sistema sería insufrible.

Por eso `crear()` acepta dos atajos: `pagadoCompleto` y `entregadoCompleto`.
El dueño marca dos casillas y el sistema hace las tres operaciones en una sola
transacción. El camino largo queda para los pedidos de verdad.

```js
// server/src/services/sale.service.js
if (pagadoCompleto && totales.montoTotal > 0) {
  await agregarPago(doc, { fecha, monto: totales.montoTotal, nombreCliente }, session);
}
if (entregadoCompleto) {
  await agregarEntrega(doc, { fecha, cantidad, nombreCliente }, session);
}
```

Fijate que `agregarPago` y `agregarEntrega` son las **mismas funciones** que
usan los endpoints `/pagos` y `/entregas`. No hay dos caminos que hagan "casi
lo mismo": el pago hecho desde el atajo y el pago hecho desde la pantalla de
detalle son idénticos, mismo ingreso de caja, mismo origen, mismo todo.

Eso importa más de lo que parece. Cuando hay dos caminos parecidos, tarde o
temprano uno recibe un arreglo y el otro no, y aparece el bug del tipo "si lo
cargo desde acá funciona, si lo cargo desde allá no".

---

## 2. El concepto central: dato derivado vs dato guardado

Este es **el** concepto de la fase 6. Vale la pena leerlo despacio.

### El problema

Una venta necesita mostrar: cuánto se cobró, cuánto falta cobrar, cuánto se
entregó, cuánto falta entregar, y los dos estados. Seis números.

La forma intuitiva es guardarlos. Un campo `cobrado`, un campo `porCobrar`, y
al registrar un pago se suma a uno y se resta al otro.

### Por qué eso se rompe

Contá los lugares donde habría que actualizar esos campos:

1. al crear la venta (inicializarlos),
2. al registrar un pago,
3. al **anular** un pago,
4. al registrar una entrega,
5. al anular una entrega,
6. al anular la venta entera.

Seis lugares. Y no son seis lugares de una sola vez: son seis lugares **para
siempre**, cada vez que alguien toque este código en los próximos años.

El día que uno de esos caminos se olvide de actualizar el total —y se va a
olvidar— el sistema empieza a mentir. Una venta figura como pagada cuando le
anularon el pago. Un cliente aparece debiendo plata que ya pagó. Y lo peor: no
hay ningún error, ninguna pantalla roja. El número simplemente está mal, y
nadie se entera hasta que el cliente viene a reclamar.

### La solución: no guardarlos

La regla es:

> **Si un dato se puede calcular a partir de otros, no se guarda: se calcula.**

Lo que **sí** se guarda son los **hechos**: cada pago y cada entrega, con su
fecha y su monto. Esos son datos que nadie puede deducir, hay que anotarlos.

Lo que se calcula es todo lo demás:

```js
// server/src/logic/sales.js
export function resumenVenta(venta) {
  const cobrado = sumarVigentes(venta.pagos, 'monto');
  const entregado = sumarVigentes(venta.entregas, 'cantidad');

  return {
    cobrado,
    porCobrar: Math.max(0, venta.montoTotal - cobrado),
    estadoPago: estadoDePago(venta.montoTotal, cobrado),
    entregado,
    porEntregar: Math.max(0, venta.cantidad - entregado),
    estadoEntrega: estadoDeEntrega(venta.cantidad, entregado),
  };
}
```

Anular un pago ahora es **una sola línea**:

```js
pago.deletedAt = new Date();
```

Ningún total que actualizar. `sumarVigentes()` saltea los anulados, así que la
deuda vuelve a aparecer sola. Es imposible que quede desactualizada, porque no
hay nada que actualizar.

### Dónde se enganchó

Para que la pantalla no tenga que acordarse de llamar a `resumenVenta()`, el
cálculo está metido en el `toJSON` del modelo:

```js
// server/src/models/Sale.js
toJSON: {
  transform(doc, ret) {
    Object.assign(ret, resumenVenta(ret));
    // ...
  },
},
```

Cada vez que una venta sale del servidor hacia el navegador, pasa por ahí. La
pantalla **nunca** suma pagos por su cuenta, y por eso no puede mostrar un
número distinto al de la base.

### El precio que se paga

Velocidad. Sumar cinco pagos cada vez que se lee una venta cuesta algo. En
este sistema es literalmente nada (cinco sumas), pero en un sistema con
millones de registros habría que pensarlo.

La regla práctica: **empezá siempre calculando**. Si algún día el sistema se
pone lento, medís y guardás ese número en particular, con la conciencia de que
estás aceptando el costo de mantenerlo sincronizado. Al revés —empezar
guardando por las dudas— se paga el costo desde el día uno, a cambio de una
velocidad que nadie necesitaba.

### Un detalle que parece tonto y no lo es

```js
export function estadoDePago(montoTotal, cobrado) {
  if (cobrado >= montoTotal) return 'pagado';   // <- primero ESTE
  if (cobrado <= 0) return 'pendiente';
  return 'parcial';
}
```

El orden importa. Una venta con 100 % de descuento tiene `montoTotal = 0` y
`cobrado = 0`. Si preguntáramos primero por el cero, diría "pendiente" y esa
venta quedaría para siempre en la lista de deudores, por una deuda de cero
guaraníes.

Hay un test específico para eso, porque es el tipo de caso que uno no imagina
hasta que pasa:

```js
it('una venta de total cero nace pagada, no pendiente', () => {
  expect(estadoDePago(0, 0)).toBe('pagado');
});
```

---

## 3. Snapshot vs referencia: cuándo copiar y cuándo apuntar

La venta hace **las dos cosas**, y la diferencia no es un capricho.

```js
// server/src/models/Sale.js
precioPorMil, listaPrecioNombre  ->  COPIA (snapshot)
clientId                         ->  REFERENCIA (apunta al cliente)
```

La pregunta que decide cuál usar es siempre la misma:

> **Si el original cambia mañana, ¿esta venta tendría que cambiar también?**

**El precio: NO.** Si en octubre sube la lista Mayorista, la venta de
septiembre se hizo al precio de septiembre. Cambiarla sería falsear el pasado.
→ se copia.

**El nombre del cliente: SÍ.** Si se cargó "Juan Peres" y era "Juan Pérez",
corregirlo tiene que corregir todas sus ventas. → se apunta.

Los dos errores son silenciosos:

- **Copiar cuando había que apuntar** deja datos viejos desparramados que ya
  nadie puede corregir. Corregís el nombre en la ficha del cliente y las
  ventas siguen mostrando el error de tipeo.
- **Apuntar cuando había que copiar** reescribe la historia. Subís un precio y
  de golpe las ventas del año pasado valen otra cosa.

Hay un test para cada uno:

```js
it('cambiar la lista DESPUES no cambia las ventas ya hechas (snapshot)', ...)
it('corregir el nombre se ve en sus ventas viejas (es referencia, no snapshot)', ...)
```

> **Cómo se ve en la práctica:** la venta guarda `clientId`, y al consultarla
> se usa `.populate('clientId')`, que le pide a Mongo que traiga el cliente
> entero en vez del id. El `toJSON` del modelo lo separa en dos campos
> (`clientId` y `cliente`) para que la pantalla no tenga que preguntarse qué le
> llegó.
>
> Ahí hay una trampa que casi me come: un ObjectId de Mongo **tiene** una
> propiedad `.id` (es el buffer crudo del identificador). Entonces
> `if (ret.clientId.id)` daría verdadero aunque no esté populado. Hay que
> preguntar por un campo que solo existe si de verdad vino el cliente:
> `if (ret.clientId?.nombre)`.

---

## 4. Los tres números del stock de ladrillos

Hasta la fase 5, los ladrillos tenían un solo número: cuántos hay. Ahora tienen
tres:

```
físico       = lo que hay en el patio           (producido − entregado)
comprometido = lo vendido que falta entregar
libre        = físico − comprometido
```

### Por qué hacen falta los tres

Porque responden tres preguntas distintas:

- **físico**: "¿cuántos ladrillos puedo tocar?" — lo que se cuenta parado en el
  patio.
- **comprometido**: "¿cuántos de esos ya tienen dueño?"
- **libre**: "¿cuántos puedo vender hoy sin quedarle mal a nadie?"

Crear una venta **sube el comprometido sin tocar el físico**, y eso tiene todo
el sentido: los ladrillos siguen ahí, apilados, nadie se los llevó. Pero ya no
son tuyos para vender de nuevo.

### El libre puede ser negativo, y está bien

```js
it('el libre PUEDE ser negativo, y eso es informacion, no un error', () => {
  expect(stockLadrillos(3_000, 10_000).libre).toBe(-7_000);
});
```

Un libre de −7.000 significa: hay 10.000 vendidos y solo 3.000 fabricados. Hay
que producir 7.000 antes de las entregas. Es un dato útil, no un error. Si lo
forzáramos a cero, estaríamos escondiendo justo la información que el dueño
necesita.

### El comprometido tampoco se guarda

Coherente con la sección 2: el comprometido es la suma de lo que falta entregar
de todas las ventas vigentes. No hay ningún campo `comprometido` en la base.
Se calcula con una agregación cada vez que se pide el stock.

Por eso **baja solo** cuando se entrega: `porEntregar = cantidad − entregado`,
y al sumar una entrega, baja. Nadie tiene que acordarse de restarlo.

Esto se ve clarísimo en el test del criterio de la fase:

```
Al crear la venta:      físico 10.000 · comprometido 5.000 · libre 5.000
Después de entregar 2.000: físico  8.000 · comprometido 3.000 · libre 5.000
Después de entregar 3.000: físico  5.000 · comprometido     0 · libre 5.000
```

Mirá la columna del **libre**: no se mueve. Tiene sentido — esos 5.000 ya
estaban apartados desde que se hizo la venta. Entregarlos no cambia cuántos te
quedan para vender.

---

## 5. Quién calcula el precio (y por qué no el navegador)

La cuenta es la del plan:

```
subtotal    = cantidad / 1000 × precioPorMil
descuentoGs = porcentaje → subtotal × % / 100
              monto      → el valor tal cual
montoTotal  = subtotal − descuentoGs
```

Ejemplo del plan: 5.000 ladrillos, lista a 1.000.000 el millar, 10 % →
subtotal 5.000.000, descuento 500.000, **total 4.500.000**.

### La cuenta está escrita dos veces, a propósito

- `server/src/logic/sales.js` → la del servidor
- `client/src/utils/ventas.js` → la de la pantalla

La pantalla la necesita para mostrar el total **mientras se escribe**.
Preguntarle al servidor por cada tecla sería lento y no funcionaría sin señal.

### Y por qué eso no es peligroso

Porque la copia del navegador **no decide nada**. Cuando se toca Guardar, la
pantalla manda la cantidad, la lista y el descuento; el total lo vuelve a
calcular el servidor con el precio que tiene guardado, y ese es el que se
graba.

> **La copia es para MOSTRAR. La original es para DECIDIR.**

Si se confiara en el número del navegador, cualquiera podría mandar
`montoTotal: 1` con un programa de dos líneas. Hay un test que lo verifica:

```js
it('IGNORA un montoTotal mandado desde afuera', async () => {
  const res = await vender({ montoTotal: 1, subtotal: 1 });
  expect(res.body.venta.montoTotal).toBe(5_000_000);
});
```

El validador de Zod directamente **no acepta** esos campos: `crearVentaSchema`
tiene `fecha`, `clientId`, `cantidad`, `listaPrecioId`, `descuento` y los dos
atajos. Nada más. Lo que venga de más se descarta antes de llegar al servicio.

### Se guarda el descuento, no solo su resultado

```js
descuento:    { tipo: 'porcentaje', valor: 10 }   // lo que pidió el dueño
descuentoGs:  500000                              // el resultado
```

Los dos. Guardando solo el resultado, un año después nadie puede contestar "¿por
qué esta venta salió 4.500.000?". Guardando los dos, la pantalla de detalle
puede mostrar literalmente `Descuento (10 %) − Gs 500.000`.

---

## 6. Qué bloquea y qué solo avisa

Esta distinción ya apareció en la fase 4, pero acá es donde de verdad importa.

### Bloquean (son errores, no decisiones)

| Regla | Por qué |
|---|---|
| Cobrar más de lo que falta | Es un error de tipeo. Dejarlo pasar ensucia la caja con plata que nunca entró. |
| Entregar más de lo vendido | Es imposible por definición. Si el cliente se lleva más, eso es **otra venta**. |
| Cliente obligatorio si queda algo pendiente | Sin cliente no hay a quién reclamarle. |
| Eliminar un cliente que todavía debe | La deuda desaparecería de la lista sin que nadie haya pagado. |
| Anular una venta con pagos o entregas | Hay que anular esos primero, de a uno. |

### Avisan (son decisiones del dueño)

| Situación | Por qué no se bloquea |
|---|---|
| Vender por más que el **libre** | Puede estar tomando un pedido que va a producir la semana que viene. Bloquearlo sería impedirle hacer negocio. |
| Entregar por más que el **físico** | El número del sistema puede estar desactualizado y **el patio siempre tiene razón**. Si el camión ya cargó, ya cargó. Bloquear no devuelve los ladrillos: solo impide registrar lo que ya pasó. |

El segundo caso es el más interesante. El stock queda en negativo, y eso es
correcto: es una señal clarísima de que hay que hacer un ajuste. Hay un test
que lo deja escrito:

```js
it('entregar mas que el fisico avisa pero guarda igual, y el stock queda negativo', ...)
  expect(res.body.stock.ladrillos.fisico).toBe(-2_000);
```

### El cliente obligatorio tiene una sutileza

La regla no es "toda venta necesita cliente". Es "toda venta que **deja algo
pendiente** necesita cliente". Y eso se mira **después** de aplicar los atajos:

```js
const quedaPorCobrar   = pagadoCompleto    ? 0 : totales.montoTotal;
const quedaPorEntregar = entregadoCompleto ? 0 : cantidad;

if ((quedaPorCobrar > 0 || quedaPorEntregar > 0) && !clientId) {
  throw new ApiError(400, 'Esta venta deja algo pendiente, asi que hay que elegir el cliente.');
}
```

Una venta de mostrador cobrada y entregada en el acto **no necesita cliente**, y
tener que cargar uno sería una molestia inútil. Pero si queda un guaraní sin
cobrar o un ladrillo sin entregar, sí.

---

## 7. Agregaciones: cuentas hechas adentro de la base

Hasta ahora, cuando el sistema necesitaba sumar algo, traía los documentos y
sumaba en JavaScript. Para el comprometido eso no sirve: con mil ventas serían
mil documentos viajando por la red para devolver **un solo número**.

Una **agregación** es una cuenta que hace Mongo adentro de la base. Se le manda
una lista de pasos ("pipeline") y devuelve solo el resultado:

```js
// server/src/models/Sale.js
saleSchema.statics.totalComprometido = async function (session) {
  const consulta = this.aggregate([
    { $match: { deletedAt: null } },              // 1. solo las vigentes
    { $project: { porEntregar: POR_ENTREGAR } },  // 2. calcular el pendiente
    { $group: { _id: null, total: { $sum: '$porEntregar' } } },  // 3. sumar
  ]);
  // ...
};
```

Y `POR_ENTREGAR` es la versión en "lenguaje Mongo" de `sumarVigentes()`:

```js
{ $max: [0, { $subtract: ['$cantidad', sumaDeVigentes('entregas', 'cantidad')] }] }
```

Es más difícil de leer que el JavaScript, sí. Por eso está escrito una sola vez,
como constante con nombre, y se reutiliza en las cuatro agregaciones del modelo.

### La trampa que casi me come

> En una agregación, Mongo **NO convierte** el texto de un id a ObjectId por su
> cuenta. En un `find()` sí lo hace.

Eso significa que `{ $match: { clientId: "6ab17ff1..." } }` no encuentra nada.
Y lo peor: **no avisa**. No tira error, simplemente devuelve cero resultados.
Es el tipo de bug que cuesta horas porque parece que "no hay datos".

La solución es convertir a mano:

```js
if (clientId) filtro.clientId = new mongoose.Types.ObjectId(String(clientId));
```

### Filtrar por algo que no está guardado

Las pestañas "Por cobrar" y "Por entregar" tienen un problema real: esos
números **no son campos**, así que Mongo no puede filtrarlos con un `find()`.

Había dos salidas:

**(a)** Traer todas las ventas y filtrarlas en JavaScript. Simple, pero con el
tiempo serían miles de documentos viajando para mostrar diez.

**(b)** Pedirle a Mongo que calcule el pendiente adentro, quedarse con los ids
que dan mayor a cero, y después traer solo esos.

Elegí **(b)**. Son dos consultas en vez de una, pero la primera devuelve solo
ids y la segunda solo las ventas que se van a mostrar:

```js
if (estado) {
  const ids = await Sale.idsConPendiente(estado, filtro);
  if (ids.length === 0) return [];
  filtro._id = { $in: ids };
}
```

---

## 8. El problema de las importaciones circulares

Este es un problema de **arquitectura** que apareció de golpe y vale la pena
entenderlo, porque se repite en todos los proyectos.

### Qué pasó

`inventory.service.js` necesita el comprometido para armar el stock. El
comprometido sale de las ventas. Entonces lo natural sería:

```
inventory.service  →  sale.service     ("dame el comprometido")
```

Pero `sale.service` ya importa a `inventory.service` (para mover el stock al
entregar):

```
sale.service  →  inventory.service     ("moveme estos ladrillos")
```

Las dos juntas dan un **ciclo**:

```
inventory.service ⇄ sale.service
```

### Por qué es un problema

En JavaScript un ciclo de importaciones **no explota**. Es peor: uno de los dos
módulos queda **a medio cargar**, y alguna de sus funciones llega como
`undefined`. El error aparece mucho después, en un lugar que no tiene nada que
ver, y con un mensaje que no ayuda.

### La solución

Mover las agregaciones al **modelo** en vez del servicio:

```js
Sale.totalComprometido()   // <- static del modelo, no del servicio
```

Los servicios importan modelos; los modelos no importan servicios. Entonces la
flecha va siempre en la misma dirección y **no hay ciclo posible**:

```
inventory.service  →  models/Sale.js
client.service     →  models/Sale.js
sale.service       →  inventory.service  →  models/Sale.js
```

### La lección general

> Cuando dos módulos se necesitan mutuamente, casi siempre significa que hay
> una tercera cosa adentro de uno de ellos que en realidad no pertenece ahí.

Acá esa tercera cosa eran las agregaciones: son preguntas **sobre la colección
de ventas**, no reglas de negocio. Su lugar natural era el modelo desde el
principio; el ciclo solo lo hizo evidente.

---

## 9. Anular sin borrar, otra vez

Mismo patrón de las fases 4 y 5, ahora aplicado a tres niveles:

| Se anula | Qué pasa |
|---|---|
| un **pago** | se marca `deletedAt` y se anula su ingreso de caja |
| una **entrega** | se marca `deletedAt` y se crea el movimiento **inverso** de stock |
| la **venta** entera | solo si no tiene pagos ni entregas vigentes |

Los pagos y las entregas viven **adentro** de la venta (son subdocumentos), así
que anularlos es marcar una línea del array. `sumarVigentes()` los saltea y
todos los totales se corrigen solos.

### Por qué los subdocumentos de acá sí llevan `_id`

En `Production`, los trabajadores van con `_id: false`, porque nadie los
referencia de a uno. Acá es al revés: la API tiene rutas como

```
DELETE /sales/:id/pagos/:pagoId
```

o sea que cada pago necesita un nombre propio para poder anularlo. Por eso
llevan su `_id` (que Mongoose pone solo).

### Por qué anular la venta no anula todo en cascada

Sería más cómodo, y por eso mismo es peligroso. Anular una venta cobrada y
entregada son **tres cosas distintas** pasando a la vez: sale plata de la caja,
vuelven ladrillos al patio, desaparece el pedido.

Un botón que deshace media jornada de un toque es un botón peligroso. Mejor que
el dueño las vea de a una y confirme cada una:

```
Esta venta tiene pagos y entregas registrados.
Anulalos primero y despues anula la venta.
```

En la pantalla, el botón "Anular la venta" ni siquiera aparece si la venta tiene
movimientos: mostrar un botón que va a dar error no sirve para nada.

---

## 10. Las pantallas

### Ventas — tres pestañas y un botón

Las pestañas no son un adorno: son las tres preguntas que el dueño se hace de
verdad.

- **Por cobrar** → "¿quién me debe plata?"
- **Por entregar** → "¿a quién le debo ladrillos?"
- **Todas** → el historial

Son listas **distintas**, no dos filtros de la misma, porque una venta puede
estar en las dos, en una sola o en ninguna. Un cliente que pagó todo por
adelantado no debe plata pero sí espera ladrillos.

El formulario de alta muestra el total **en vivo** mientras se escribe, y el
aviso de stock aparece y desaparece solo:

```
Hay 20.000 ladrillos libres: faltan 5.000.
Se puede vender igual, pero hay que reponerlos antes de la entrega.
```

### Detalle de venta — donde pasan las cosas

Dos detalles de diseño que parecen chicos y no lo son:

**1. El monto viene precargado con lo que falta.** El caso normal es que el
cliente salde la cuenta: se abre, se confirma, listo. Cuando paga una parte, se
corrige. Lo verifiqué funcionando:

```
Primer cobro   → precargado con Gs 4.500.000  (todo lo que falta)
Primera entrega → precargado con 5.000        (todo)
Segunda entrega → precargado con 3.000        (lo que quedaba)
```

**2. Cobrar y entregar son dos botones separados**, aunque casi siempre pasen
juntos. Si fueran uno solo, registrar un pago sin entrega —o al revés—
obligaría a entrar a un menú escondido, y justamente esos son los casos donde
más importa no equivocarse.

### Clientes — la lista con saldos

La lista de clientes **sin** los saldos no le sirve para nada al dueño: los
nombres de sus clientes ya se los sabe. Lo que necesita saber, parado en la
fábrica, es **quién le debe y cuánto**. Por eso el saldo va en la misma fila.

Tocar un nombre lleva a **sus ventas**, no a su ficha: después de ver "debe
3.000.000" la pregunta que sigue es siempre "¿de qué ventas?".

El filtro viaja en la URL (`/ventas?cliente=abc123`) y no en el estado del
componente. Dos ventajas: el botón "atrás" del celular vuelve a la lista
completa, y el link se puede guardar o compartir.

> **Detalle:** con un cliente filtrado, los totales de arriba muestran **su**
> saldo, no el del sistema. Dejar los totales generales arriba de una lista
> filtrada es la forma más fácil de leer mal un número.

### El problema N+1

Para armar la lista con saldos hacen falta los clientes y sus saldos. La forma
ingenua sería: traer los clientes, y para cada uno preguntar su saldo. Con 40
clientes serían **41 viajes** a la base. Ese es el problema clásico "N+1".

La forma correcta son **dos** consultas, y juntarlas en memoria:

```js
const [clientes, resumenes] = await Promise.all([
  Client.find(VIGENTES).sort({ nombre: 1 }),
  Sale.resumenPorCliente(),
]);

const porCliente = new Map(resumenes.map((r) => [String(r._id), r]));
```

Un `Map` y no un `.find()` adentro del bucle: con `.find()` serían
clientes × ventas comparaciones; con el `Map`, una búsqueda directa.

---

## 11. Dos cosas que arreglé después de verlas funcionando

Las dos aparecieron probando la app en el navegador, no en los tests. Es un
buen recordatorio de que los tests verifican que el sistema **haga lo
correcto**, no que se **entienda**.

### 11.1 Un número sin formatear

El mensaje de protección decía:

```
No se puede eliminar a Juan Perez: debe 4500000 Gs.
```

`4500000` obliga a contar ceros con el dedo. Agregué `formatearGsSimple()` en
`logic/money.js` y quedó:

```
No se puede eliminar a Juan Perez: debe Gs 4.500.000.
```

Es el mismo criterio del frontend, pero del lado del servidor: acá no se
formatea "para mostrar en pantalla", se formatea porque **el texto va a quedar
guardado adentro de un mensaje**.

### 11.2 Un error que borraba la pantalla

Este es más interesante. Al intentar eliminar un cliente con deuda, el mensaje
aparecía... y **la lista de clientes desaparecía**, reemplazada por el error y
un botón "Reintentar".

El motivo: había un solo estado de error, y el render hacía
`{!cargando && errorCarga && (...)}`, que reemplaza todo.

Pero son **dos situaciones distintas**:

| Estado | Qué significa | Qué hay que mostrar |
|---|---|---|
| `errorCarga` | no se pudieron traer los datos | no hay lista que mostrar → la pantalla se reemplaza por el error + Reintentar |
| `errorAccion` | los datos están bien, pero una acción fue rechazada | la lista **tiene** que seguir ahí |

El segundo caso es una **regla de negocio explicándose**, no un fallo del
sistema. Y el mensaje habla de una fila que el dueño está mirando: hacerla
desaparecer para mostrar el aviso es dejarlo sin contexto justo cuando más lo
necesita.

Separé los dos estados en `Clientes.jsx` y `VentaDetalle.jsx`. Ahora queda:

```
No se puede eliminar a Juan Perez: debe Gs 4.500.000. Cerra esas ventas primero.

Juan Perez
0981 123 456
Debe Gs 4.500.000
[Editar] [Eliminar]
```

> **Nota:** `Produccion.jsx` (fase 5) tiene exactamente el mismo problema al
> anular una producción de una semana ya liquidada. Lo dejé anotado como tarea
> aparte para no mezclarlo con esta fase.

---

## 12. Archivos nuevos y modificados

### Backend

| Archivo | Qué hace |
|---|---|
| `logic/sales.js` | **nuevo** · las cuentas: totales, descuentos, estados, avisos |
| `logic/money.js` | + `formatearGsSimple()` y `formatearNumero()` para los mensajes |
| `models/Client.js` | **nuevo** · nombre, teléfono, notas |
| `models/Sale.js` | **nuevo** · la venta + 4 agregaciones como statics |
| `services/client.service.js` | **nuevo** · CRUD + saldos calculados |
| `services/sale.service.js` | **nuevo** · el corazón: crear, cobrar, entregar, anular |
| `services/inventory.service.js` | ahora el `comprometido` sale de las ventas |
| `validators/sale.validator.js` | **nuevo** · clientes y ventas |
| `controllers/sale.controller.js` | **nuevo** |
| `routes/sale.routes.js` | **nuevo** · `/clients` y `/sales` |
| `routes/index.js` | montados debajo de la barrera `requireAuth` |

### Frontend

| Archivo | Qué hace |
|---|---|
| `api/clients.js`, `api/sales.js` | **nuevos** |
| `api/caja.js` | + `listarListasPrecio()` |
| `utils/ventas.js` | **nuevo** · la cuenta del total, para mostrar en vivo |
| `pages/Ventas.jsx` | **nuevo** · pestañas + alta |
| `pages/VentaDetalle.jsx` | **nuevo** · cobros y entregas |
| `pages/Clientes.jsx` | **nuevo** · lista con saldos |
| `pages/Stock.jsx`, `pages/Caja.jsx` | textos de ayuda actualizados |
| `App.jsx`, `Mas.jsx`, `index.css` | rutas, menú y estilos nuevos |

### Tests

| Archivo | Cuántos |
|---|---|
| `tests/sales-logic.test.js` | **nuevo** · 27 tests de funciones puras |
| `tests/sales.test.js` | **nuevo** · 34 tests contra la API |
| `tests/clients.test.js` | **nuevo** · 16 tests |

**Total: 231 tests** (eran 154).

---

## 13. Cómo probarlo vos mismo

```bash
npm run dev
```

Y en el celular (o el navegador en 375 px):

1. **Más → Clientes → + Nuevo.** Cargá un cliente con nombre y teléfono.
2. **Ventas → + Nueva.** Elegí el cliente, poné `5000`, dejá la lista
   "Normal", elegí descuento "Porcentaje" y escribí `10`.
   → abajo tiene que aparecer **Subtotal 5.000.000 · Descuento −500.000 ·
   Total 4.500.000**.
3. Subí la cantidad a `25000` → aparece el aviso amarillo de stock. Bajala de
   nuevo → desaparece.
4. Guardá, y entrá a la venta tocándola.
5. **+ Registrar cobro** → viene precargado con los 4.500.000. Cambialo a
   `2000000` y guardá. Ahora dice **Cobrado 2.000.000 · Por cobrar 2.500.000**.
6. **Caja** → ahí está el ingreso, categoría "Venta", generado solo.
7. Volvé a la venta, **+ Registrar entrega** dos veces: `2000` y después
   `3000`.
8. **Stock** → el físico bajó 5.000 y el comprometido volvió a 0.
9. Volvé a la venta y **anulá el pago** → la deuda reaparece.
   **Caja** → el ingreso desapareció.
10. **Clientes → Eliminar** ese cliente → el sistema no te deja, y te dice
    exactamente cuánto debe. La lista se queda donde está.

---

## Lo que viene

**Fase 7 — Adelantos.** Es corta: alta y anulación de adelantos, con su egreso
de caja al instante. Reutiliza casi todo lo que ya está construido
(`transaction.service`, el patrón de anulación, el molde de pantalla).

Después viene la **fase 8 (liquidación semanal)**, que es donde se juntan la
producción de la fase 5, los adelantos de la 7 y la deuda arrastrada.
