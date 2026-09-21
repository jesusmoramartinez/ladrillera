# Documento de Producto Mínimo Viable (MVP)

## Sistema de Gestión para Fábrica de Ladrillos

### 1. Resumen del Proyecto

Desarrollo de una aplicación web progresiva (Mobile First) para la gestión operativa y financiera de una fábrica artesanal de ladrillos en Paraguay. El sistema permitirá controlar la producción diaria de los empleados, automatizar el cálculo de pagos semanales, gestionar el inventario de materia prima (con alertas de reposición) y llevar el control de ingresos y egresos (Caja).

### 2. Consideraciones Técnicas Clave

* **Diseño Mobile-First:** Interfaz optimizada para pantallas táctiles de celulares, botones grandes, tipografía legible bajo luz solar y menús desplegables para minimizar la escritura.

* **Moneda Local:** Todo el sistema trabajará con Guaraníes (Gs). Se deben usar separadores de miles en el Frontend (ej. 1.500.000) y tipos de datos numéricos grandes en la base de datos.

* **Lógica de Negocio Principal:** 1 Camión de Arcilla pura y otro camion de arcilla floja = \~25.000 ladrillos producidos.

* **Arquitectura Recomendada:** MERN Stack (MongoDB, Express, React/Vanilla JS, Node.js).

* **Seguridad y Errores:** Implementar "Soft Delete" (borrado lógico) en bases de datos para no perder registros por accidente.

### 3. Módulos y Flujos de Usuario

#### 3.1. Panel de Control (Dashboard)

La pantalla de inicio rápida.

* **Muestra:** Balance de caja del mes actual (Ingresos vs Egresos).

* **Muestra:** Total de ladrillos producidos en la semana en curso.

* **Acción Automática:** Si el cálculo de arcilla disponible es menor a 25.000 ladrillos, muestra una **Alerta Roja** indicando que se debe comprar más arcilla.

#### 3.2. Módulo de Empleados y Producción (El Día a Día)

* **Configuración Inicial:** Permite registrar empleados definiendo su nombre, rol (ej: cortador, cargador) y la tarifa en Guaraníes que cobran por cada 1.000 ladrillos procesados.

* **Carga Diaria:** Formulario rápido donde el usuario selecciona un empleado, ingresa la cantidad de ladrillos trabajados en el día y guarda. Debe generar un ticket semanal con el pago segun la produccion de cada empleado.

* **Automatización:** Al guardar la producción diaria, el sistema **descuenta automáticamente** del inventario la proporción de arcilla utilizada (Ej: Si se cargan 5.000 ladrillos, descuenta 1/5 de camión).

#### 3.3. Módulo de Caja (Ingresos y Egresos diarios)

Reemplaza el cuaderno de almacén.

* **Ingresos:** Registro de ventas (Cantidad de ladrillos vendidos, cliente opcional, monto total en Gs).

* **Egresos:** Registro de gastos operativos (Combustible, alquiler de flete, herramientas, mantenimiento). Afecta directamente el saldo en caja.

#### 3.4. Módulo de Inventario y Proveedores

* **Ingreso de Material:** Formulario para registrar la compra de materia prima (Leña, Arcilla Pura, Arcilla Floja).

* **Métrica:** La arcilla se ingresa por "Camiones". Al registrar la compra, se suma al stock disponible y el costo de la compra se registra automáticamente como un Egreso en el Módulo de Caja.

#### 3.5. Cierre Semanal y Liquidación de Sueldos

* **Botón "Generar Liquidación":** Al presionarlo, el sistema agrupa la producción de los últimos 7 días.

* **Resumen:** Muestra una lista detallada con: Nombre del Empleado, Total de ladrillos producidos, y Total a pagar en Gs.

* **Acción "Marcar Pagado":** Al confirmar el pago, la sumatoria total se descuenta de la Caja principal y los contadores de los empleados se reinician para la semana siguiente.

### 4. Estructura Básica de Base de Datos (Sugerida)

Para soportar este MVP en MongoDB, se necesitarán 4 colecciones principales:

1. **Empleados (Employees):** Nombre, Rol, TarifaPorMil, EstadoActivo.

2. **Producción (Productions):** EmpleadoID, Fecha, CantidadLadrillos.

3. **Transacciones (Transactions / Caja):** Tipo (Ingreso/Egreso/Sueldos), Monto, Descripcion, Fecha.

4. **Inventario (Inventory):** TipoMaterial (Pura/Floja/Leña), CantidadActual (en camiones), FechaUltimaActualizacion.

*Fin del documento MVP v1.0*