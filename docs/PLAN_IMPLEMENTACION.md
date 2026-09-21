# Plan de Implementación — Sistema de Gestión Ladrillera

> Basado en `mvp_gesti_n_f_brica_de_ladrillos.md` (v1.0) + decisiones tomadas en la conversación del 20/09/2026.
> Todo lo que no está en el MVP ni fue respondido figura en la sección **9. Preguntas abiertas**, sin asumir una respuesta.

---

## 1. Decisiones tomadas (y qué cambia respecto al MVP)

| Tema | Decisión | Cambio respecto al MVP |
|---|---|---|
| Carga de producción | La hace solo el dueño. Carga **un número por día** (ladrillos producidos) y marca **qué empleados trabajaron**. Esa cantidad se asigna a **cada uno** de ellos y cada uno cobra según su tarifa por 1.000. | El MVP decía "seleccionar un empleado". Ahora un registro de producción tiene **varios empleados**. |
| Descuento de arcilla | Se descuenta de **arcilla pura y arcilla floja a la vez**, en proporción 25.000 ladrillos = 1 camión de cada una. | Se aclara el ejemplo "1/5 de camión": son 0,2 de pura **y** 0,2 de floja. |
| Leña | **No** se descuenta sola (el consumo varía según la calidad). El dueño **registra a ojo cuánto usó**. | El MVP solo decía que se compra. |
| Stock de ladrillos terminados | **Sí**: la producción suma, las **entregas** restan. Se muestran **stock físico** y **stock libre** (físico − vendido sin entregar). | Nuevo. |
| Ventas | Una venta es un **pedido** con **pagos parciales** y **entregas parciales** independientes. Puede pagarse antes de entregarse o entregarse antes de pagarse. | El MVP la registraba como un solo ingreso. Aparecen **deudores** (deben plata) y **ladrillos por entregar** (clientes que ya pagaron). |
| Clientes | **Lista de clientes**. Es **obligatorio** elegir cliente si la venta queda con pago o entrega pendiente; si se paga y entrega en el momento, sigue siendo opcional. | El MVP decía "cliente opcional". |
| Aviso de stock al vender | **Solo avisa, no bloquea.** Muestra físico y libre: se puede vender hoy ladrillos ya comprometidos con otro cliente, porque se producirán antes de su entrega. | Nuevo. |
| Caja | Solo **balance del mes** (ingresos vs egresos). Sin saldo inicial ni saldo acumulado. | Igual que el MVP. |
| Stock inicial | Lo configura **el cliente el día de la entrega**, desde la app. | Nuevo: pantalla de configuración inicial. |
| Precio de venta | **Listas de precio por 1.000 ladrillos** en Ajustes ("Normal", "Mayorista", "Promoción" y las que cree el dueño). En cada venta se elige la lista y opcionalmente un **descuento** en **% o monto fijo**. El total se calcula solo, **proporcional también para menos de 1.000**. | El MVP pedía escribir el monto total. |
| Categorías de gasto | Vienen las del MVP (combustible, flete, herramientas, mantenimiento) + "otro", y el dueño **puede crear nuevas**. | El MVP tenía una lista fija. |
| Semana de pago | **Lunes a sábado**, se paga el **sábado**. No se trabaja domingo. | El MVP decía "últimos 7 días". |
| Adelantos | Salen de caja **al momento de darlos**. El sábado se descuentan del sueldo. Si el adelanto supera lo ganado, **queda deuda** para la semana siguiente. | Nuevo módulo. |
| Usuarios | **Un solo usuario** (el dueño) con login. | El MVP no mencionaba login. |
| Frontend | **React con Vite**. | El MVP dejaba "React/Vanilla JS". |
| Base de datos / Backend | MongoDB + Express + Node.js (como dice el MVP). | Sin cambio. |

---

## 2. Tecnologías y para qué sirve cada una

**Backend (el servidor, lo que el usuario no ve):**

| Tecnología | Qué es / para qué la usamos |
|---|---|
| **Node.js** | Permite ejecutar JavaScript fuera del navegador. Es el "motor" del servidor. |
| **Express** | Librería para crear una **API REST**: un conjunto de direcciones (ej. `POST /api/producciones`) a las que el celular le pide o le manda datos. |
| **MongoDB** | Base de datos que guarda "documentos" (parecidos a objetos JSON) en "colecciones" (parecido a tablas). |
| **MongoDB Atlas** | MongoDB en la nube, con plan gratis. Nos da **transacciones** (ver punto 5.1). |
| **Mongoose** | Librería que define la "forma" (esquema) de cada documento y valida los datos antes de guardarlos. |
| **Zod** | Valida lo que llega del celular (ej. que la cantidad sea un número positivo) antes de tocar la base. |
| **bcrypt** | Guarda la contraseña **encriptada** (nunca en texto plano). |
| **JWT (jsonwebtoken)** | Después del login, el servidor entrega un "pase" (token). El celular lo manda en cada pedido para demostrar que es el dueño. |
| **dotenv** | Lee variables secretas (clave de la base, clave del JWT) desde un archivo `.env` que **no** se sube a Git. |

**Frontend (lo que se ve en el celular):**

| Tecnología | Qué es / para qué la usamos |
|---|---|
| **React** | Arma la interfaz con **componentes** reutilizables (ej. `<BotonGrande>`, `<TarjetaCaja>`). |
| **Vite** | Herramienta que arranca el proyecto React en desarrollo y lo "empaqueta" para producción. |
| **React Router** | Maneja las pantallas (`/produccion`, `/caja`…) sin recargar la página. |
| **vite-plugin-pwa** | Convierte la web en **PWA**: se puede "instalar" en el celular como una app, con ícono. |
| **Tailwind CSS** *(recomendación, se puede cambiar)* | Estilos con clases cortas; facilita botones grandes y diseño mobile-first. |
| **dayjs** | Manejo de fechas (calcular el lunes y sábado de la semana, formato de fechas). |
| **Intl.NumberFormat('es-PY')** | Nativo del navegador. Formatea `1500000` → `1.500.000`. |

**Herramientas de trabajo:** Git + GitHub (historial del código), VS Code, Node LTS, Postman o Thunder Client (probar la API sin frontend), Vitest (tests de los cálculos).

---

## 3. Arquitectura

```
┌─────────────────────┐        HTTPS / JSON        ┌──────────────────────┐        ┌──────────────┐
│  Celular del dueño  │  ───────────────────────▶  │  API Express (Node)  │  ───▶  │  MongoDB     │
│  React PWA          │  ◀───────────────────────  │  reglas de negocio   │  ◀───  │  (Atlas)     │
└─────────────────────┘     token JWT en cada      └──────────────────────┘        └──────────────┘
                              pedido
```

**Regla de oro:** los cálculos de dinero y stock se hacen **siempre en el servidor**, nunca solo en el celular. El frontend muestra y pide; el backend decide.

### Estructura de carpetas (monorepo = un solo repositorio con las dos partes)

```
ladrillera/
├── docs/                    ← MVP y este plan
├── server/
│   ├── src/
│   │   ├── config/          ← conexión a Mongo, lectura de .env
│   │   ├── models/          ← esquemas Mongoose (forma de los datos)
│   │   ├── routes/          ← "puertas": qué URL llama a qué controlador
│   │   ├── controllers/     ← recibe el pedido, llama al servicio, responde
│   │   ├── services/        ← reglas de negocio (producción, liquidación…)
│   │   ├── logic/           ← funciones puras de cálculo (fáciles de testear)
│   │   ├── middleware/      ← auth, manejo de errores
│   │   └── app.js / server.js
│   ├── tests/
│   └── .env                 ← secretos (NO se sube a Git)
└── client/
    ├── src/
    │   ├── pages/           ← una por pantalla
    │   ├── components/      ← piezas reutilizables
    │   ├── api/             ← funciones que llaman al backend
    │   ├── utils/format.js  ← formato Gs, fechas
    │   └── main.jsx
    └── vite.config.js
```

**Por qué capas (route → controller → service → model):** cada archivo tiene un solo trabajo. Si mañana cambia cómo se calcula un sueldo, tocás solo `services/` o `logic/`, sin tocar las rutas ni las pantallas.

---

## 4. Modelo de datos (MongoDB)

Todas las colecciones "borrables" llevan `deletedAt` (fecha o `null`) → **soft delete**: nunca se borra, se marca. Todas llevan `createdAt` / `updatedAt` automáticos.

### 4.1 `users`
`username`, `passwordHash`. Un solo documento, creado con un script (no hay pantalla de registro).

### 4.2 `employees` (Empleados)
| Campo | Tipo | Nota |
|---|---|---|
| nombre | string | |
| rol | string | ej. cortador, cargador |
| tarifaPorMil | entero (Gs) | lo que cobra por cada 1.000 ladrillos |
| activo | boolean | inactivo = no aparece para cargar producción |
| deletedAt | fecha/null | |

### 4.3 `productions` (Producción diaria)
| Campo | Tipo | Nota |
|---|---|---|
| fecha | string `YYYY-MM-DD` | ver 5.4 sobre fechas |
| cantidad | entero | ladrillos del día |
| trabajadores | array | `[{ employeeId, nombre, tarifaPorMil, monto }]` |
| payrollId | id/null | se completa al liquidar la semana |
| deletedAt | fecha/null | |

**Concepto clave — "snapshot" (foto) de la tarifa:** guardamos la tarifa *del momento* dentro de la producción. Si el dueño sube la tarifa en octubre, las producciones de septiembre siguen calculadas con la tarifa vieja.

### 4.4 `advances` (Adelantos) — nuevo
`employeeId`, `fecha`, `monto`, `transactionId` (el egreso de caja que generó), `payrollId` (null hasta que se descuente), `deletedAt`.

### 4.5 `payrolls` (Liquidaciones semanales) — nuevo
| Campo | Nota |
|---|---|
| semanaInicio / semanaFin | lunes y sábado (`YYYY-MM-DD`) |
| estado | `borrador` / `pagada` |
| detalle | por empleado: `{ employeeId, nombre, ladrillos, bruto, adelantos, deudaAnterior, neto, deudaNueva, diario: [{fecha, cantidad, monto}] }` |
| totalAPagar | suma de `neto` |
| pagadaEn, transactionId | al marcar pagada |

La `deudaNueva` de un empleado en una liquidación pagada es la `deudaAnterior` de la siguiente.

### 4.6 `transactions` (Caja)
| Campo | Nota |
|---|---|
| tipo | `ingreso` / `egreso` |
| categoriaId, categoriaNombre | referencia a `categories` + copia del nombre (snapshot, por si después se renombra) |
| monto | entero Gs, siempre positivo (el `tipo` dice si suma o resta) |
| fecha, descripcion | |
| origen | `{ tipo: 'pago_venta' / 'compra' / 'adelanto' / 'liquidacion', id }` si la generó otro módulo |
| deletedAt | |

### 4.6a `categories` (Categorías de caja) — nuevo
| Campo | Nota |
|---|---|
| nombre | ej. "Combustible" |
| tipo | `ingreso` / `egreso` |
| sistema | `true` para las que usa el propio sistema: `venta`, `compra_material`, `adelanto`, `sueldos`. No se pueden editar ni borrar ni elegir a mano. |
| deletedAt | las creadas por el dueño se pueden desactivar (soft delete); los gastos viejos conservan su nombre gracias al snapshot |

Se cargan al iniciar (**seed** = datos iniciales que crea un script): las 4 de sistema + combustible, flete, herramientas, mantenimiento, otro.

### 4.6a2 `priceLists` (Listas de precio) — nuevo
| Campo | Nota |
|---|---|
| nombre | "Normal", "Mayorista", "Promoción", u otra que cree el dueño |
| precioPorMil | entero Gs |
| predeterminada | `true` en una sola (la que aparece elegida por defecto al vender, inicialmente "Normal") |
| deletedAt | se pueden desactivar; la predeterminada no |

### 4.6b `clients` (Clientes) — nuevo
`nombre`, `telefono` (opcional), `notas` (opcional), `deletedAt`.

### 4.6c `sales` (Ventas / pedidos) — nuevo
| Campo | Tipo | Nota |
|---|---|---|
| fecha | `YYYY-MM-DD` | día en que se cerró la venta |
| clientId | id/null | obligatorio si algo queda pendiente |
| cantidad | entero | ladrillos vendidos |
| listaPrecioId, listaPrecioNombre | | lista elegida (+ copia del nombre) |
| precioPorMil | entero Gs | **snapshot** del precio de esa lista al crear la venta |
| subtotal | entero Gs | `redondear(cantidad / 1000 × precioPorMil)` |
| descuento | objeto/null | `{ tipo: 'porcentaje' \| 'monto', valor }` elegido por el dueño |
| descuentoGs | entero Gs | descuento ya convertido a guaraníes |
| montoTotal | entero Gs | `subtotal − descuentoGs` (todo calculado por el servidor) |
| pagos | array | `[{ _id, fecha, monto, transactionId, deletedAt }]` |
| entregas | array | `[{ _id, fecha, cantidad, deletedAt }]` |
| deletedAt | fecha/null | |

Valores **calculados** (no se guardan, se derivan de los arrays para que nunca queden desactualizados):
- `cobrado` = suma de pagos · `porCobrar` = montoTotal − cobrado
- `entregado` = suma de entregas · `porEntregar` = cantidad − entregado
- `estadoPago`: pendiente / parcial / pagado · `estadoEntrega`: pendiente / parcial / entregado

**Concepto — dato derivado vs guardado:** si guardáramos "estado = pagado" aparte, al anular un pago habría que acordarse de actualizarlo. Calculándolo desde los pagos, siempre es correcto.

### 4.7 `inventory` (Stock actual)
Un documento por material: `arcilla_pura`, `arcilla_floja`, `lena`, `ladrillos`. Campo `cantidad` en **unidad interna** (ver 5.2).

### 4.8 `inventoryMovements` (Historial de stock) — propuesto
`material`, `cantidad` (+ o −), `motivo` (`compra`, `produccion`, `entrega`, `uso_lena`, `ajuste`, `stock_inicial`, `anulacion`), `origen`, `fecha`.
**Para qué:** saber *por qué* cambió el stock, y poder **revertir** exactamente un movimiento cuando se anula algo (soft delete).

### 4.9 `settings` (Configuración)
| Clave | Valor inicial | Fuente |
|---|---|---|
| ladrillosPorCamion | 25.000 | MVP |
| umbralAlertaArcilla | 25.000 ladrillos | MVP |
| unidadLena | texto que define el dueño (ej. "carga", "camión") | se configura en la entrega |
| configuracionInicialHecha | false | pasa a true al terminar la configuración inicial |

Estos números quedan editables desde la app, así no hay que tocar código si cambian.

---

## 5. Reglas de negocio (el corazón del sistema)

### 5.1 Guardar producción del día
Al guardar `cantidad = N` con los empleados marcados, en **una sola transacción**:
1. Crear la producción con `monto = redondear(N / 1000 × tarifaPorMil)` por trabajador.
2. Arcilla pura −N (unidad interna) y arcilla floja −N.
3. Ladrillos terminados (físico) +N.
4. Registrar los movimientos de inventario.

La leña **no** se toca acá (ver 5.6b).

**Transacción (concepto):** "todo o nada". Si falla el paso 3, se deshacen el 1 y el 2. Sin esto podrías tener una producción guardada sin que se haya descontado arcilla.

### 5.2 Guardar arcilla sin problemas de decimales
En JavaScript `0.1 + 0.2 = 0.30000000000000004`. Para no acumular errores guardando "0,2 camiones", la arcilla se guarda en **ladrillos-equivalentes** (enteros): 1 camión = 25.000. Para mostrar: `camiones = cantidad / 25000` → "3,4 camiones".

### 5.3 Dinero en Guaraníes
El guaraní no tiene centavos → **todo entero**. JavaScript maneja enteros exactos hasta 9.007.199.254.740.991, sobra. Los redondeos (ej. tarifas que no dan exacto) se hacen al guaraní más cercano en un único lugar (`logic/money.js`).

### 5.4 Fechas
Las fechas de negocio (día de producción, gasto, venta) se guardan como texto `"2026-09-21"` en hora de Paraguay. Evita el error clásico donde algo cargado a las 22 h aparece en el día siguiente por la conversión a UTC.

### 5.5 Alerta de arcilla (Dashboard)
`disponible = mínimo(arcilla_pura, arcilla_floja)` — se necesitan las dos; la que falta primero limita.
Si `disponible < 25.000` → **Alerta Roja**: "Comprar arcilla" (indicando cuál falta).

### 5.6 Compra de material
Suma al stock (arcilla en camiones × 25.000; leña en su unidad) **y** crea automáticamente un egreso de caja categoría `compra_material`. Todo en una transacción.

### 5.6b Uso de leña
Botón "Registrar uso de leña": el dueño anota la cantidad aproximada que se gastó (en la unidad configurada). Resta del stock y queda en el historial. El stock de leña es **aproximado** por naturaleza.

### 5.7 Ventas, pagos y entregas
Una venta tiene **tres momentos independientes**, cada uno con su efecto:

| Acción | Efecto en caja | Efecto en stock |
|---|---|---|
| **Crear venta** (cantidad, monto total, cliente) | ninguno | ninguno en el físico; sube el **comprometido** |
| **Registrar pago** (monto, fecha) | **ingreso** categoría `venta` por ese monto | ninguno |
| **Registrar entrega** (cantidad, fecha) | ninguno | **físico − cantidad**; baja el comprometido |

**Monto de la venta:** el dueño escribe la cantidad, elige la lista de precio (viene marcada la predeterminada) y opcionalmente un descuento. El sistema muestra al instante:
```
subtotal    = redondear(cantidad / 1000 × precioPorMil)
descuentoGs = porcentaje → redondear(subtotal × % / 100)
              monto      → valor
montoTotal  = subtotal − descuentoGs
```
Ejemplo: 5.000 ladrillos, lista Mayorista a 1.000.000 Gs/mil, descuento 10 % → subtotal 5.000.000, descuento 500.000, **total 4.500.000**.
Validaciones: porcentaje entre 0 y 100; monto fijo no mayor al subtotal.
El precio y el descuento quedan guardados en la venta: si mañana cambian las listas en Ajustes, las ventas ya hechas no cambian.

Atajo para el caso común: al crear la venta se puede marcar **"pagado completo"** y/o **"entregado completo"**, y el sistema crea el pago y/o la entrega en el mismo paso.

**Concepto — la caja registra cuando entra la plata:** el balance del mes suma los pagos por su **fecha de pago**, no por la fecha de la venta. Una venta de septiembre que se cobra en octubre suma en octubre.

**Validaciones (bloquean):** no se puede pagar más que lo que falta cobrar, ni entregar más que lo que falta entregar. Si el cliente queda con algo pendiente, es obligatorio elegir cliente.

**Stock de ladrillos — tres números:**
```
físico       = producido − entregado          (lo que hay en el patio)
comprometido = suma de "porEntregar" de todas las ventas activas
libre        = físico − comprometido          (puede ser negativo)
```

**Avisos (no bloquean, piden confirmación):**
- Al **crear una venta** por más que el **libre**: aviso amarillo → "Hay X libres. Estos ladrillos ya están vendidos a otros clientes; tené en cuenta reponerlos antes de sus entregas."
- Al **registrar una entrega** por más que el **físico**: aviso rojo → "Según el sistema hay X en el patio." (No bloquea porque el stock puede estar desactualizado; se sugiere hacer un ajuste.)

**Deudores y ladrillos por entregar:**
- **Deudores** = ventas con `porCobrar > 0` (el cliente nos debe plata).
- **Por entregar** = ventas con `porEntregar > 0` (le debemos ladrillos al cliente; incluye los que ya pagaron).
Ambas listas se pueden ver agrupadas por cliente.

### 5.8 Adelanto
Crea el adelanto **y** un egreso de caja categoría `adelanto`, en el momento.

### 5.9 Liquidación semanal (sábado)
**Generar** (para la semana lunes–sábado en curso) — por cada empleado:
```
bruto         = suma de sus montos de producción de la semana
adelantos     = suma de sus adelantos de la semana no descontados
deudaAnterior = deudaNueva de su última liquidación pagada (o 0)
resultado     = bruto − adelantos − deudaAnterior
neto          = máximo(resultado, 0)        → lo que se le paga
deudaNueva    = máximo(−resultado, 0)       → pasa a la semana siguiente
```
Se muestra la lista: Nombre, Total ladrillos, Bruto, Adelantos, Deuda, **Neto a pagar**.

**Marcar pagado:** crea egreso de caja `sueldos` por el total neto; marca producciones y adelantos con el `payrollId`; la liquidación pasa a `pagada`.

**"Reiniciar contadores"** (del MVP): no se borra nada. Los totales siempre se calculan *por semana*, así que el lunes siguiente arrancan en 0 solos.

**Protección:** una producción o adelanto de una semana ya pagada **no se puede editar ni anular**.

### 5.10 Ticket semanal por empleado
Detalle día por día (fecha, ladrillos, monto) + adelantos + deuda + neto. Formato de salida → **pregunta abierta**.

### 5.11 Soft delete y anulaciones
Anular = poner `deletedAt` **y** revertir sus efectos con movimientos inversos:
- Anular producción → devuelve arcilla y leña, resta ladrillos.
- Anular compra → resta stock y anula su egreso.
- Anular adelanto → anula su egreso.
- Anular un **pago** de venta → anula su ingreso en caja.
- Anular una **entrega** → devuelve los ladrillos al stock físico.
- Anular una **venta** → solo si no tiene pagos ni entregas activas (primero se anulan esos).
Todos los listados filtran `deletedAt: null`.

### 5.11b Configuración inicial (día de la entrega)
Pantalla que aparece la primera vez (mientras `configuracionInicialHecha = false`), en pasos:
1. Unidad de leña y listas de precio (al menos "Normal").
2. Stock actual: arcilla pura y floja (camiones), leña, ladrillos en el patio → movimientos `stock_inicial`.
3. Empleados con sus tarifas.
4. *(opcional)* Clientes y ventas que ya estén pendientes (con fecha pasada, lo cobrado y lo entregado hasta hoy).

Todo se puede corregir después desde Ajustes / ajustes de stock.

### 5.12 Dashboard
- Balance del mes actual: ingresos − egresos del mes (ambos visibles).
- Ladrillos producidos en la semana en curso (lunes a hoy).
- Alerta roja de arcilla.
- Ladrillos: físico / comprometido / libre.
- Total **por cobrar** (Gs) y total **por entregar** (ladrillos), con acceso a las listas.
- *(propuesto)* stock de leña aproximado.

---

## 6. API (direcciones del backend)

Todas bajo `/api`, todas (menos login) requieren token.

| Método | Ruta | Acción |
|---|---|---|
| POST | `/auth/login` | Login |
| GET/POST | `/employees` | Listar / crear |
| PATCH/DELETE | `/employees/:id` | Editar / soft delete |
| GET/POST | `/productions` | Listar (por semana) / cargar día |
| DELETE | `/productions/:id` | Anular (revierte stock) |
| GET/POST | `/advances` | Listar / dar adelanto |
| DELETE | `/advances/:id` | Anular |
| GET | `/transactions?mes=2026-09` | Movimientos de caja |
| POST | `/transactions/egreso` | Gasto operativo |
| GET/POST | `/categories` | Listar / crear categorías de gasto |
| PATCH/DELETE | `/categories/:id` | Renombrar / desactivar (no las de sistema) |
| DELETE | `/transactions/:id` | Anular (solo gastos manuales) |
| GET/POST | `/price-lists` | Listar / crear listas de precio |
| PATCH/DELETE | `/price-lists/:id` | Editar precio o nombre, marcar predeterminada / desactivar |
| GET/POST | `/clients` | Listar / crear clientes |
| PATCH/DELETE | `/clients/:id` | Editar / soft delete |
| GET | `/sales?estado=por-cobrar\|por-entregar&cliente=` | Listar ventas con filtros |
| POST | `/sales` | Crear venta (con atajos pagado/entregado completo) |
| POST | `/sales/:id/pagos` | Registrar pago (genera ingreso) |
| POST | `/sales/:id/entregas` | Registrar entrega (resta stock) |
| DELETE | `/sales/:id/pagos/:pagoId` · `/sales/:id/entregas/:entregaId` · `/sales/:id` | Anulaciones |
| GET | `/inventory` | Stock actual (incluye físico/comprometido/libre de ladrillos) |
| POST | `/inventory/compras` | Compra de material |
| POST | `/inventory/uso-lena` | Registrar uso de leña |
| POST | `/inventory/ajustes` | Ajuste manual (correcciones) |
| POST | `/setup` | Guardar configuración inicial |
| GET | `/payrolls/preview?semana=2026-09-21` | Generar liquidación (sin guardar pago) |
| POST | `/payrolls/:semana/pagar` | Marcar pagado |
| GET | `/payrolls/:id/ticket/:employeeId` | Ticket de un empleado |
| GET | `/dashboard` | Datos de inicio |
| GET/PATCH | `/settings` | Configuración |

---

## 7. Pantallas (mobile-first)

Navegación con **barra inferior** (se alcanza con el pulgar): **Inicio · Producción · Ventas · Caja · Más** (Más → Stock, Empleados, Adelantos, Liquidación, Clientes, Ajustes).

Pautas de diseño: botones de al menos 48 px de alto, texto base grande, alto contraste para sol, teclado numérico (`inputMode="numeric"`) en montos y cantidades, selects/checkboxes en vez de escribir, formato `1.500.000` mientras se escribe, confirmación antes de acciones de dinero.

| Pantalla | Contenido |
|---|---|
| Login | usuario + contraseña |
| Configuración inicial | asistente en pasos (ver 5.11b), solo la primera vez |
| Inicio | tarjetas: balance del mes, ladrillos de la semana, alerta roja arcilla, ladrillos físico/libre, por cobrar, por entregar |
| Producción | fecha (por defecto hoy), cantidad, lista de empleados activos con checkbox, preview de cuánto cobra cada uno, Guardar. Debajo: producción de la semana. |
| Ventas | pestañas **Por cobrar · Por entregar · Todas**; botón **+ Nueva venta** (cliente, cantidad, lista de precio, descuento % o Gs, total calculado en vivo, atajos "pagado completo"/"entregado completo", avisos de stock) |
| Detalle de venta | resumen (cobrado/por cobrar, entregado/por entregar), historial de pagos y entregas, botones **+ Pago** y **+ Entrega** |
| Caja | balance del mes + lista de movimientos; botón **− Gasto** (categoría en un select, con opción "+ Nueva categoría" ahí mismo); los ingresos vienen de los pagos de ventas |
| Clientes | lista con saldo por cobrar y ladrillos por entregar de cada uno; alta/edición |
| Stock | arcilla pura/floja (camiones), leña (aproximada), ladrillos físico/comprometido/libre; botones **Registrar compra**, **Registrar uso de leña**, **Ajuste**; historial |
| Empleados | lista + alta/edición (nombre, rol, tarifa por mil, activo) |
| Adelantos | elegir empleado, monto, fecha; lista de la semana |
| Liquidación | semana actual, tabla por empleado, **Marcar pagado**, acceso a tickets; historial de semanas |
| Ajustes (panel de admin) | **listas de precio** (crear/editar/predeterminada), parámetros de arcilla, unidad de leña, **categorías de gasto** (crear/renombrar/desactivar), cambiar contraseña |

---

## 8. Fases de implementación

Cada fase es una **"rebanada vertical"**: backend + pantalla del mismo módulo, así ves funcionar cada parte en el celular antes de pasar a la siguiente.

| # | Fase | Qué se construye | Qué aprendés | Listo cuando… |
|---|---|---|---|---|
| 0 | Entorno | Node LTS, Git, repo en GitHub, cuenta Atlas, carpetas `client/` y `server/` | Git básico, qué es un `package.json` | `npm run dev` levanta servidor y React |
| 1 | Base del backend | Express, conexión a Mongo, `.env`, middleware de errores, ruta `/api/health` | Qué es una API, variables de entorno | `/api/health` responde OK con la base conectada |
| 2 | Login | modelo `users`, script para crear al dueño, login con JWT, middleware `requireAuth`; pantalla Login y guardado del token en React | Hash de contraseñas, tokens, rutas protegidas | Sin login no se accede a nada |
| 3 | Layout + Empleados | barra inferior, componentes base (BotonGrande, InputGs), `format.js`; CRUD de empleados con soft delete | Componentes React, formularios, CRUD | Alta/edición/baja de empleados desde el celular |
| 4 | Configuración + Inventario + Caja base | `settings`, `categories` y `priceLists` (con seed), `inventory`, `inventoryMovements`, `transactions`; compra de material con egreso automático; uso de leña; ajustes; gastos manuales; balance del mes | Transacciones de Mongo, relaciones entre colecciones | Registrar una compra suma stock y aparece el egreso en caja |
| 5 | Producción diaria | carga con varios empleados; descuento de arcilla; suma de ladrillos físicos; anulación con reversión | Lógica de negocio en `services/`, funciones puras + tests | Cargar 5.000 descuenta 0,2 camión de cada arcilla y suma 5.000 ladrillos |
| 6 | Clientes y Ventas | `clients`, `sales` con pagos y entregas parciales, stock físico/comprometido/libre, avisos, listas de deudores y por entregar | Arrays dentro de documentos, datos derivados, validaciones | Venta pagada hoy y entregada en 2 partes deja caja y stock correctos |
| 7 | Adelantos | alta/anulación con egreso de caja | Reutilizar servicios existentes | El adelanto aparece en caja al instante |
| 8 | Liquidación + tickets | preview, cálculo con adelantos y deuda, marcar pagado, bloqueo de semanas pagadas, ticket | Cálculos por período, estados (borrador/pagada) | Caso de prueba con deuda arrastrada da los números esperados |
| 9 | Dashboard | endpoint `/dashboard` y pantalla Inicio con alerta roja | Agregaciones de MongoDB | Inicio muestra datos reales en < 2 s |
| 10 | Configuración inicial + PWA + deploy | asistente de configuración inicial; instalable, íconos; publicar backend, frontend y base | Build de producción, hosting, HTTPS | El dueño instala la app, carga su stock y empleados solo |
| 11 | Piloto | 1–2 semanas de uso real, correcciones | Feedback de usuario real | Una liquidación real coincide con el cuaderno |

**Tests mínimos (Vitest)** sobre `logic/`: cálculo de monto por trabajador, descuento de arcilla, liquidación con adelanto mayor a lo ganado, cálculo de lunes/sábado de una semana, estados de venta (pago/entrega parcial), total con lista de precio y descuento % / Gs, físico/comprometido/libre, formato de Gs.

---

## 9. Preguntas abiertas (no bloquean las fases 0 a 3)

**Resueltas:** unidad y consumo de leña (manual, unidad configurable), stock inicial (configuración inicial en la entrega), caja (solo balance del mes), venta sin stock (avisa con físico y libre), clientes (lista, obligatorio si hay pendiente), pagos/entregas parciales (sí), categorías de gasto (base + creadas por el dueño), precio de venta (listas de precio por 1.000 + descuento % o Gs por venta, proporcional).

**Necesarias antes de la Fase 8–10:**
1. **Ticket semanal:** ¿verlo en pantalla, imprimir, descargar PDF o compartir por WhatsApp?
2. **Producción cargada el sábado después de pagar:** ¿se permite? (hoy el plan la bloquea porque la semana ya está pagada).
3. **Internet en la fábrica:** ¿hay buena señal? Si no, habría que agregar modo sin conexión (más complejo).
4. **Hosting:** ¿presupuesto para servidor? (opción gratuita/bajo costo: backend en Render o Railway + MongoDB Atlas gratis + frontend en Vercel/Netlify).
