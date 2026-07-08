# CLAUDE.md

Contexto del proyecto para Claude Code. Este archivo se actualiza a medida que el negocio y la aplicación avanzan — no es estático, edítalo cuando algo cambie.

## El negocio, en una frase
Diagnóstico personalizado + plataforma propia de gestión para pymes colombianas: ventas, CRM, inventario, estado de pérdidas y ganancias, proyecciones e insights en un solo lugar, sin que la empresa necesite un equipo de BI interno.

## Quién soy (la persona con la que hablas)
No tengo experiencia técnica. Explica en español simple, sin dar por hecho que conozco jerga. Antes de cambios grandes (nueva tabla, nueva dependencia, reestructurar algo existente), pregúntame primero y explica el porqué en una frase.

## Stack
- Next.js (React) + Tailwind CSS
- Supabase: base de datos Postgres + autenticación
- Vercel: hosting
- Sin servidores propios que administrar

## Principio de portabilidad (no negociable)
- La lógica de negocio vive en código propio (rutas de Next.js), nunca en funciones exclusivas de la plataforma. No usar Supabase Edge Functions para reglas de negocio centrales.
- Row Level Security se define en SQL estándar, no en configuración exclusiva del panel de Supabase.
- Ninguna función "mágica" exclusiva de un proveedor para algo central del negocio (diagnóstico, planes, módulos). Eso se reserva para detalles menores.

## Base de datos
El esquema completo vive en `schema.sql`, en la raíz del proyecto. Ejecútalo tal cual en Supabase antes de escribir código que dependa de estas tablas. No lo modifiques sin decírmelo explícitamente primero — si hace falta un cambio, proponlo y espera mi confirmación.

Convención: nombres de tablas y columnas en español, coincidiendo con el vocabulario del negocio (`empresas`, `ventas`, `crm_contactos`, etc.), para que yo pueda leer y entender la estructura aunque no sepa programar. El código (componentes, funciones, nombres de archivo) sí va en inglés, como es convención en el ecosistema de Next.js.

**Los negocios varían mucho entre sí** — una tienda de aseo no necesita los mismos campos que un taller de motos. Por eso `inventario_items`, `ventas` y `crm_contactos` tienen una columna `atributos` (JSON) para lo que no es universal, en vez de columnas fijas por tipo de negocio. Nunca agregues columnas nuevas a una tabla para acomodar un tipo de negocio específico; usa ese campo flexible, y en el formulario de la aplicación decide qué preguntar según `empresas.tipo_negocio`.

Diferencia importante: `atributos` es para campos adicionales sobre un registro que ya existe (una venta, un contacto, un ítem). Si un tipo de negocio necesita algo que no es un campo sino una entidad nueva por completo (ej. un taller de motos llevando el historial de cada vehículo por separado, con su propia tabla), eso sí amerita una tabla propia — pero se decide cuando haya un cliente real que lo necesite, no antes.

`etapa_pipeline` en el CRM es la excepción: se queda con sus 4 valores fijos para todos los negocios, porque el embudo de ventas es un concepto universal. Si un tipo de negocio necesita otro nombre para una etapa ("cotización" en vez de "propuesta"), eso se resuelve con una etiqueta distinta en la aplicación, no cambiando el dato guardado.

Si el patrón de `atributos` no alcanza para un caso real, dímelo antes de improvisar una solución.

## Multi-tenant: la regla que nunca se rompe
Cada empresa cliente ve solo sus propios datos. Ya está resuelto vía Row Level Security (funciones `mi_empresa_id()` y `es_admin()` en el esquema). Nunca escribas una consulta que la esquive — por ejemplo, usando la service role key desde el cliente. Si una función de verdad necesita más privilegios, dilo explícitamente y explica por qué antes de hacerlo.

## Los dos módulos de la aplicación
- **Cliente** (rol `cliente`): cada empresa ve solo su propio resumen, ventas, CRM, inventario, P y G, proyecciones e insights — según qué módulos tenga activos.
- **Administrador** (rol `admin`): donde reviso mis empresas cliente, sus diagnósticos, planes y estado de suscripción.
  - Mientras tengamos pocos clientes (menos de 5), el panel nativo de tablas de Supabase hace las veces de admin. No construyas una pantalla propia de administrador todavía, a menos que yo lo pida explícitamente.
  - La activación de módulos (`empresas.modulos_activos`) es siempre una acción manual mía, nunca automática a partir del diagnóstico. El diagnóstico recomienda; yo decido qué se activa según lo que el cliente realmente compró.
  - Lo mismo con `empresas.pagina_entrada`: define en qué módulo aterriza esa empresa al iniciar sesión, y también lo fijo yo durante el diagnóstico, nunca el cliente. Un negocio de venta directa (como Aseo Total) entra en `ventas`; un negocio que cotiza o negocia antes de vender entraría en `crm`. El cliente del negocio no debería tener que entender ni elegir esta distinción — para él simplemente "así abre la aplicación".

## Cómo se registra una venta (el flujo más importante del producto)

Todo pasa en una sola pantalla, con un solo botón de guardar — nunca en pasos separados. Quien atiende no debe ir primero a "CRM", luego a "Ventas", luego a "Inventario": todo sale de un formulario de "Agregar venta".

Ese formulario pide datos del cliente (nombre, teléfono, y lo que aplique según el tipo de negocio — placa y modelo para un taller de motos, por ejemplo) y qué productos o servicios está llevando, elegidos de un catálogo único: la tabla `inventario_items`, que incluye tanto productos físicos como servicios (columna `tipo`).

Antes de guardar, el formulario deja buscar al cliente por nombre, teléfono o placa (función `buscar_clientes()`) — se escribe parte del dato y aparecen las coincidencias dentro de esa empresa. Si el cliente aparece y se confirma, su id se pasa directo a `registrar_venta()`; si no aparece nada, es un cliente nuevo y la función lo crea sola. Así queda registrado desde el principio quién es recurrente y quién no, sin pasos extra.

Al guardar, la aplicación llama una sola vez a la función `registrar_venta()` de la base de datos, que internamente busca o crea el cliente en el CRM, crea la venta, y agrega cada ítem — lo que dispara el descuento de inventario automático, pero solo para los productos, no para los servicios. No construyas esto como llamadas separadas desde el frontend (crear contacto, luego crear venta, luego crear items); usa esa función para que sea una sola operación: si algo falla, no queda información a medias.

### Ventas — especificación cerrada para el MVP

Definida con el caso base de un negocio de productos de aseo del hogar (sin servicios, la versión más simple posible). Esto ya no es un boceto — constrúyelo tal cual:

- **Fecha**: `ventas.fecha` incluye hora, no solo el día. Por defecto es el momento exacto en que se guarda, pero la persona la puede cambiar en el formulario antes de guardar.
- **Producto**: se elige del catálogo (`inventario_items`), que debe tener precios ya cargados — el formulario sugiere ese precio, pero es editable en esa venta puntual.
- **Cantidad**: un solo campo numérico (`ventas_items.cantidad`) — vender 30 unidades es escribir "30", nunca agregar fila por fila.
- **Cliente**: solo tres campos — nombre, teléfono, correo. Nada más por ahora. Si más adelante hay domicilios, dirección y hora de entrega se agregan a `crm_contactos.atributos`, sin tocar la tabla — pero eso no se construye todavía, es solo una idea anotada para el futuro.
- **Historial de precios y costos**: si cambia el precio o el costo de un producto, las ventas pasadas no se alteran — `ventas_items.precio_unitario` y `.costo_unitario` quedan congelados en cada venta. Las proyecciones y la rentabilidad futura sí usan el valor nuevo desde el momento del cambio en adelante. Esto ya está resuelto en el esquema, no hace falta nada adicional.
- **Orden del formulario**: la sección de producto y la de cliente son independientes entre sí — algunos negocios van a querer registrar primero qué se vendió y después a quién, otros al revés. No fuerces un orden fijo tipo asistente de pasos; ambas secciones deben poder llenarse en cualquier orden, en la misma pantalla.
- **Total de la venta y unidades totales**: `ventas.monto` ya es el total en dinero; `vista_resumen_ventas` da el total de unidades y de ítems distintos por venta, sin duplicar nada — no crear columnas nuevas para esto.
- **Día de la semana y festivos**: `vista_ventas_por_dia` agrupa las ventas por día, con el nombre del día en español y si fue festivo (contra la tabla `festivos`, poblada con el calendario oficial de Colombia 2026). **Recordatorio: la tabla `festivos` hay que actualizarla a mano cada año** — no hay ninguna fórmula que la genere sola.

### CRM — reglas cerradas

- Un contacto creado **desde una venta** (`registrar_venta()`) nace en etapa `cerrado` — ya compró. Uno creado **a mano**, sin venta todavía, nace en `nuevo` y avanza por el embudo con seguimiento manual. **Cualquier contacto pasa a `cerrado` en el momento en que se le registra una venta**, sin importar en qué etapa estaba antes — así un lead que veía `propuesta` y finalmente compra queda reflejado como cerrado, sin que haya que cambiarlo a mano.
- El historial de compras de un cliente **nunca se duplica** en el CRM — se lee directo de `ventas` filtrando por `contacto_id`.
- Cuando el CRM se alimenta de ventas, la ficha del cliente debe mostrar su perfil de compra: ticket medio, cada cuántos días compra en promedio, producto más económico y más costoso que se le ha vendido, e inversión total — todo esto ya calculado en `vista_perfil_cliente`, no hay que recalcularlo en el frontend.
- Las interacciones (`crm_interacciones`) son siempre manuales. Una compra no genera una interacción — ya queda registrada como venta.
- Necesita pantalla propia de "Agregar cliente" (captura de un contacto antes de que compre — un lead), además de lo que ya se llena solo desde Ventas. Es una inserción simple en `crm_contactos`, no necesita una función de base de datos aparte como `registrar_venta()`.
- Pantallas: directorio de clientes (buscable, filtrable por etapa), ficha de un cliente (datos + historial de compras + interacciones + cambio de etapa), y agregar cliente manual.

### Inventario — reglas cerradas

- **Caso estándar** (la mayoría de los negocios): agregar un producto es solo nombre, cantidad, precio de compra (costo) y precio de venta. `unidad` existe pero por defecto es "unidad" — no hay que pedirla si el negocio no la necesita.
- **Caso trasvase** (ej. Aseo Total comprando galones de jabón líquido para venderlo en botellas de 250ml): un ítem puede declarar de qué otro ítem sale (`item_origen_id`) y cuántas unidades salen de una unidad del origen (`factor_conversion`). `registrar_trasvase()` descuenta del ítem a granel y agrega al ítem de venta al detal en una sola operación, usando ese factor — nadie hace la conversión a mano cada vez.
- Esa configuración (`item_origen_id` + `factor_conversion`) se define **una sola vez, al dar de alta el producto** — no en cada trasvase. El trasvase del día a día solo pide cuánto se trasvasó del origen; el resto lo calcula la función.
- No construir la pantalla de trasvase antes que la de agregar producto estándar. La mayoría de los negocios nunca la va a usar — es para el caso específico de Aseo Total y similares, se personaliza cuando un cliente real lo necesite.

### Estado de pérdidas y ganancias — reglas cerradas

- Estructura contable real, no una resta simple: Ingresos por ventas − Costo de ventas = Utilidad bruta; + otros ingresos − gastos operacionales = Utilidad neta. Todo calculado en `vista_estado_resultados`, con el costo congelado en cada venta (no el costo actual).
- **Pasivos y deudas por pagar** (tabla `pasivos`) son un concepto contable distinto a la utilidad — un préstamo o una cuenta por pagar no es un gasto operacional. No se restan dentro de `vista_estado_resultados`. Se muestran **al lado** de la utilidad, como su propia sección, para que la persona vea ambas cosas juntas sin mezclar los cálculos.
- No hace falta que la persona entienda la diferencia contable — simplemente ve "Utilidad neta: $X" y "Deudas pendientes: $Y" como dos números separados en la misma pantalla.
- El desglose por producto y categoría (`vista_utilidad_por_producto`, `vista_utilidad_por_categoria`) vive dentro de este módulo, ya construido.

### Descuentos y promociones — reglas cerradas

- Cuatro tipos de campaña: `descuento_porcentaje`, `descuento_fijo`, `2x1`, `lleve_x_gratis`. Para `2x1`, el segundo ítem se agrega en `ventas_items` con `precio_unitario = 0` y `descuento_aplicado` igual a su precio normal. Para `lleve_x_gratis`, el producto regalado (`promociones.item_regalo_id`) se agrega como línea aparte, también con `precio_unitario = 0`.
- Toda campaña tiene `fecha_inicio` y `fecha_fin` — con eso, cualquier gráfica de ventas puede marcar visualmente el período en que hubo una campaña activa, sin necesitar una tabla aparte para eso.
- `vista_efectividad_promociones` ya trae todo lo necesario para la pantalla de desempeño: ventas que usaron el descuento, ticket promedio de esas ventas, unidades con descuento, dinero regalado, y las ventas totales de todo el período de la campaña (para comparar campaña vs. período sin campaña) — no recalcular nada de esto en el frontend.
- Al hacer clic en una campaña se despliega el detalle completo que ya da esa vista — no hace falta una consulta distinta para eso.

### Insights — principio, no especificación todavía

Sin construir aún (Fase 4). Pero ya queda establecido el principio: los insights se calculan sobre los datos reales de ventas, CRM, inventario, P y G y promociones — nunca son un texto genérico ni igual para todas las empresas. Un insight vale la pena si cambia cuando cambian los datos. Cuando lleguemos a esta fase, cada insight debe poder explicarse con una consulta concreta sobre las tablas y vistas que ya existen, no con lógica inventada aparte.

### Migración de datos — reglas cerradas

Para cuando una empresa nueva viene de otra herramienta (Siigo, Alegra, una hoja de Excel a mano) y no quiere perder su historial. No construir esto antes de la Fase 6 (piloto real) — es para el momento de onboarding de un cliente externo, no antes.

- **Basado en plantillas, no en detección automática de columnas.** Le damos al cliente (o resolvemos nosotros durante la implementación) un CSV con columnas fijas por tipo de dato. Es más simple de construir y más seguro con datos financieros reales que intentar adivinar qué significa cada columna de un archivo ajeno.
- **Las ventas históricas nunca descuentan inventario.** Usan `importar_ventas_historicas()`, que desactiva el disparador de descuento mientras corre — esas ventas ya pasaron en la realidad con el sistema anterior del cliente, descontar de nuevo sería duplicar el efecto.
- **El inventario actual se carga aparte**, con `cargar_inventario_inicial()` — es una foto de "cuánto hay hoy", no un historial de movimientos. Los productos deben existir ya en el catálogo (dados de alta con nombre, costo, precio de venta) antes de correr esto.
- **Los clientes importados** (`importar_clientes()`) usan `on conflict do nothing` sobre `(empresa_id, telefono)` — si el archivo se sube dos veces por error, no crea duplicados.
- Cuando se construya la pantalla de importación, siempre debe mostrar una vista previa de lo que se va a importar antes de confirmar — nunca una carga a ciegas.

## Los módulos del producto, y su estado
| Módulo | Estado |
|---|---|
| Informe general de ventas | **especificación cerrada** — ver detalle arriba, listo para construir |
| CRM | **especificación cerrada** — ver detalle arriba, listo para construir |
| Inventario | **especificación cerrada** — ver detalle arriba, listo para construir |
| Estado de pérdidas y ganancias | **especificación cerrada** — ver detalle arriba, listo para construir |
| Proyecciones e insights | por construir — ver principio arriba; capa transversal, no una pantalla aislada |
| Descuentos y promociones | **especificación cerrada** — ver detalle arriba, listo para construir |
| Facturación electrónica | **fuera de alcance por ahora.** Requiere integración con un proveedor tecnológico habilitado por la DIAN. No construir un sistema de facturación desde cero. |

## Orden de construcción
1. Cimientos: login + esquema + Row Level Security funcionando, de punta a punta
2. Ventas + CRM (incluye el buscador de clientes y `registrar_venta()`)
3. Inventario + Estado de pérdidas y ganancias (incluye utilidad por producto y por categoría)
4. Proyecciones + Insights
5. Descuentos y promociones
6. Migración de datos (pantalla de importación) — solo al llegar al primer cliente piloto real, no antes

No adelantes fases sin que yo lo pida. Prefiero un módulo bien hecho que cinco a medias. Dentro de cada fase, primero la lógica y los datos correctos, las gráficas y visualizaciones van al final.

## Planes y precios (para decidir qué módulo mostrarle a cada empresa)
**Todavía no están definidos en firme** — lo de abajo es un punto de partida de una conversación anterior, no una decisión cerrada. No lo trates como definitivo hasta que yo lo confirme explícitamente.

| Plan | Módulos incluidos | Implementación | Mensual |
|---|---|---|---|
| Básico | Ventas + CRM | $1.100.000 COP | $200.000 COP/mes |
| Pro | + Inventario + Estado P y G | $2.100.000 COP | $350.000 COP/mes |
| Full | + Proyecciones e Insights | $3.400.000 COP | $500.000 COP/mes |

Descuentos y promociones va a ser su propio módulo — falta decidir en qué plan entra o si es un add-on aparte.

## Cobros
Por ahora, manuales (transferencia + factura de venta simple). No integrar ninguna pasarela de pagos todavía — eso viene después de validar con los primeros clientes reales.

## Cómo trabajar conmigo
- Sesiones cortas, un objetivo claro cada vez. Mejor "agrega la tabla de contactos con su formulario de creación" que "construye todo el CRM".
- Muéstrame qué vas a cambiar antes de tocar archivos.
- Si algo no está en este archivo y no sabes qué decisión tomar, pregúntame — no asumas.
