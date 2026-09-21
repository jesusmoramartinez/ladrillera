# Fase 3 — Layout, componentes base y Empleados

> Criterio del plan: **"Alta/edición/baja de empleados desde el celular."**
> Fecha: 21/09/2026.

---

## 0. Resumen de lo que ahora existe

**Backend**

| Archivo | Para qué |
|---|---|
| `server/src/logic/money.js` | Las cuentas de plata, en funciones puras |
| `server/src/models/Employee.js` | La forma del empleado |
| `server/src/validators/employee.validator.js` | Qué datos se aceptan (Zod) |
| `server/src/services/employee.service.js` | Reglas: listar, crear, editar, soft delete |
| `server/src/controllers/employee.controller.js` | HTTP ↔ servicio |
| `server/src/routes/employee.routes.js` | Las cuatro rutas del módulo |
| `server/tests/money.test.js` | 14 tests de las cuentas |
| `server/tests/employees.test.js` | 24 tests del CRUD |

**Frontend**

| Archivo | Para qué |
|---|---|
| `client/src/utils/format.js` | Cómo se muestran guaraníes y fechas |
| `client/src/components/BotonGrande.jsx` | El botón de toda la app |
| `client/src/components/InputGs.jsx` | Campo de plata que formatea al escribir |
| `client/src/components/CampoTexto.jsx` | Campo de texto con etiqueta y error |
| `client/src/components/BarraInferior.jsx` | La navegación de abajo |
| `client/src/components/Layout.jsx` | El marco común de las pantallas |
| `client/src/components/Confirmacion.jsx` | El "¿estás seguro?" |
| `client/src/pages/Empleados.jsx` | La pantalla del módulo |
| `client/src/pages/Mas.jsx` | El menú con el resto |
| `client/src/pages/EnConstruccion.jsx` | Provisoria para lo que falta |
| `client/src/api/employees.js` | Una función por endpoint |

---

## 1. La API del módulo

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/employees` | Lista los vigentes. Con `?activo=true`, solo los activos |
| POST | `/api/employees` | Crea uno. Devuelve **201** |
| PATCH | `/api/employees/:id` | Cambia solo los campos que se mandan |
| DELETE | `/api/employees/:id` | Soft delete: marca, no borra |

Las cuatro están debajo de la barrera `requireAuth` que se armó en la Fase 2, así
que ya nacen protegidas sin escribir una línea extra. Hay dos tests que lo
confirman.

Sobre el **201**: es el código HTTP correcto cuando se crea algo que antes no
existía. Un 200 también "funciona", pero el 201 le dice explícitamente al cliente
"ahora hay un recurso nuevo".

---

## 2. `logic/money.js` — por qué las cuentas van aparte

El plan (sección 5.3) es tajante: el guaraní no tiene centavos, **todo el dinero
es entero**, y los redondeos se hacen **en un único lugar**.

Ese lugar es esta carpeta. `logic/` guarda **funciones puras**: entran números,
salen números, y no tocan la base, ni internet, ni la fecha de hoy.

Tres consecuencias prácticas:

1. **Son trivialmente testeables.** Los 14 tests de `money.test.js` corren en
   milisegundos y no necesitan base de datos ni servidor.
2. **No se pueden romper desde otro lado.** No dependen de nada externo.
3. **Si todos redondean igual, la suma de las partes da el total.** Si cada
   pantalla redondeara por su cuenta, aparecerían diferencias de un guaraní que
   después nadie sabe de dónde salieron.

### `montoPorMil(cantidad, precioPorMil)`

Es la cuenta más usada del sistema. Sirve para dos cosas distintas:

- **Producción** (fase 5): cuánto cobra un empleado por los ladrillos del día.
- **Ventas** (fase 6): el subtotal según la lista de precios.

Es proporcional también para menos de 1.000, como pide el plan (5.7):

```
montoPorMil(1000, 150.000)  ->   150.000
montoPorMil(5000, 150.000)  ->   750.000
montoPorMil( 500, 800.000)  ->   400.000
montoPorMil(   1, 150.000)  ->       150
```

**Un detalle que parece intrascendente y no lo es:** multiplicamos antes de
dividir.

```js
return redondearGs((cantidad * precioPorMil) / 1000);   // bien
// NO:  redondearGs((cantidad / 1000) * precioPorMil);  // mal
```

En JavaScript los decimales no son exactos: `2100 / 1000` da
`2.1000000000000005`, no `2.1`. Ese sobrante se multiplica después y el
resultado puede salir corrido un guaraní. Multiplicando primero, el número se
mantiene entero hasta el final. Hay un test específico para esto.

### `MONTO_MAXIMO`

Es `Number.MAX_SAFE_INTEGER`: 9.007.199.254.740.991. Es el entero más grande que
JavaScript maneja con exactitud; pasado ese punto empieza a perder precisión **en
silencio**, que es la peor clase de error cuando se trata de plata. En guaraníes
son nueve mil billones, así que sobra de sobra, pero el validador lo chequea igual.

---

## 3. El concepto central: soft delete

**Soft delete** = borrar marcando, no borrando. En vez de sacar el documento de
la base, se le pone una fecha en `deletedAt`, y todas las consultas filtran por
`deletedAt: null`.

Para el usuario el efecto es el mismo: desaparece de la lista. Para el sistema,
la diferencia es enorme.

### Por qué importa acá

Las liquidaciones y las producciones de meses pasados mencionan a los empleados.
Si borráramos de verdad al que dejó de venir, esos registros quedarían apuntando
a la nada, y el historial se rompería hacia atrás.

Verificado en un test que va directo a la base:

```js
const enLaBase = await Employee.findById(id);
expect(enLaBase).not.toBe(null);           // el documento SIGUE
expect(enLaBase.nombre).toBe('Juan Perez');
expect(enLaBase.deletedAt).toBeInstanceOf(Date);
```

Y en la prueba real contra MongoDB, después de eliminar a Juan desde la pantalla:

```
Documentos en la coleccion "employees": 2
  Juan Perez   | tarifa 150000 | activo false | deletedAt Mon Sep 21 2026 01:01:42
  Ana Lopez    | tarifa 180000 | activo true  | deletedAt null
```

Dos documentos en la base, uno solo en la lista.

### `activo` vs `deletedAt` — dos cosas distintas

Conviene no mezclarlas, porque resuelven problemas diferentes:

| | `activo: false` | `deletedAt: <fecha>` |
|---|---|---|
| Qué significa | Sigue en la lista, pero no aparece para cargar producción | Se sacó de la lista |
| Cuándo usarlo | Licencia, dejó de venir un tiempo | Ya no trabaja más acá |
| Cómo se deshace | Un toque en "Activar" | No hay pantalla para eso (todavía) |
| Se ve en la app | Sí, apagado y con la etiqueta "inactivo" | No |

En la pantalla, el texto del cartel de confirmación lo dice explícitamente: *"Si
solo dejó de venir por un tiempo, conviene desactivarlo en vez de eliminarlo."*

---

## 4. El bug que encontraron los tests

Vale la pena contarlo entero porque es un error muy fácil de cometer y muy
difícil de notar.

**El síntoma:** editar solo la tarifa de un empleado **le borraba el rol**.

**La causa.** El esquema de validación tenía esto:

```js
const rol = z.string().trim().max(40).optional().default('');   // ← el default
```

y el esquema de edición lo reusaba tal cual. Entonces, cuando la pantalla mandaba:

```json
{ "tarifaPorMil": 180000 }
```

Zod aplicaba el default y lo convertía en:

```json
{ "tarifaPorMil": 180000, "rol": "" }
```

El servicio hacía `Object.assign(empleado, cambios)` y el rol se iba a la basura.
Nadie lo pidió, nadie lo vio.

**El segundo síntoma, del mismo origen:** un `PATCH` con el cuerpo vacío `{}`
tenía que devolver 400. Devolvía 200. El `.refine()` que exige al menos un campo
contaba las claves **después** de aplicar los defaults, así que `{}` se convertía
en `{ rol: '' }` y pasaba el control.

**El arreglo.** Separar las reglas de cada campo de la decisión de si es
obligatorio y qué default tiene:

```js
const rol = z.string().trim().max(40);                 // solo la regla

crearEmpleadoSchema  -> rol: rol.optional().default('')  // al crear, sí
editarEmpleadoSchema -> rol: rol.optional()              // al editar, NO
```

**La regla para acordarse:** un `PATCH` significa *"cambiá solo esto y dejá el
resto como está"*. Los valores por defecto van en el **crear**, nunca en el
**editar**.

Los dos tests que lo agarraron:

```
✓ cambia solo el campo que se manda
✓ rechaza un PATCH sin ningun campo
```

Sin esos tests, el bug habría aparecido meses después como "che, ¿por qué se
borran los roles solos?".

---

## 5. La navegación: barra inferior y rutas anidadas

### Por qué la barra va abajo

El plan (sección 7) pide que todo se alcance con el pulgar. En un celular grande,
la parte de arriba de la pantalla obliga a acomodar la mano; la de abajo no.

Cinco destinos: **Inicio · Producción · Ventas · Caja · Más**. Cinco es el máximo
razonable: con más, cada botón queda demasiado angosto para el dedo. Todo lo
demás (Empleados, Stock, Clientes, Adelantos, Liquidación, Ajustes) vive en "Más".

Dos detalles del CSS que se olvidan siempre:

```css
.barra-inferior { padding-bottom: env(safe-area-inset-bottom, 0px); }
.layout { padding-bottom: calc(var(--alto-barra) + env(safe-area-inset-bottom, 0px)); }
```

- `env(safe-area-inset-bottom)` es la franja del gesto de inicio en los iPhone sin
  botón. Sin eso, la barra queda pisada por esa franja.
- El `padding-bottom` del layout **reserva** el alto de la barra. Sin él, el
  último elemento de cualquier lista queda tapado y parece que la app se cortó.

Se verificó midiendo en el navegador: el último botón de la pantalla "Más"
termina en el píxel 711 y la barra empieza en el 747. No se tocan.

### Rutas anidadas

Antes, cada pantalla protegida se envolvía a mano:

```jsx
<Route path="/" element={<RutaProtegida><Inicio /></RutaProtegida>} />
```

Ahora hay **una ruta padre** que pone la protección y el layout, y las pantallas
cuelgan adentro:

```jsx
<Route element={<RutaProtegida><Layout /></RutaProtegida>}>
  <Route index element={<Inicio />} />
  <Route path="/empleados" element={<Empleados />} />
  <Route path="/mas" element={<Mas />} />
  ...
</Route>
```

El `<Outlet />` que está adentro de `Layout.jsx` es el hueco donde React Router
dibuja la pantalla que corresponde.

Dos ventajas concretas:

1. **La protección se escribe una vez.** Toda pantalla que se agregue adentro ya
   nace protegida. Es la misma idea que la barrera `requireAuth` del backend: el
   olvido falla hacia el lado seguro.
2. **La barra inferior no se vuelve a montar** al cambiar de pantalla. Queda
   quieta, como en una app nativa, en vez de parpadear.

---

## 6. Los componentes base

### `BotonGrande`

Existe para que los botones sean iguales en todas las pantallas sin acordarse de
las clases CSS cada vez. Si mañana el plan pide botones más altos, se cambia acá
y cambian todos. Alto: 52 px (el mínimo recomendado es 48).

Un detalle de HTML que muerde a todo el mundo:

```jsx
type = 'button'   // ← por defecto, a propósito
```

En HTML, un `<button>` adentro de un `<form>` es `type="submit"` salvo que digas
lo contrario. Sin esa línea, el botón "Cancelar" enviaría el formulario.

### `InputGs`

Hace tres cosas que el plan pide y que a mano se olvidan:

1. **Formatea mientras se escribe.** Tipeás `150000` y ves `150.000`. En un
   celular es facilísimo poner un cero de más y no notarlo; con los puntos, salta
   a la vista. Verificado en el navegador.
2. **Abre el teclado numérico** (`inputMode="numeric"`), no el de letras.
3. **Hacia afuera entrega siempre un número entero.** El resto de la app ni se
   entera de que existe el formateo.

**Por qué el tipo es `text` y no `number`:**

- `<input type="number">` no deja formatear con puntos: el navegador lo considera
  un valor inválido y te lo borra.
- Muestra flechitas de subir/bajar que no sirven de nada en un celular.
- En algunos navegadores acepta la letra "e" (notación científica).

La combinación correcta para plata es `type="text"` + `inputMode="numeric"`.

Otro detalle chico que se nota: cuando el valor es 0 el campo se muestra **vacío**
en vez de con un "0" que hay que borrar antes de escribir.

### `Confirmacion`

El plan pide confirmación antes de las acciones de dinero. Se podría usar el
`window.confirm()` del navegador, pero:

- No se puede estilar, y en un celular se ve como un cartel de 2005.
- Bloquea todo el navegador mientras está abierto.
- No permite explicar la consecuencia más allá de una línea.

Dos decisiones de diseño adentro:

- **El botón peligroso no va primero.** Si el botón destructivo está donde el
  dedo ya venía bajando, se toca de memoria sin leer.
- **`stopPropagation` en el panel.** El fondo oscuro cierra al tocarlo (que es lo
  que uno intenta instintivamente), pero sin esa línea, tocar *dentro* del cartel
  también lo cerraría: el click "burbujea" hacia arriba hasta el fondo.

---

## 7. `format.js` y la trampa de las fechas

### Los guaraníes

`Intl.NumberFormat` viene en el navegador, no hay que instalar nada. Con la
configuración de Paraguay usa el punto como separador de miles.

Se crea **una sola vez, fuera de las funciones**: armar un formateador es caro, y
en una lista larga se armaría uno por fila.

No se usa `{ style: 'currency' }` porque ese modo agrega decimales
(`Gs 1.500.000,00`) y el guaraní no tiene centavos. El símbolo se escribe a mano.

### La trampa de las fechas

Esta merece atención porque es un bug clásico y silencioso.

Uno estaría tentado de hacer:

```js
new Date('2026-09-21').toLocaleDateString('es-PY')   // ← MAL
```

JavaScript interpreta `"2026-09-21"` como **medianoche en UTC**. Paraguay está 3
o 4 horas atrás, así que esa medianoche cae a las 20 o 21 del **día anterior**, y
la fecha se muestra corrida un día.

Como las fechas de negocio ya son texto (plan, sección 5.4), la solución más
segura es **no convertirlas a `Date` en ningún momento**:

```js
const [anio, mes, dia] = fechaISO.split('-');
return `${dia}/${mes}/${anio}`;
```

### `hoyISO()`

La otra mitad del mismo problema: ¿cuál es "hoy" en Paraguay?

```js
new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', ... }).format(new Date())
```

El truco es el formato `'en-CA'` (Canadá en inglés), que escribe las fechas como
`"2026-09-21"` — exactamente el formato que necesitamos — y `timeZone` hace la
conversión horaria correcta.

Esto importa de verdad: si el dueño carga producción a las 22 h y el navegador
usara la hora UTC, ya sería el día siguiente y el registro caería en la fecha
equivocada. Va a ser clave en la fase 5.

---

## 8. Los cuatro estados de una pantalla que carga datos

`Empleados.jsx` es el molde de todas las pantallas que vienen. Contempla los
cuatro estados que es facilísimo olvidar:

| Estado | Qué se muestra |
|---|---|
| **Cargando** | "Cargando empleados..." |
| **Error** | El mensaje + un botón "Reintentar" |
| **Vacío** | Explicación de qué hacer y un botón para empezar |
| **Con datos** | La lista |

El estado **vacío** es el que más se olvida, y es el primero que ve el usuario el
día que estrena la app. Una pantalla en blanco parece rota.

### El patrón de carga, y el warning del linter

La primera versión hacía esto:

```js
const cargar = useCallback(async () => {
  setCargando(true);          // ← adentro del efecto
  ...
}, []);

useEffect(() => { cargar(); }, [cargar]);
```

El linter lo marcó: *"Calling setState synchronously within an effect can trigger
cascading renders"*. Prender estado dentro de un efecto dispara un render extra
en cadena.

La versión corregida usa un **contador de recargas**:

```js
const [recargas, setRecargas] = useState(0);

function recargar() {
  setCargando(true);              // ← en el EVENTO que la provocó
  setErrorCarga('');
  setRecargas((n) => n + 1);
}

useEffect(() => {
  let cancelado = false;
  listarEmpleados()
    .then((datos) => { if (!cancelado) setEmpleados(datos); })
    .catch((error) => { if (!cancelado) setErrorCarga(error.message); })
    .finally(() => { if (!cancelado) setCargando(false); });
  return () => { cancelado = true; };
}, [recargas]);
```

Tres cosas que vale la pena entender de ahí:

1. **El `setCargando(true)` ahora está en el evento**, no en el efecto. Es lo que
   recomienda React: *"update it from the event that caused the change"*.
2. **El contador reemplaza a la función.** Antes hacía falta `useCallback` para
   que la función no se recreara en cada render (si no, el efecto se dispararía
   en bucle infinito). Con un número como dependencia, ese problema no existe.
3. **La bandera `cancelado`.** Si el componente desaparece antes de que llegue la
   respuesta, no tocamos el estado de algo que ya no está en pantalla. Y además
   evita que una respuesta vieja y lenta pise a una nueva que llegó antes. Es el
   mismo patrón que ya usaba `AuthContext`.

### Actualización optimista

Al tocar "Desactivar", la pantalla cambia **antes** de que conteste el servidor:

```js
setEmpleados((lista) => lista.map((e) => e.id === empleado.id ? { ...e, activo: !e.activo } : e));
await editarEmpleado(empleado.id, { activo: !empleado.activo });
```

Se siente instantáneo en vez de tener medio segundo de espera. Si la llamada
falla, se recarga la lista y el cambio se deshace solo.

### Errores por campo

El backend manda los errores como `[{ campo, mensaje }]`. La pantalla los convierte
a un objeto `{ campo: mensaje }` y los muestra **debajo del input que corresponde**,
con el borde en rojo, en vez de un mensaje general arriba que no dice dónde mirar.

Probado en el navegador: con nombre "A" y tarifa vacía aparecen los dos mensajes,
cada uno en su lugar.

---

## 9. Un ajuste de diseño sobre la marcha

En la primera versión, los tres botones de cada fila —Desactivar, Editar,
Eliminar— estaban todos en color. Al verlo en el celular quedó claro el problema:
el terracota de la marca (`#b2452a`) y el rojo de peligro (`#b3261e`) son
prácticamente el mismo color a 14 píxeles.

Si "Editar" y "Eliminar" se ven iguales, tarde o temprano se toca el que no era.

El arreglo: las acciones comunes en gris oscuro, y color **solo** para la
destructiva. Ahora la diferencia se ve de reojo, sin leer.

---

## 10. Decisiones que tomé y conviene que revises

Dos puntos donde el plan no era explícito. Los resolví para no frenar, pero
decime si preferís al revés:

1. **El rol es opcional.** El plan lo lista sin aclarar si es obligatorio. Lo dejé
   opcional porque no participa de ningún cálculo y forzarlo agrega fricción en un
   celular. Si querés que sea obligatorio, es una línea.

2. **La tarifa tiene que ser mayor a cero.** El plan no fija un mínimo. Puse
   `> 0` porque toda la liquidación depende de ese número: una tarifa en cero
   produciría sueldos en cero **en silencio**, que es peor que no dejar guardar.

---

## 11. Los tests

`npm test` corre **61 tests** (antes eran 23).

| Archivo | Tests | Qué cubre |
|---|---|---|
| `money.test.js` | 14 | Redondeo, proporcionalidad, coma flotante, rangos |
| `employees.test.js` | 24 | CRUD completo, validaciones, soft delete, protección |
| `auth.test.js` | 19 | Login, tokens, rutas protegidas (fase 2) |
| `health.test.js` | 4 | Estado del servicio (fase 0) |

Los de `employees.test.js` que más valen:

```
✓ marca deletedAt en vez de borrar el documento
✓ el eliminado desaparece de la lista
✓ no se puede editar un empleado ya eliminado
✓ no se puede eliminar dos veces
✓ cambia solo el campo que se manda          ← encontró el bug del default
✓ rechaza un PATCH sin ningun campo          ← el mismo bug, otra cara
✓ rechaza una tarifa con decimales
✓ rechaza una tarifa mandada como texto
✓ ordena primero los activos y despues por nombre
```

Resultado final:

```
Test Files  4 passed (4)
     Tests  61 passed (61)
```

Más: `npm run lint` sin warnings, `npm run build` OK, `npm audit` con 0
vulnerabilidades.

---

## 12. Cómo se verificó a mano

En el navegador a 375 px (tamaño de celular), contra una base temporal (Atlas
quedó intacta):

| Prueba | Resultado |
|---|---|
| Entrar y llegar a Inicio | Muestra "21/09/2026" — fecha de Paraguay correcta |
| Barra inferior | Los cinco destinos, con el actual en terracota |
| Empleados sin datos | Estado vacío con explicación y botón |
| Escribir la tarifa | `150000` se muestra `150.000` mientras se tipea |
| Guardar | Aparece "Juan Perez — cortador · Gs 150.000 por millar" |
| Segundo empleado sin rol | Muestra solo la tarifa, sin el separador colgando |
| Desactivar | Baja al final, se apaga, aparece la etiqueta "INACTIVO" y el botón pasa a "Activar" |
| Eliminar | Pide confirmación explicando la diferencia con desactivar |
| Tras confirmar | Desaparece de la lista, **sigue en la base con `deletedAt`** |
| Nombre "A" y tarifa vacía | Los dos errores, cada uno bajo su campo, con borde rojo |
| Pantalla "Más" | Empleados activo; el resto apagado con su número de fase |
| Barra vs contenido | Medido: el último botón termina en 711, la barra empieza en 747 |

---

## 13. Un tropiezo de herramientas, no de código

A mitad de la verificación la app dejó de dibujarse. La consola decía *"Invalid
hook call"* y *"App.jsx does not provide an export named 'default'"* — errores
que normalmente significan un bug serio.

No lo era. Yo había editado una docena de archivos **con el servidor de Vite
corriendo**, y su caché de recarga en caliente quedó con una mezcla de versiones
viejas y nuevas. La pista es que `npm run build` y `npm run lint` pasaban limpios:
si el código estuviera mal, el build habría fallado también.

El arreglo:

```bash
rm -rf client/node_modules/.vite
```

y volver a levantar. Si te pasa, es eso: **borrá `client/node_modules/.vite` y
reiniciá**. No busques el bug en tu código antes de descartar el caché.

---

## 14. Estado del plan

Fase 3 completa. Su criterio —alta, edición y baja de empleados desde el
celular— está cumplido y verificado de punta a punta.

Quedaron listas además dos piezas que las fases siguientes van a usar tal cual:

- **`logic/money.js`**, que es donde va a vivir el cálculo del monto por
  trabajador (fase 5) y el subtotal de las ventas (fase 6).
- **`utils/format.js`** con `hoyISO()`, que la carga de producción necesita para
  no equivocar el día.

**Siguiente: Fase 4** — configuración (`settings`), categorías de caja y listas
de precio con sus datos iniciales, inventario con su historial de movimientos, y
la caja: compra de material que suma stock y genera el egreso automático, uso de
leña, ajustes y balance del mes. Es la fase donde aparecen las **transacciones**
de MongoDB (el "todo o nada"), que es justamente para lo que el entorno de tests
ya levanta un replica set.
