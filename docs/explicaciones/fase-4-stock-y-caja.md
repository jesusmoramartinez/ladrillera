# Fase 4 — Stock, caja y las transacciones de MongoDB

> Criterio del plan: **"Registrar una compra suma stock y aparece el egreso en caja."**
> Fecha: 21/09/2026.

---

## 0. Resumen de lo que ahora existe

**Backend**

| Archivo | Para qué |
|---|---|
| `server/src/config/database.js` | Se le sumó `conTransaccion()`: el "todo o nada" |
| `server/src/logic/inventory.js` | Conversión camiones ↔ interna, alerta de arcilla |
| `server/src/models/Setting.js` | La configuración (documento único) |
| `server/src/models/Category.js` | Categorías de caja, con las de sistema protegidas |
| `server/src/models/PriceList.js` | Listas de precio (se usan en la fase 6) |
| `server/src/models/Inventory.js` | El stock actual de cada material |
| `server/src/models/InventoryMovement.js` | El historial: por qué cambió el stock |
| `server/src/models/Transaction.js` | Los movimientos de caja |
| `server/src/services/inventory.service.js` | Compras, uso de leña, ajustes, anulación |
| `server/src/services/transaction.service.js` | Balance del mes, gastos, anulación |
| `server/src/services/category.service.js` | ABM de categorías |
| `server/src/services/priceList.service.js` | ABM de listas, con una sola predeterminada |
| `server/src/services/settings.service.js` | Leer y cambiar la configuración |
| `server/src/services/seed.service.js` | Los datos con los que el sistema nace |
| `server/scripts/seed.js` | `npm run seed --workspace server` |
| `server/tests/inventory.test.js` | 20 tests de stock y transacciones |
| `server/tests/caja.test.js` | 29 tests de caja, categorías y listas |

**Frontend**

| Archivo | Para qué |
|---|---|
| `client/src/pages/Stock.jsx` | Arcilla, leña, ladrillos, compras, uso, ajustes |
| `client/src/pages/Caja.jsx` | Balance del mes y movimientos |
| `client/src/components/InputCantidad.jsx` | Cantidades **con** decimales |
| `client/src/components/CampoSelect.jsx` | Lista desplegable nativa |
| `client/src/api/inventory.js`, `api/caja.js` | Una función por endpoint |
| `client/src/utils/format.js` | Se le sumaron cantidades y meses |

---

## 1. El concepto de la fase: transacciones de MongoDB

Esta es la idea nueva más importante, y es la que el plan (sección 5.1) pone
como requisito.

### El problema

Registrar una compra de arcilla son **tres escrituras** distintas en la base:

1. Sumar 50.000 al stock de arcilla pura.
2. Anotar la línea en el historial de movimientos.
3. Crear el egreso de Gs 3.000.000 en la caja.

Si el servidor se cae, se corta internet o falla la base **después de la
primera** y antes de la tercera, te queda stock sumado que nadie pagó. Los
números dejan de cerrar y, peor, no hay forma de saber cuál faltó.

### La solución

Una **transacción** agrupa varias escrituras y garantiza que pasen **todas o
ninguna**. Si algo falla en el medio, la base deshace sola lo anterior.

```js
await conTransaccion(async (session) => {
  await Inventory.updateOne(filtro, cambio, { session });
  await InventoryMovement.create([datos], { session });
  await Transaction.create([egreso], { session });
});
```

### Tres detalles que muerden

**1. Hay que pasar `session` a CADA operación.** Si te olvidás en una, esa
escritura queda **fuera** de la transacción y no se deshace si el resto falla.
Es el error típico y no avisa: todo parece funcionar hasta el día que algo
falla en el medio.

**2. `create()` necesita un array.** Dentro de una transacción hay que llamarlo
como `create([datos], { session })`. La forma normal, `create(datos, { session })`,
ignora las opciones en silencio.

**3. MongoDB solo permite transacciones en "replica sets"** (varias copias de la
base coordinadas entre sí). Atlas lo es siempre. Un `mongod` suelto instalado a
mano **no sirve**, y por eso el entorno de tests levanta su base en memoria
configurada como replica set — eso ya estaba preparado desde la fase 2,
justamente esperando este momento.

`conTransaccion()` detecta ese caso y devuelve un mensaje claro en vez del error
críptico de la base.

### El test que lo demuestra

Un test que se pasa de vueltas a propósito: borra la categoría de sistema que la
compra necesita, para forzar un fallo **después** de haber tocado el stock.

```js
await Category.deleteOne({ clave: 'compra_material' });
const res = await comprar({ cantidad: 2, monto: 3_000_000 });
expect(res.status).toBe(500);

// Lo importante: no quedó NADA a medio hacer.
expect(stock?.cantidad ?? 0).toBe(0);
expect(await InventoryMovement.countDocuments()).toBe(0);
expect(await Transaction.countDocuments()).toBe(0);
```

Sin la transacción, ese test fallaría: el stock habría quedado en 50.000.

---

## 2. El segundo concepto: por qué la arcilla se guarda "en ladrillos"

La arcilla se **compra** por camión, pero se **consume** por ladrillo: cada
25.000 ladrillos producidos se gasta 1 camión de arcilla pura y 1 de floja
(plan, 5.1). Producir 5.000 ladrillos gasta 0,2 camión de cada una.

La tentación es guardar "0,2 camiones". Está mal, y el motivo es el mismo que ya
vimos con el dinero:

```js
0.1 + 0.2 === 0.30000000000000004   // true, lamentablemente
```

Sumando y restando decimales cientos de veces a lo largo de un año, el stock se
iría corriendo de a poquito y nadie sabría por qué.

**La solución:** guardar la arcilla en **ladrillos-equivalentes**, que son
enteros. Un camión son 25.000. En la pantalla se divide para mostrar "2,5
camiones", pero adentro siempre son enteros y las cuentas son exactas.

Verificado en el navegador: comprar **2,5 camiones** guardó **62.500** (entero) y
la pantalla volvió a mostrar "2,5 camiones".

Es el mismo criterio que con los guaraníes: **el dato se guarda en la unidad más
chica y exacta; la unidad cómoda es solo para mostrar.**

---

## 3. La alerta de arcilla

El plan (5.5) la define así:

```
disponible = mínimo(arcilla_pura, arcilla_floja)
si disponible < 25.000  ->  Alerta Roja
```

**Por qué el mínimo y no la suma:** se necesitan las dos arcillas al mismo
tiempo. Si tenés 10 camiones de pura y medio de floja, podés producir lo que dé
el medio camión de floja. La que primero se acaba manda.

La alerta también dice **cuál** falta, porque un aviso de "comprar arcilla" sin
decir cuál no le sirve de nada al dueño cuando llega a la cantera.

Verificado en la app: con pura en 0 y floja en 1,5 camiones, el cartel rojo dijo
*"Comprar arcilla. Falta arcilla pura. Alcanza para 0 ladrillos."*. Al comprar
2,5 camiones de pura, desapareció solo.

El umbral no está escrito en el código: sale de `settings`, y hay un test que lo
cambia a 50.000 y verifica que la alerta empiece a saltar antes.

---

## 4. Dos colecciones para el stock, y por qué

Podría haber una sola. Hay dos a propósito:

| Colección | Qué guarda | Para qué |
|---|---|---|
| `inventory` | El total actual de cada material | Leerlo rápido |
| `inventoryMovements` | Cada cambio, con su motivo | Saber **por qué** y poder revertir |

**Se podría no tener `inventory`** y calcular el stock sumando todos los
movimientos cada vez. Sería más "puro", pero dentro de un año serían miles de
sumas para dibujar una pantalla que se abre todo el tiempo.

**El precio de tener las dos** es que hay que mantenerlas sincronizadas. Y eso es
exactamente lo que garantiza la transacción: las dos escrituras van juntas o no
va ninguna.

### El historial no se edita ni se borra nunca

`inventoryMovements` no tiene `deletedAt`, porque no hay nada que borrar. Un
error se corrige **agregando el movimiento contrario**, igual que en
contabilidad.

Eso se ve en la anulación de una compra:

```
+50.000  COMPRA      Arcilla pura   Cantera del norte
-50.000  ANULACION   Arcilla pura   Anulacion de: Cantera del norte
```

El historial cuenta lo que realmente pasó: se compró y después se anuló.

### Por qué el inverso se toma del historial

Al anular no se recalcula "2 camiones × 25.000". Se lee el movimiento original y
se crea uno con **el mismo número y signo contrario**:

```js
cantidad: -original.cantidad
```

¿Por qué importa? Porque si alguien cambió `ladrillosPorCamion` entre la compra y
la anulación, recalcular daría un número distinto y el stock quedaría torcido.
Copiando el original, la reversión es exacta siempre.

---

## 5. La caja

### El monto siempre es positivo

Un movimiento de caja tiene `tipo: 'ingreso' | 'egreso'` y `monto` **siempre
positivo**.

La alternativa sería guardar los egresos en negativo. Se eligió así porque con
montos negativos es facilísimo equivocarse de signo en una cuenta y terminar
**sumando** un gasto. Con tipo + monto positivo, el signo lo decide un solo lugar
del código.

### El snapshot del nombre de la categoría

Cada movimiento guarda `categoriaId` **y** `categoriaNombre`. Eso es un
**snapshot**: una foto del dato en el momento en que pasó.

Si el dueño renombra "Combustible" a "Nafta", los gastos viejos siguen diciendo
"Combustible", que es lo que realmente eran ese día. Sin el snapshot, cambiar un
nombre reescribiría la historia hacia atrás.

Hay un test que desactiva una categoría con gastos ya cargados y verifica que el
gasto siga mostrando su nombre correcto.

Es la misma idea que el plan pide para las tarifas de los empleados (4.3) y para
los precios de venta (4.6c). Vale la pena reconocer el patrón: **cuando un dato
puede cambiar en el futuro pero el registro tiene que conservar lo de ese día, se
copia adentro.**

### Los movimientos automáticos no se anulan a mano

En la pantalla de Caja, el egreso de una compra **no tiene botón "Anular"**. Solo
lo tienen los gastos cargados a mano.

Si se pudiera anular el egreso por separado, quedaría una compra con el stock
sumado y sin el gasto: los números dejarían de cerrar. Hay que anular la compra,
y el egreso se va con ella.

Verificado por API:

```
9. Anular egreso de compra a mano   400 "Este movimiento lo genero otra
                                        operacion. Anula esa operacion y el
                                        movimiento se va con ella."
```

### El balance compara fechas como texto

```js
fecha: { $gte: '2026-09-01', $lte: '2026-09-31' }
```

Parece un truco sucio y en realidad es la parte más limpia. Las fechas de negocio
se guardan como `"YYYY-MM-DD"` (plan, 5.4) y **en ese formato el orden alfabético
coincide con el cronológico**. Mongo puede comparar directamente, sin convertir
nada y sin que se meta ninguna zona horaria en el medio.

(`"2026-09-31"` no existe como fecha, pero como **texto** es mayor que cualquier
día real de septiembre, que es todo lo que necesitamos para el límite superior.)

---

## 6. Las categorías de sistema

Hay dos clases de categoría, y la diferencia importa:

| | `sistema: true` | `sistema: false` |
|---|---|---|
| Ejemplos | Venta, Compra de material, Adelanto, Sueldos | Combustible, Flete, Herramientas… |
| Quién las usa | El código, cuando genera un movimiento solo | El dueño, al cargar un gasto |
| Se pueden renombrar | **No** | Sí |
| Se pueden borrar | **No** | Sí (soft delete) |
| Aparecen al cargar un gasto | **No** | Sí |

**Por qué tanto celo.** El código las busca por su `clave` (`'compra_material'`)
para generar los movimientos automáticos. Si el dueño pudiera borrar "Compra de
material", la próxima compra fallaría con un error que no tendría nada que ver
con lo que estaba haciendo.

La clave es el identificador estable; el nombre es solo para mostrar. Son dos
cosas distintas y por eso son dos campos distintos.

Verificado:

```
10. Gasto con categoria de sistema   400 "\"Sueldos\" la usa el sistema: esos
                                          movimientos se generan solos"
```

### Un detalle de MongoDB: el índice único parcial

Las categorías de sistema tienen `clave` y no puede haber dos iguales. Las del
dueño no tienen clave (queda `null`).

Un índice único común no serviría: Mongo consideraría que todas las del dueño
tienen `clave: null` y chocarían entre sí. La solución es un **índice único
parcial**, que solo se aplica a los documentos que tienen clave:

```js
categorySchema.index(
  { clave: 1 },
  { unique: true, partialFilterExpression: { clave: { $type: 'string' } } },
);
```

---

## 7. El seed: los datos con los que el sistema nace

Hay datos que tienen que existir sí o sí para que el sistema funcione: las
categorías que el código busca por clave, una lista de precio, los materiales en
cero, la configuración.

```bash
npm run seed --workspace server
```

**La regla de oro: tiene que poder correrse varias veces sin romper nada.** En
inglés se dice que es *idempotente*.

Si lo corrés dos veces no se duplica nada, y si en la fase 7 agregamos una
categoría nueva, volver a correrlo la crea sin tocar lo que ya había.

El mecanismo:

```js
await Category.updateOne(
  { clave: categoria.clave },
  { $setOnInsert: { ...categoria, sistema: true } },
  { upsert: true },
);
```

- `upsert: true` → si no existe, creálo.
- `$setOnInsert` → estos valores se aplican **solo al crear**.

Ese segundo detalle es el que importa: si el dueño le cambió el precio a
"Normal", volver a correr el seed **no** se lo pisa. Hay un test que renombra
"Combustible" a "Nafta", vuelve a sembrar y verifica que siga llamándose "Nafta".

Lo que crea:

- Configuración con los valores del plan (25.000 / 25.000 / "carga").
- 4 categorías de sistema + 5 del dueño (las del MVP).
- 3 listas de precio: Normal (predeterminada), Mayorista, Promoción.
- Los 4 materiales en cero.

---

## 8. El patrón singleton de la configuración

`settings` es una colección con **un solo documento**. El campo `clave` siempre
vale `'principal'` y es único, así que la base misma impide que se creen dos por
accidente — por ejemplo, si dos pedidos llegan al mismo tiempo.

```js
settingSchema.statics.obtener = function () {
  return this.findOneAndUpdate(
    { clave: 'principal' },
    { $setOnInsert: VALORES_INICIALES },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};
```

`findOneAndUpdate` con `upsert` es **una sola operación atómica** contra la base:
o encuentra el documento o lo crea, sin ventana de tiempo en el medio donde dos
pedidos podrían crear cada uno el suyo.

**Por qué la configuración está en la base y no en el código:** para que se pueda
cambiar desde la app, sin que nadie tenga que tocar un archivo ni volver a
publicar nada.

> **Un aviso que dejé anotado en el servicio:** si algún día cambia
> `ladrillosPorCamion`, el stock que ya existe **no** se recalcula. El stock está
> guardado en ladrillos-equivalentes, que es una cantidad real de material; lo
> único que cambia es a cuántos camiones equivale de ahí en adelante.
> Recalcularlo sería reescribir la historia.

---

## 9. Las listas de precio y los "invariantes"

Las listas de precio se crean en esta fase pero se **usan** en la fase 6
(ventas). Están ahora porque el plan las pide junto con el resto de los datos
iniciales.

Tienen dos reglas que el servicio tiene que sostener siempre:

1. Hay **exactamente una** predeterminada (la que viene elegida al abrir una
   venta nueva).
2. La predeterminada **no** se puede desactivar.

Algo que tiene que ser cierto siempre, antes y después de cualquier operación, se
llama **invariante**. El esquema no puede garantizarlo porque involucra a varios
documentos a la vez, así que vive en el servicio — y marcar una nueva como
predeterminada implica desmarcar la otra **en la misma transacción**, para que
nunca haya dos ni ninguna.

Hay un detalle que me gusta: si no queda ninguna lista, la primera que se cree es
predeterminada aunque no se lo pida. El sistema no se puede quedar sin una.

---

## 10. Las pantallas

### Stock

La alerta roja va **arriba de todo**, porque es el dato que cambia lo que el
dueño hace hoy: si falta arcilla, hay que ir a la cantera.

Tres acciones: **Registrar compra**, **Uso de leña** y **Ajuste**.

**El ajuste pide cuánto HAY, no cuánto sumar.** Es una decisión de diseño, no un
detalle: parado en el patio, lo que se puede contar es lo que hay. Pedir la
diferencia obligaría a hacer la resta de cabeza, que es justo donde se cometen
errores. El sistema calcula la diferencia y la registra.

**El uso de leña no toca la caja.** La plata salió cuando se compró. Y el plan
(5.6b) decidió que la leña no se descuente sola al producir, porque el consumo
cambia según la calidad: el stock de leña es aproximado por naturaleza y se anota
a ojo.

### Caja

Balance del mes arriba (ingresos, egresos, resultado), lista de movimientos
abajo, y un selector de mes con flechas. La flecha de "mes siguiente" se
deshabilita en el mes actual: no tiene sentido mirar el futuro.

El plan (sección 1) decidió que la caja muestre **solo el balance del mes**: sin
saldo inicial ni acumulado. Es lo que el dueño realmente quiere saber: *"este
mes, ¿gané o perdí?"*.

**"+ Nueva categoría" dentro del formulario de gasto.** El plan (sección 7) lo
pide ahí mismo, y tiene razón: obligar a salir a Ajustes, crear la categoría y
volver a empezar el gasto es la clase de fricción que hace que la gente no use el
sistema. Verificado: se creó "Alquiler de maquina" y se registró el gasto de Gs
1.200.000 en un solo paso.

### Un componente nuevo: `InputCantidad`

Es el hermano de `InputGs`, con una diferencia clave: **acá sí se aceptan
decimales**.

Son dos componentes distintos a propósito. Si fuera uno solo con una bandera
`permitirDecimales`, tarde o temprano alguien la pone donde no va y aparecen
guaraníes con coma.

| | `InputGs` | `InputCantidad` |
|---|---|---|
| Para | Plata | Material |
| Decimales | No | Sí |
| `inputMode` | `numeric` (sin coma) | `decimal` (con coma) |

Tiene un detalle que `InputGs` no necesita: mientras el campo tiene el foco,
guarda el texto **tal como se está tipeando**. Si formateara en cada tecla, al
escribir `"1,"` el formateador devolvería `"1"` y la coma desaparecería apenas se
tipea. Al salir del campo, se formatea.

Y acepta coma **o** punto: en Paraguay la coma es el separador decimal, pero el
teclado del celular suele dar punto.

### Por qué el `<select>` es el nativo

`CampoSelect` usa el `<select>` del navegador en vez de un desplegable propio. En
el celular, el nativo abre la rueda de opciones del sistema operativo: más
grande, más cómoda y ya conocida. Uno hecho a mano nunca queda tan bien, y hay
que resolverle el teclado, el foco y el scroll a mano.

---

## 11. Los tests

`npm test` corre **110 tests** (antes eran 61).

| Archivo | Tests | Qué cubre |
|---|---|---|
| `inventory.test.js` | 20 | Compras, conversión, alerta, anulación, uso de leña, ajustes, **transacción** |
| `caja.test.js` | 29 | Seed, balance, gastos, categorías, listas, configuración |
| `employees.test.js` | 24 | CRUD con soft delete (fase 3) |
| `auth.test.js` | 19 | Login y rutas protegidas (fase 2) |
| `money.test.js` | 14 | Cuentas de plata (fase 3) |
| `health.test.js` | 4 | Estado del servicio (fase 0) |

Los que más valen de esta fase:

```
✓ suma el stock Y crea el egreso en caja           ← el criterio del plan
✓ si falla el egreso, el stock NO queda sumado     ← la transacción
✓ convierte camiones fraccionarios a enteros
✓ devuelve el stock y anula el egreso, sin borrar nada
✓ no se puede anular dos veces
✓ la alerta se apaga cuando hay suficiente de las DOS arcillas
✓ separa los meses: solo cuenta lo del mes pedido
✓ NO deja anular un movimiento generado por una compra
✓ al desactivar una categoria, los gastos viejos conservan su nombre
✓ se puede correr dos veces sin duplicar nada (idempotente)
✓ no pisa lo que el dueno haya cambiado
✓ cambiar la predeterminada desmarca la anterior
✓ acepta nombres con parentesis (la busqueda escapa la regex)
```

Ese último merece una nota: la búsqueda de duplicados usa una expresión regular
para ignorar mayúsculas. Sin escapar los caracteres especiales, una categoría
llamada `"Gastos (varios)"` rompería la búsqueda — y un nombre elegido con mala
intención podría armar una regex que cuelgue al servidor.

Resultado: **110 passed**, `npm run lint` sin warnings, `npm audit` con 0
vulnerabilidades.

---

## 12. Cómo se verificó a mano

Contra una base temporal levantada como replica set (Atlas quedó intacta):

```
1.  Stock inicial                       arcilla pura 0 camiones | alerta: true
2.  Compra 2 camiones por 3.000.000     201
3.  Stock despues                       2 camiones = 50000 ladrillos-equiv.
4.  Egreso automatico en caja           Compra de material 3000000
    Balance del mes                     ingresos 0 | egresos 3000000 | resultado -3000000
5.  Compra 1,5 camiones                 37500 ladrillos-equiv. (entero: true)
    Alerta arcilla                      disponible 37500 | alerta false
6.  Anular la primera compra            200 -> stock pura 0 | egresos 2200000
    Alerta vuelve                       alerta true faltante ["arcilla_pura"]
7.  Historial (nada se borra)           anulacion:-50000 | compra:37500 | compra:50000
8.  Gasto manual                        201 Combustible
9.  Anular egreso de compra a mano      400 "Este movimiento lo genero otra operacion..."
10. Gasto con categoria de sistema      400 "\"Sueldos\" la usa el sistema..."
11. Balance final de septiembre         egresos 2450000 | resultado -2450000
```

Y en el navegador a 375 px:

| Prueba | Resultado |
|---|---|
| Pantalla Stock | Alerta roja arriba, tres tarjetas, historial completo |
| Compra de 2,5 camiones desde la app | El campo mostró "2,5"; el monto, "3.750.000" |
| Tras guardar | Arcilla pura pasó a 2,5 camiones y la alerta roja desapareció |
| Historial | Apareció "+62.500 COMPRA" arriba de todo |
| Pantalla Caja | Balance Gs −6.200.000, con los dos egresos automáticos |
| Botón "Anular" | Solo en el gasto manual, no en los de compra |
| "+ Nueva categoría" | Creó "Alquiler de maquina" y cargó el gasto en un solo paso |
| Mes anterior | "Agosto 2026", sin movimientos, con el mensaje que corresponde |

---

## 13. Dos cosas que ajusté sobre la marcha

1. **La base temporal de prueba era standalone.** Las transacciones necesitan
   replica set, así que el script de verificación pasó a usar
   `MongoMemoryReplSet`. Los **tests** ya lo usaban desde la fase 2, así que no
   hubo que tocarlos.

2. **El texto de la compra decía "2.5 camion(es)"**, con punto. En un sistema en
   español eso se escribe "2,5". Lo pasé por `Intl.NumberFormat('es-PY')`.

---

## 14. Estado del plan

Fase 4 completa, con su criterio cumplido y verificado: **registrar una compra
suma stock y aparece el egreso en caja**.

Quedaron listas además tres piezas que las fases siguientes usan tal cual:

- **`moverStock()`**, la primitiva que la producción (fase 5) va a usar para
  descontar arcilla y sumar ladrillos, dentro de la misma transacción.
- **`crearIngresoDeSistema()`**, que la fase 6 usa para los pagos de ventas.
- **Las listas de precio**, que la fase 6 necesita para calcular el total.

También quedó preparado el hueco de `comprometido` en el stock de ladrillos: hoy
devuelve 0 porque todavía no hay ventas, y en la fase 6 pasa a sumar lo que falta
entregar.

**Siguiente: Fase 5** — producción diaria. Cargar los ladrillos del día,
marcar qué empleados trabajaron, calcular cuánto cobra cada uno con la tarifa del
momento (snapshot), descontar arcilla de las dos a la vez y sumar al stock de
ladrillos. Todo, por supuesto, en una sola transacción.
