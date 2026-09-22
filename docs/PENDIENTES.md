# Pendientes

Lo que hay que hacer, y lo que se decidió no hacer.

**Cómo se usa:** cada pedido del cliente entra acá con tres cosas — qué pidió,
en qué cajón cae y **por qué**. El "por qué" es el que sirve en dos meses.

Los cajones están explicados en [`OPERACION.md`](OPERACION.md), sección 2:

| Cajón | Cuándo se hace |
|---|---|
| **Número mal** | ya, antes que todo lo demás |
| **Fricción** | en el orden en que le molesta al dueño |
| **Falta algo** | después del piloto, junto |
| **No** | se conversa, no se codea |

---

## Del piloto (fase 11)

> El cliente está revisando uno o dos días. Acá van sus pedidos a medida que
> aparezcan.

| # | Qué pidió | Cajón | Por qué / nota |
|---|---|---|---|
| | | | |

---

## Técnicos, ya identificados

| # | Qué | Cajón | Nota |
|---|---|---|---|
| T1 | Probar la instalación de la PWA en el celular del cliente | Fricción | Lo único de la fase 10 que no se pudo verificar: el navegador del editor bloquea los service workers. Hay que ver que aparezca "Agregar a pantalla de inicio" y que al abrir desde el ícono no se vea la barra del navegador. |
| T2 | Base de pruebas separada en Atlas (`ladrillera_pruebas`) + entorno de preview en Vercel | Falta algo | Media hora, una vez. Hoy no hay dónde probar un cambio publicado sin tocar los datos reales del cliente. Es lo que más cambia la forma de trabajar. |
| T3 | Respaldo semanal, y sacarlo de la computadora | Número mal (de riesgo) | Atlas M0 no hace respaldos. Ya están `npm run respaldar` / `restaurar` y la vuelta completa está probada, pero falta la costumbre: todos los sábados después de liquidar. |
| T4 | Decidir qué hacer con Vercel Hobby | Falta algo | El plan gratuito es para uso no comercial. Esto es un sistema que usa una empresa. Pro son ~20 USD/mes, y es un costo que se le pasa al cliente sin problema. Ver `OPERACION.md` §6. |
| T5 | Bajar `serverSelectionTimeoutMS` de 10 s a 5 s | Fricción | Está justo en el borde del límite de duración de función del plan gratuito. Si Atlas tarda en un arranque en frío, la función muere con un error que no dice nada. Con 5 s falla rápido y con mensaje. |
| T6 | Confirmar que `bcrypt` funciona en la función serverless | Número mal | Es un módulo nativo. El cliente ya hizo login en la web publicada, así que casi seguro anda; queda confirmarlo una vez con la base recién limpiada. Si falla, el reemplazo es `bcryptjs`. |

---

## Decidido que NO (y por qué)

Se anotan igual: un "no" sin razón escrita vuelve a discutirse cada tres meses.

| Qué | Por qué no |
|---|---|
| Modo sin conexión | Le mostraría el saldo de ayer como si fuera de hoy, y aceptaría cargas en una cola invisible. En una app que maneja plata, ver "no hay internet" y esperar es mejor. Hay buena señal en la fábrica. Ver `explicaciones/fase-10-entrega.md` §8. |
| Editar producciones o ventas hacia atrás | El sistema anula y registra el movimiento inverso, como en contabilidad. Editar el pasado haría que el stock de hoy dependa de algo reescribible, y el historial dejaría de explicar los números. |
| Caché, microservicios, colas de trabajo | No hay ningún problema que resuelvan. Cada uno agrega una forma nueva de fallar; un caché mal invalidado muestra plata que no es. Ver `OPERACION.md` §7. |

---

## Ampliaciones grandes (si el negocio las pide)

No son cambios, son proyectos. Van acá para no confundirlas con lo demás.

| Qué | Tamaño real |
|---|---|
| **Varios usuarios con roles** | La más probable: que el encargado cargue producción pero no vea la caja. Hay que construir usuarios, roles, un `requireRol` al lado del `requireAuth` que ya existe, y decidir qué esconde cada pantalla. La barrera de `routes/index.js` ya deja el lugar hecho. |
| **Más de una fábrica** | Todo el sistema asume una. No es agregar un campo: **cada** consulta tendría que filtrar por sucursal, y olvidarse en una sola mezcla los números de las dos. Se piensa de cero. |
| **Cerrar el mes** | Que un mes ya cerrado no se pueda tocar. Es un concepto nuevo, parecido a cómo se congelan las liquidaciones en la fase 8. |
