# Fase 5 — Producción diaria

> Criterio del plan: **"Cargar 5.000 descuenta 0,2 camión de cada arcilla y suma 5.000 ladrillos."**
> Fecha: 21/09/2026.

---

## 0. Resumen de lo que ahora existe

**Backend**

| Archivo | Para qué |
|---|---|
| `server/src/logic/semana.js` | La semana de pago (lunes a sábado), sin zonas horarias |
| `server/src/logic/production.js` | Snapshot de tarifas y resumen por empleado |
| `server/src/models/Production.js` | La producción de un día, con los trabajadores adentro |
| `server/src/services/production.service.js` | Guardar, listar por semana y anular |
| `server/src/validators/production.validator.js` | Qué datos se aceptan |
| `server/src/controllers/production.controller.js` | HTTP ↔ servicio |
| `server/src/routes/production.routes.js` | Las tres rutas |
| `server/tests/semana.test.js` | 15 tests de fechas |
| `server/tests/productions.test.js` | 29 tests del módulo |

**Frontend**

| Archivo | Para qué |
|---|---|
| `client/src/pages/Produccion.jsx` | La pantalla que más se va a usar |
| `client/src/components/InputEntero.jsx` | Cantidades enteras con separador de miles |
| `client/src/api/productions.js` | Una función por endpoint |
| `client/src/utils/format.js` | Se le sumaron las cuentas de semana |

---

## 1. La regla que hay que entender antes que nada

Del plan, sección 1:

> El dueño carga **un número por día** (ladrillos producidos) y marca **qué
> empleados trabajaron**. Esa cantidad se asigna **a cada uno** de ellos y cada
> uno cobra según su tarifa por 1.000.

Léelo dos veces, porque es contraintuitivo: **la cantidad NO se reparte entre
los que trabajaron.**

Si salieron 5.000 ladrillos y trabajaron tres personas, cada una cobra por
5.000, no por 1.666. El equipo entero hizo esos 5.000.

Verificado:

```
Produccion 5.000 con Juan y Ana
  Montos (cada uno por el TOTAL)   Ana: 900.000 | Juan: 750.000
  Mano de obra del dia             1.650.000
```

Juan cobra `5.000 / 1.000 × 150.000 = 750.000`. Ana cobra más porque su tarifa
es 180.000, no porque haya hecho más ladrillos.

> Esto cambió respecto del MVP original, que decía "seleccionar **un** empleado".
> Ahora un registro de producción tiene **varios**.

---

## 2. El concepto de la fase: el snapshot de la tarifa

El plan (sección 4.3) lo llama "foto":

> Guardamos la tarifa **del momento** dentro de la producción. Si el dueño sube
> la tarifa en octubre, las producciones de septiembre siguen calculadas con la
> tarifa vieja.

Cada trabajador dentro de una producción guarda su `nombre`, su `tarifaPorMil` y
su `monto`, además del `employeeId`.

**Por qué importa.** Si solo guardáramos el id y buscáramos la tarifa actual al
mostrar, subirle el sueldo a alguien **reescribiría hacia atrás** lo que ya se le
pagó. Los tickets viejos dejarían de coincidir con el cuaderno, y no habría forma
de explicar la diferencia.

Verificado de punta a punta:

```
5. Se sube la tarifa de Juan a 200.000   la produccion vieja sigue en 150.000
   Una produccion NUEVA usa la nueva     600.000 (3.000 × 200.000/1000)
```

Y hay un test que va más lejos: **elimina** al empleado y comprueba que la
producción vieja siga mostrando su nombre y su monto. El soft delete de la fase 3
es seguro justamente por esto.

Es el tercer lugar donde aparece el mismo patrón: `categoriaNombre` en la caja
(fase 4), `tarifaPorMil` acá, y `precioPorMil` en las ventas (fase 6). Vale la
pena tenerlo grabado: **cuando un dato puede cambiar en el futuro pero el
registro tiene que conservar el de ese día, se copia adentro.**

---

## 3. Las fechas: el bug que no se ve

Esta fase introduce `logic/semana.js`, y todo el archivo existe por un solo
motivo.

El plan (5.9) define la semana así: **lunes a sábado, se paga el sábado, no se
trabaja domingo**. Para saber a qué semana pertenece un día hay que hacer cuentas
con fechas. Y ahí está la trampa:

```js
new Date('2026-09-21').getDay()   // ← MAL
```

Esa línea crea **la medianoche en UTC**. Paraguay está 3 o 4 horas atrás, así que
al leerla con `getDay()` en hora local devuelve el **día anterior**.

En este sistema eso significaría que la producción de un lunes cae en la semana
anterior, se liquida junto con la semana equivocada, y **a alguien se le paga de
menos**. Y nadie lo notaría hasta que reclame.

**La solución:** construir con `Date.UTC(año, mes, día)` y leer con los getters
`getUTC*`. Construyendo y leyendo siempre en UTC, la zona horaria de la máquina
no entra nunca en la cuenta. El `Date` se usa solo como calculadora de días, no
como "momento en el tiempo".

El test que lo blinda:

```js
it('NO se corre un dia por la zona horaria', () => {
  expect(diaDeLaSemana('2026-09-21')).toBe(1);   // lunes
  expect(nombreDelDia('2026-01-01')).toBe('Jueves');
  expect(nombreDelDia('2026-12-31')).toBe('Jueves');
});
```

Hay además tests que cruzan fin de mes, fin de año y año bisiesto (2028 tiene 29
de febrero; 2027 no).

### El domingo: una decisión que tuve que tomar

El plan dice que no se trabaja domingo, pero no dice qué pasa si alguna vez se
trabaja. El dato tiene que poder cargarse igual: la plata se debe.

**Decidí que un domingo cuenta para la semana que EMPIEZA** (el lunes siguiente),
no para la que terminó.

El motivo es concreto: la semana anterior se liquida el sábado, o sea **antes** de
ese domingo. Si el domingo cayera en la semana ya pagada, ese trabajo quedaría sin
cobrar o habría que reabrir una liquidación cerrada. Mandándolo hacia adelante, se
paga el sábado siguiente, que es lo que cualquiera esperaría.

Verificado:

```
7. El domingo 27 va a la semana que empieza   2026-09-28 a 2026-10-03
```

Si preferís al revés, es una línea en `logic/semana.js`.

---

## 4. Las siete escrituras de una sola operación

Guardar la producción de un día es, por dentro, esto (plan 5.1):

1. Crear la producción con el monto de cada trabajador.
2. Arcilla **pura** − N.
3. Arcilla **floja** − N.
4. Ladrillos + N.

Y como cada movimiento de stock son en realidad dos escrituras (el total y su
línea en el historial), son **siete escrituras en total**. Todas dentro de una
transacción.

Sin eso, un corte a mitad de camino podría dejar arcilla descontada sin ladrillos
sumados, o una producción guardada sin que se haya gastado material.

### Por qué se descuenta de las DOS arcillas

El plan (sección 1) lo aclara porque el MVP era ambiguo: el "1/5 de camión"
significa **0,2 de pura Y 0,2 de floja**, no 0,2 repartido entre las dos.

Como el stock está en ladrillos-equivalentes (fase 4), el descuento es
directamente la cantidad producida:

```
5.000 ladrillos  =  5.000 de cada arcilla  =  0,2 camión de cada una
```

Verificado:

```
1. Stock antes    pura 4 | floja 4 camiones | ladrillos 0
3. Stock despues  pura 3.8 | floja 3.8 camiones | ladrillos 5000
   descontado: 0.2 y 0.2
```

### La leña no se toca

El plan (5.6b) lo decidió así: el consumo de leña cambia según su calidad, así que
no se puede descontar por fórmula. El dueño la anota a ojo desde Stock. Hay un
test que lo verifica.

### La caja tampoco

Cargar producción **no genera ningún movimiento de plata**. Los sueldos se pagan
el sábado, en la liquidación semanal (fase 8). El número de "mano de obra del
día" que muestra la pantalla es informativo: sirve para que el dueño vea el costo
del día en el momento.

Hay un test que cuenta los movimientos de caja antes y después y comprueba que
sean los mismos.

### El test de la transacción

Este es el que más me importa de la fase. Reemplaza `Inventory.updateOne` por una
versión que deja pasar las dos primeras llamadas (las arcillas) y **explota en la
tercera** (los ladrillos). O sea: la arcilla ya se descontó cuando aparece el
error.

```js
const stock = await stockActual();
expect(stock.arcilla_pura.cantidad).toBe(100_000);   // intacta
expect(stock.arcilla_floja.cantidad).toBe(100_000);  // intacta
expect(stock.ladrillos.fisico).toBe(0);
expect(await Production.countDocuments()).toBe(0);
```

Sin la transacción, ese test fallaría con arcilla gastada y cero ladrillos hechos
— exactamente el desastre que se quería evitar.

---

## 5. Los trabajadores van adentro del documento

En una base relacional esto serían dos tablas (`producciones` y
`produccion_trabajador`) unidas con un JOIN. En MongoDB van **embebidos**:

```json
{
  "fecha": "2026-09-21",
  "cantidad": 5000,
  "trabajadores": [
    { "employeeId": "...", "nombre": "Juan", "tarifaPorMil": 150000, "monto": 750000 },
    { "employeeId": "...", "nombre": "Ana",  "tarifaPorMil": 180000, "monto": 900000 }
  ]
}
```

**La regla para decidir:** cuando los datos "hijos" solo tienen sentido dentro del
padre y se leen siempre juntos, van adentro.

Ventajas concretas acá:

- Traer la producción de la semana es **una** consulta, no dos.
- Guardar producción + trabajadores es **una escritura atómica**: no puede quedar
  una producción sin trabajadores.

El sub-esquema lleva `_id: false` porque esas líneas no se referencian desde
ningún lado; darles un id propio solo agregaría ruido.

---

## 6. Avisa, no bloquea

¿Qué pasa si se produce más de lo que el sistema cree que hay de arcilla?

**Se guarda igual y el stock queda en negativo.** Es la misma filosofía que el
plan aplica a las ventas (5.7): el depósito real manda sobre el número del
sistema. Si se bloqueara, la producción no se podría registrar y la plata que se
le debe a la gente quedaría sin anotar.

El servidor devuelve el stock resultante en la respuesta, para que la pantalla
pueda avisar:

```
9. Producir mas de lo que hay: avisa   201 -> pura -103000 (negativo) | alerta true
```

### Un detalle de redacción que corregí

La primera versión del aviso decía:

> Guardado. Atención: queda arcilla para **-108.000** ladrillos. Conviene comprar.

Eso no se entiende. Un número negativo no encaja en la frase "queda arcilla
para...". Lo separé en dos mensajes:

> Guardado. Ojo: el sistema quedó con arcilla en negativo (−108.000). O falta
> cargar una compra, o hay que hacer un ajuste de stock.

Que además es **accionable**: dice qué hacer.

---

## 7. La anulación

Igual que con las compras de la fase 4: no se borra nada. Se marca `deletedAt` y
se crean los movimientos **inversos** — se devuelve la arcilla y se sacan los
ladrillos del patio.

Verificado en el navegador: al anular una producción de 5.000, la arcilla pura
pasó de −109.000 a −104.000 y los ladrillos de 209.000 a 204.000.

### La protección de la semana liquidada

El plan (5.9) lo pide: **una producción de una semana ya pagada no se puede
anular**. Anularla cambiaría un sueldo que el empleado ya tiene en el bolsillo.

El campo `payrollId` es el que lo dice: mientras sea `null`, la producción todavía
no se pagó. La liquidación de la fase 8 lo va a completar.

Ya está implementado y testeado (el test simula la liquidación poniendo el
`payrollId` a mano), y en la pantalla la fila muestra "Semana ya liquidada" en vez
del botón Anular.

---

## 8. La pantalla

Es la que más se va a usar: la carga de todos los días. Por eso el camino tiene
que ser corto.

Tres decisiones:

1. **La fecha viene puesta en hoy.** En el 95 % de los casos es la correcta.
   Debajo se muestra "Lunes 21/09/2026" para confirmar de un vistazo que es el
   día que uno cree.

2. **El cálculo se ve en vivo.** Al marcar a alguien y escribir la cantidad, al
   lado de su nombre aparece cuánto cobra. El dueño ve el costo del día **antes**
   de guardar, no después. Verificado: con 5.000 ladrillos y Juan a 200.000, la
   fila muestra "Gs 1.000.000" y el total abajo también.

3. **Los empleados se marcan, no se escriben.** El plan (sección 7) lo pide:
   escribir parado en la fábrica es lento y se cometen errores. Solo aparecen los
   **activos** (plan 4.2).

Debajo, la semana en curso con su resumen (total de ladrillos, mano de obra, y
cuánto lleva cada empleado con cuántos días), navegable con flechas.

### Un componente nuevo, y por qué no reusé uno

Ahora hay tres campos numéricos, y conviene ver la diferencia:

| | Para | Decimales | Separador de miles |
|---|---|---|---|
| `InputGs` | Plata | No | Sí (prefijo "Gs") |
| `InputEntero` | Ladrillos | No | Sí (sufijo libre) |
| `InputCantidad` | Camiones, leña | **Sí** | No |

**Por qué `InputCantidad` no servía para los ladrillos**, aunque parezca lo
mismo: acepta coma **y** punto como separador decimal. Si alguien escribe
`"5.000"` ladrillos, lo lee como **5** (cinco coma cero cero cero).

Para camiones eso nunca pasa, porque nadie compra mil camiones. Para ladrillos
sería un error grave y silencioso: se cargarían 5 ladrillos en vez de 5.000, se
descontaría casi nada de arcilla y se le pagaría a la gente Gs 750 en vez de Gs
750.000.

`InputEntero`, como `InputGs`, borra todo lo que no sea dígito. `"5.000"` son
5000 y punto.

> Si en algún momento aparece un cuarto, va a ser hora de extraer una base común.
> Con tres, cada uno es obvio de leer por separado, que vale más.

### Las cuentas de semana también están en el frontend

`utils/format.js` tiene ahora `semanaDePago`, `sumarDias` y `nombreDelDia` — las
mismas que el servidor.

**Están duplicadas a propósito.** El frontend las necesita para dibujar el
selector de semana sin tener que preguntarle al servidor en cada click de las
flechitas. El servidor sigue siendo la autoridad: al guardar, él recalcula todo.
Acá solo se dibuja.

Con el mismo cuidado de las fechas, claro: `Date.UTC` y getters `getUTC*`.

---

## 9. Los tests

`npm test` corre **154 tests** (antes eran 110).

| Archivo | Tests | Qué cubre |
|---|---|---|
| `productions.test.js` | 29 | Criterio del plan, snapshot, validaciones, anulación, transacción |
| `semana.test.js` | 15 | Lunes/sábado, domingo, fin de mes, fin de año, bisiesto |
| `caja.test.js` | 29 | Seed, balance, categorías, listas (fase 4) |
| `employees.test.js` | 24 | CRUD con soft delete (fase 3) |
| `inventory.test.js` | 20 | Compras, alerta, anulación (fase 4) |
| `auth.test.js` | 19 | Login y rutas protegidas (fase 2) |
| `money.test.js` | 14 | Cuentas de plata (fase 3) |
| `health.test.js` | 4 | Estado del servicio (fase 0) |

Los que más valen de esta fase:

```
✓ cargar 5.000 descuenta 0,2 camion de CADA arcilla y suma 5.000 ladrillos
✓ si falla a mitad de camino, no queda arcilla descontada ni ladrillos sumados
✓ no se reparte: con tres personas, cada una cobra por el total
✓ subir la tarifa NO cambia las producciones ya cargadas
✓ eliminar al empleado NO rompe las producciones viejas
✓ la lena NO se toca
✓ NO genera ningun movimiento de caja: los sueldos se pagan el sabado
✓ NO se puede anular si la semana ya se liquido
✓ avisa si se marco a un empleado inactivo, con su nombre
✓ marcar dos veces al mismo no lo cuenta doble
✓ el domingo cuenta para la semana que EMPIEZA, no la que termino
✓ NO se corre un dia por la zona horaria
```

Resultado: **154 passed**, `npm run lint` sin warnings, `npm audit` con 0
vulnerabilidades.

---

## 10. Cómo se verificó a mano

Contra una base temporal (Atlas quedó intacta):

```
0.  Empleados creados                    Juan (150.000) y Ana (180.000)
1.  Stock antes                          pura 4 | floja 4 camiones | ladrillos 0
2.  Produccion 5.000 con Juan y Ana      201
    Montos (cada uno por el TOTAL)       Ana: 900.000 | Juan: 750.000
    Mano de obra del dia                 1.650.000
3.  Stock despues                        pura 3.8 | floja 3.8 | ladrillos 5000
4.  Caja: la produccion no la toca       2 movimientos (solo las 2 compras)
5.  Se sube la tarifa de Juan            la produccion vieja sigue en 150.000
6.  Semana (lunes 21 a sabado 26)        2026-09-21 a 2026-09-26
    Por empleado                         Ana: 1d 5000lad | Juan: 2d 8000lad
7.  El domingo 27 va a la semana que     2026-09-28 a 2026-10-03
    empieza
8.  Anular la produccion de 5.000        200 -> arcilla devuelta, ladrillos fuera
9.  Producir mas de lo que hay: avisa    201 -> pura negativa | alerta true
10. Marcar a alguien inactivo            400 "Ana figura como inactivo..."
```

Y en el navegador a 375 px:

| Prueba | Resultado |
|---|---|
| Pantalla Producción | Fecha en hoy, con "Lunes 21/09/2026" debajo |
| Solo empleados activos | Ana (desactivada) no aparece en la lista |
| Escribir 5.000 y marcar a Juan | Su fila se pinta y muestra "Gs 1.000.000" en vivo |
| Total | "Mano de obra del día Gs 1.000.000" |
| Guardar | Se limpia el formulario y aparece la fila en la semana |
| Aviso de arcilla | El mensaje nuevo, legible, con qué hacer |
| Resumen | Juan pasó de 1 a 2 días |
| Anular | Pide confirmación explicando exactamente qué se devuelve |
| Tras confirmar | Arcilla +5.000, ladrillos −5.000, la fila desaparece |

---

## 11. Estado del plan

Fase 5 completa, con su criterio cumplido y verificado.

Quedaron listas tres piezas que la fase 8 (liquidación) va a usar tal cual:

- **`logic/semana.js`**, que ya sabe calcular el lunes y el sábado de cualquier
  fecha.
- **`resumirProducciones()`**, que ya calcula el bruto por empleado — a la
  liquidación solo le va a faltar restarle los adelantos y la deuda anterior.
- **`listarSinLiquidar()`**, que trae las producciones de una semana con
  `payrollId: null`.

Y el campo `payrollId` de cada producción ya está, esperando que la liquidación lo
complete.

**Siguiente: Fase 6** — clientes y ventas. Es la más grande del plan: pedidos con
pagos y entregas parciales e independientes, el stock de ladrillos pasa a tener
sus tres números (físico, comprometido y libre), y aparecen las listas de
deudores y de ladrillos por entregar.
