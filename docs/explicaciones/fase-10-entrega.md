# Fase 10 — Configuración inicial, PWA y entrega

> El plan dice que esta fase está lista cuando **"el dueño instala la app, carga
> su stock y empleados solo"**. Fijate en el "solo": hasta ahora, poner el
> sistema en marcha requería que vos estuvieras al lado, con una consola
> abierta. Esta fase es la que saca al programador del medio.

---

## 1. Qué había antes de esta fase, y por qué no alcanzaba

Nueve fases construyeron un sistema que funciona. Pero para *arrancarlo* hacía
falta esto:

```bash
npm run seed --workspace server           # categorías, listas de precio, materiales
npm run crear-usuario --workspace server  # el usuario del dueño
```

…y después entrar a mano a Empleados a cargar a cada uno, a Stock a poner lo que
hay en el patio, a Ajustes (que no existía) a corregir los precios inventados
del seed.

Nada de eso lo puede hacer alguien que no programa. Y más importante: **si vos
lo hacés por él, el dueño nunca ve de dónde salen los números.** El primer día
que el stock no coincida con el patio, no va a saber ni por dónde empezar a
mirar.

El asistente invierte eso: el dueño mismo escribe cuánta arcilla tiene, y el
sistema le muestra en la misma pantalla qué significa ese número
("con esa arcilla alcanza para 37.500 ladrillos"). Aprende el modelo mientras lo
carga.

---

## 2. El asistente: cuatro pasos en la pantalla, **un solo** guardado

Son unos veinte campos. En un celular, veinte casillas vacías juntas son una
pared: intimida, se pierde el hilo y es facilísimo saltearse una.

Entonces: cuatro pasos.

```
  1. Tu fábrica      unidad de leña, ladrillos por camión, umbral de alerta
  2. Precios         al menos una lista ("Normal")
  3. Stock de hoy    arcilla pura y floja, leña, ladrillos en el patio
  4. Empleados       nombre, rol, tarifa por mil, teléfono
```

**Pero los pasos son de la pantalla, no del guardado.** Esa distinción es el
corazón de esta fase.

### Por qué no guarda paso por paso

Parece más natural: terminás el paso 1, se guarda, seguís. Y es una trampa.

Imaginate que se corta internet en el paso 3. El dueño queda con:

- los precios cargados,
- el stock **a medias**,
- ningún empleado,
- y `configuracionInicialHecha` en un estado indefinido.

¿Y ahora? Si la marca quedó en `true`, el asistente no vuelve a aparecer nunca y
el sistema queda medio configurado para siempre. Si quedó en `false`, el
asistente vuelve a arrancar **desde cero** y, al llegar al paso 3, suma otra vez
el stock que ya había entrado: el patio tendría el doble de ladrillos que la
realidad.

Las dos salidas son malas. La solución es no tener el problema:

```js
// setup.service.js
return conTransaccion(async (session) => {
  await Setting.updateOne(...);       // parámetros + la marca
  await PriceList.updateMany(...);    // baja las del seed
  await PriceList.create(...);        // las del dueño
  await Employee.create(...);         // los empleados
  await registrarStockDelPatio(...);  // el stock + sus movimientos
});
```

Cinco colecciones, **una transacción**. O entra todo o no entra nada. Si falla,
el dueño ve un error, aprieta "Guardar y empezar" de nuevo y listo: no quedó
ningún rastro a medio escribir.

Por eso tampoco hay botón "Guardar" en cada paso. Hay "Siguiente", y **un solo**
"Guardar y empezar" al final, con el resumen de todo a la vista.

---

## 3. El detalle que casi se me pasa: el stock no se **suma**, se **fija**

La primera versión de `registrarStockDelPatio` hacía lo obvio:

```js
// ❌ lo obvio
await moverStock({ material, cantidad: objetivo, motivo: 'stock_inicial', ... });
```

En una base recién creada funciona: todo está en cero, sumar 30.000 deja 30.000.

¿Y si alguien probó el sistema antes de la entrega? Es lo más normal del mundo:
vos cargás una producción de prueba para mostrarle cómo anda. Eso dejó 5.000
ladrillos en el patio. Después el dueño cuenta el patio de verdad, escribe
30.000… y el sistema guarda **35.000**.

Nadie se da cuenta. El número está mal desde el primer día y no hay forma de
saber por qué.

La versión correcta mueve la **diferencia**:

```js
const actual = (await Inventory.findOne({ material }).session(session))?.cantidad ?? 0;
const diferencia = objetivo - actual;

if (diferencia === 0) continue;   // un movimiento de cero no dice nada
```

Es la misma idea que ya usaba `registrarAjuste` desde la fase 4: **el dueño dice
CUÁNTO HAY, no cuánto sumar**, porque cuánto hay es lo único que se puede contar
parado en el patio. Cuánto sumar obliga a hacer una resta de cabeza, que es
justo donde se cometen los errores.

El test que lo cuida:

```js
it('si alguien ya probo el sistema, el stock queda en lo que dice el dueno', ...)
```

Deja 10.000 puestos a mano, el dueño dice 30.000, y verifica dos cosas: que
queden 30.000 (no 40.000) y que el movimiento registrado sea **20.000**, la
diferencia. El historial tiene que explicar el número, no contradecirlo.

---

## 4. Por qué el asistente **no** reusa los servicios que ya existían

Escribir empleados a mano acá, cuando `employee.service.crear()` existe hace
siete fases, parece duplicar trabajo. No lo es:

```js
// priceList.service.js
export async function crear({ nombre, precioPorMil, predeterminada = false }) {
  ...
  return conTransaccion(async (session) => {   // ← abre SU PROPIA transacción
```

**Las transacciones de MongoDB no se anidan.** Llamar a ese servicio desde
adentro de la transacción del asistente rompería el "todo o nada" del punto 2:
cada llamada haría su propio commit por separado, que es exactamente lo que
estamos tratando de evitar.

La regla del proyecto, que ya venía de la fase 5, es:

> Cuando hay que compartir una transacción, se comparte la **`session`** y se
> escribe contra los **modelos**. Los servicios se llaman cuando cada uno puede
> confirmar por su cuenta.

Es la misma razón por la que la producción usa `moverStock` (la primitiva, que
acepta `session`) y no `registrarCompra` (el servicio, que abre la suya).

---

## 5. Se puede correr **una sola vez**, y eso lo decide la base

Al terminar, `configuracionInicialHecha` queda en `true` y un segundo intento
responde 409:

```js
if (config.configuracionInicialHecha) {
  throw new ApiError(409, 'La configuracion inicial ya se hizo. Para cambiar algo, usa Ajustes, ...');
}
```

Fijate que el mensaje no dice solo "no". Dice **a dónde ir**. Un error que
cierra la puerta sin indicar la otra es un error que genera una llamada
telefónica.

Y el mensaje es cierto porque esta fase también construyó esa otra puerta: la
pantalla de **Ajustes**.

---

## 6. Ajustes: la contracara del asistente

El asistente carga todo junto el primer día. Ajustes corrige de a una cosa
cuando hace falta. Sin Ajustes, el asistente sería una trampa: cargás mal un
precio y ya no lo podés cambiar nunca.

El orden de las secciones no es alfabético ni por importancia: es por **cuántas
veces al año se toca cada cosa**, de más a menos.

| Sección | Cada cuánto |
|---|---|
| Precios de venta | seguido (inflación) |
| Tu fábrica (ladrillos por camión, unidad de leña, umbral) | casi nunca |
| Categorías de gasto | cuando aparece un gasto nuevo |
| Contraseña | una vez cada mucho |

La contraseña va última a propósito: es la única que no tiene vuelta atrás desde
la app. Si se escribe mal, el dueño queda afuera de su propio sistema y hay que
entrar por consola. Por eso se pide dos veces.

### Los tres avisos que esta pantalla **tiene** que dar

Están escritos en la pantalla, no solo en el código:

1. **"Cambiar un precio no toca las ventas que ya hiciste"** — cada venta guarda
   una *copia* del precio (fase 6, snapshot vs referencia). Sin este aviso, el
   dueño no se anima a actualizar precios por miedo a que se le muevan los
   números viejos.
2. **"Solo cambia las cuentas de ahora en adelante: el stock que ya hay no se
   recalcula"** — el stock está guardado en ladrillos-equivalentes, que son una
   cantidad real de material. Cambiar `ladrillosPorCamion` cambia a cuántos
   camiones *equivale* de ahora en más. Recalcular sería reescribir la historia.
3. **"No se borra, se da de baja"** — las listas y categorías tienen soft
   delete. Los movimientos viejos las siguen mostrando.

---

## 7. La PWA: qué la hace instalable

Tres piezas, nada más:

**`manifest.webmanifest`** — le dice al celular cómo se llama la app, con qué
ícono, de qué color y que se abra `standalone` (sin la barra del navegador).

**Los íconos** — 192 y 512 px, más uno `maskable`. Ese último existe porque
Android le recorta un círculo al ícono: si el dibujo llega hasta el borde, se
come los bordes. El `maskable` tiene el dibujo metido bien adentro (zona segura
= 80% central). Se generaron con un script de Node que escribe los PNG a mano
—`deflateSync` y nada más— así el proyecto no suma una dependencia de imágenes
para tres archivos que no van a cambiar.

**`sw.js`** — el service worker. Y acá viene lo importante.

---

## 8. El service worker: lo que **no** hace es la parte importante

Un service worker se mete en el medio de todos los pedidos que hace la página.
Es lo que permite instalarla. También es lo que permitiría un "modo sin
conexión"… que acá **está expresamente descartado**.

Vos lo pediste así, y tenés razón. Esta app maneja plata y stock:

- Un modo offline mostraría **el saldo de ayer como si fuera el de hoy**.
- Aceptaría cargas que quedarían esperando en una cola invisible.
- El dueño podría pagar un sueldo calculado sobre un número viejo.

Ver *"no hay internet"* y esperar treinta segundos es muchísimo mejor que eso.

Entonces el service worker de este proyecto hace **dos** cosas:

```js
// 3) LA API NO SE TOCA.
if (url.pathname.startsWith('/api/')) return;

// 4) Navegar a una pantalla: siempre a la red.
if (pedido.mode === 'navigate') {
  evento.respondWith(fetch(pedido));
  return;
}
```

1. Existir, para que el celular ofrezca "Agregar a pantalla de inicio".
2. Guardar los **archivos del programa** (JS y CSS) para que la segunda vez
   arranque al toque.

Todo lo que vaya a `/api/` pasa derecho a la red. El archivo ni lo mira.

### Por qué cachear el JS sí es seguro

Porque el build les pone un nombre según su contenido: `index-BUbnibP0.js`. Si
el contenido cambia, cambia el nombre, y el navegador pide un archivo distinto.
Un archivo guardado **nunca** puede estar desactualizado.

Eso no vale para `index.html` ni para los datos. Por eso navegar siempre va a la
red: si no, después de publicar una corrección el dueño seguiría viendo la
versión vieja.

### `skipWaiting`

```js
.then(() => self.skipWaiting())
```

Sin esto, la versión nueva espera a que se cierren *todas* las pestañas para
tomar el control. Después de publicar un arreglo, "ya lo arreglé" no sería
cierto para el dueño hasta que cierre la app del todo. Con `skipWaiting`, la
próxima recarga ya trae lo nuevo.

---

## 9. `Configurado`: por qué es un envoltorio y no una ruta

Lo fácil hubiera sido `/configuracion` como una pantalla más, y mandar ahí al
dueño desde el Inicio. Es peor por dos razones:

1. **Se puede esquivar.** Cualquiera con la URL entra a `/ventas` igual.
2. **Y lo que ve ahí está todo en cero.** Cargar una producción sin tarifas, o
   una venta sin precios, deja datos rotos desde el primer día.

Como envoltorio no hay forma de esquivarlo: mientras `hecha` sea `false`, no
existe pantalla a la que ir.

```jsx
<RutaProtegida>       {/* primero: ¿quién sos? */}
  <Configurado>       {/* después: ¿tu sistema está configurado? */}
    <Layout />
  </Configurado>
</RutaProtegida>
```

El orden importa: al revés, la pantalla le pediría la configuración de la
fábrica a un desconocido.

Y un detalle chico que se nota mucho: el estado arranca en `null`, no en
`false`.

```js
const [hecha, setHecha] = useState(null);   // todavía no sabemos
```

Si arrancara en `false`, el asistente **parpadearía** en la cara del dueño cada
vez que abre la app, hasta que llegue la respuesta del servidor. `null` es
"todavía no sé", y mientras tanto no se dibuja nada.

---

## 10. Un cambio chico en `app.js` que vale la pena contar

El middleware de conexión que escribiste para Vercel cortaba **todos** los
pedidos cuando Mongo no respondía, incluido `/api/health`:

```js
res.status(500).json({ ok: false, error: 'Error al conectar con la base de datos' });
```

El problema: `/api/health` es el único endpoint que existe **para contar cómo
está la base**. Si se cae Mongo, es lo primero que uno abre para diagnosticar —
y contestaba un 500 genérico, que es justo lo que no ayuda.

Ahora lo deja pasar para que conteste su 503 diciendo qué pasa:

```js
if (req.path === '/api/health' || req.path === '/api/health/') return next();
```

Y el resto pasó de 500 a **503**. No es cosmético: 500 significa "el servidor se
rompió", 503 significa "el servidor está bien pero no puede atender ahora,
probá de nuevo". Lo segundo es lo que realmente pasa, y es lo que un monitoreo
necesita distinguir.

---

## 11. Los tests

11 tests nuevos (336 en total). El primero es literalmente el criterio del plan:

```js
it('deja el sistema listo para usar con un solo pedido', ...)
```

Carga una configuración completa y verifica las cinco colecciones: los
parámetros, que las listas sean las del dueño y no las del seed, que haya
**exactamente una** predeterminada, los empleados activos con su tarifa, el
stock con la arcilla convertida (2,5 × 25.000 = 62.500) y los cuatro movimientos
de `stock_inicial` con la fecha correcta.

Los otros cubren las tres cosas que salen caras el día de la entrega:

| Test | Qué pasaría sin él |
|---|---|
| no se puede correr dos veces | el patio tendría el doble de ladrillos |
| si algo está mal, no guarda NADA a medias | sistema medio configurado, sin salida |
| exige al menos una lista de precio | no se podría vender |
| acepta arrancar con el patio vacío | movimientos de cero ensuciando el historial |
| las categorías andan aunque nadie corra el seed | el primer gasto revienta |

Ese último es el que más me gusta: el asistente llama a `sembrar()` antes de
escribir nada. En un deploy nuevo puede que nadie haya corrido el seed a mano, y
sin las categorías de sistema el primer gasto de caja falla. Como `sembrar()` es
idempotente, llamarlo de más no cuesta nada.

---

## 12. Lo que verifiqué, y lo que no pude

Sobre una base **vacía de verdad** (sin seed, como sería el día de la entrega),
en el navegador a 375 px:

- El asistente aparece solo, en lugar de la app.
- "Siguiente" queda apagado hasta que el paso esté completo.
- Los decimales con **coma** funcionan: `2,5` camiones.
- El aviso en vivo: "con esa arcilla alcanza para 37.500 ladrillos"
  (min(2,5 · 1,5) × 25.000 ✓).
- Al guardar, entra directo al Inicio con **30.000** ladrillos, arcilla pura 2,5
  y floja 1,5, leña 4 carga.
- Recargando la página el asistente **no** vuelve.
- La empleada creada por el asistente aparece en Producción con su tarifa:
  5.000 × 180.000/1.000 = **Gs 900.000** ✓.
- Guardar esa producción descontó 0,2 camión de cada arcilla (2,5 → 2,3 y
  1,5 → 1,3) y sumó los ladrillos (30.000 → 35.000) ✓.
- En Ajustes, cambiar el precio de Gs 1.200.000 a 1.350.000 funciona y avisa.

**Lo que no pude verificar acá:** el registro del service worker. El navegador
integrado del editor los bloquea (`Failed to register a ServiceWorker: an
unknown error occurred`), y el 200 con `content-type: text/javascript` confirma
que el archivo se sirve bien, pero no que se instale. **Eso hay que probarlo en
el celular, sobre el dominio publicado en HTTPS**, que además es el único lugar
donde el botón "Agregar a pantalla de inicio" tiene sentido.

---

## 13. Un detalle que ya habíamos aprendido, y volvió a aparecer

En el resumen final del asistente, la primera versión mostraba:

> Arcilla — **2,5 y 1,5 camiones**

Es exactamente el mismo problema que corregimos en la fase 9 en el Inicio: no
dice cuál es cuál. Y este resumen es la **última oportunidad** de ver un número
mal cargado antes de que entre al sistema. Si las dos arcillas están cruzadas,
ahí no hay forma de notarlo.

Quedó con las etiquetas separadas:

> Arcilla pura — 2,5 camiones
> Arcilla floja — 1,5 camiones

Vale la pena registrarlo porque es la segunda vez: **cuando se muestran dos
cantidades del mismo tipo juntas, siempre hay que decir cuál es cuál.** No
alcanza con que el orden sea "obvio" para quien escribió el código.

---

## Archivos de esta fase

**Backend**

| Archivo | Qué hace |
|---|---|
| `services/setup.service.js` | todo el asistente, en una transacción |
| `validators/setup.validator.js` | el formulario largo, validado de verdad |
| `controllers/setup.controller.js` · `routes/setup.routes.js` | HTTP |
| `app.js` | health pasa aunque Mongo no responda; 503 en vez de 500 |
| `tests/setup.test.js` | 11 tests |

**Frontend**

| Archivo | Qué hace |
|---|---|
| `pages/Configuracion.jsx` | el asistente en cuatro pasos |
| `components/Configurado.jsx` | el envoltorio que lo impone |
| `pages/Ajustes.jsx` | precios, fábrica, categorías, contraseña |
| `api/setup.js` | las dos llamadas |
| `pwa.js` | registra el service worker (solo en producción) |
| `public/manifest.webmanifest` · `sw.js` · `icono-*.png` | la PWA |
| `vercel.json` | SPA fallback y cache correcto de `sw.js` |

Ver también [`ENTREGA.md`](../ENTREGA.md): la lista de lo que hay que dejar
configurado en Vercel y en Atlas antes de darle la app al cliente.
