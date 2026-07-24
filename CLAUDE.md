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

Las etapas del embudo del CRM (`crm_etapas`) son personalizables por empresa, no fijas — cada una arranca con las mismas 4 de siempre (Nuevo, Contactado, Propuesta, Cerrado) pero puede agregar las que necesite, renombrarlas y reordenarlas desde "Configurar etapas". Esto reemplaza la regla anterior de "4 valores fijos para todos"; se cambió porque hay dos formas muy distintas de usar el CRM: un negocio de venta directa (ej. Aseo Total) donde casi todos los contactos nacen ya `cerrado` por una venta, y un negocio que vive de leads y cotizaciones antes de vender, donde el embudo sí importa y necesita sus propias etapas. Ver la sección "CRM — reglas cerradas" más abajo para el detalle de `es_cierre` y las reglas de inactividad.

**Son dos cosas aparte, no un espectro.** `empresas.crm_modo` decide cuál de las dos es: `'ventas'` (por defecto, para toda empresa existente y nueva) deja el CRM exactamente como siempre — sin la pantalla "Configurar etapas", sin reglas de inactividad, nada nuevo visible. `'leads'` habilita esa capa extra. Se activa a mano en la tabla de empresas de Supabase, igual que `modulos_activos` y `pagina_entrada` — nunca lo decide el cliente, y nunca cambia solo con que la empresa tenga contactos sin venta.

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

- Un contacto creado **desde una venta** (`registrar_venta()`) nace en la etapa marcada como `es_cierre` de esa empresa — ya compró. Uno creado **a mano**, sin venta todavía, nace en la primera etapa del embudo (`orden = 1`) y avanza con seguimiento manual. **Cualquier contacto pasa a la etapa de cierre en el momento en que se le registra una venta**, sin importar en qué etapa estaba antes — así un lead que veía "Propuesta" y finalmente compra queda reflejado como cerrado, sin que haya que cambiarlo a mano.
- Las etapas (`crm_etapas`) son personalizables por empresa — ver más arriba. Cada empresa tiene exactamente una etapa marcada `es_cierre` (se cambia con `marcar_etapa_cierre()`, nunca a mano, para no dejar ninguna o dos a la vez). Toda empresa nueva arranca sola con las 4 de siempre vía un trigger en `empresas` — no hace falta sembrarlas a mano.
- Reglas de inactividad (opcionales, por etapa): si un contacto lleva más de `dias_inactividad` sin ninguna interacción registrada, se mueve solo a `etapa_destino_inactividad_id`. No corre en segundo plano (no hay servidor propio para eso) — se aplica cada vez que alguien abre el CRM (`aplicar_reglas_inactividad_crm()`), así que el movimiento ocurre en la próxima visita a esa pantalla, no exactamente al minuto del vencimiento. Solo se ejecuta para empresas con `crm_modo = 'leads'` — una empresa en modo `'ventas'` nunca la corre, aunque técnicamente podría configurarse.
- "Configurar etapas" y las reglas de inactividad solo son visibles/alcanzables cuando `empresas.crm_modo = 'leads'` — en modo `'ventas'` (el de siempre, y el que traen todas las empresas por defecto) esa pantalla ni siquiera aparece enlazada, y la ruta redirige de vuelta al CRM si alguien la escribe a mano. Son dos experiencias separadas, no un continuo.
- El historial de compras de un cliente **nunca se duplica** en el CRM — se lee directo de `ventas` filtrando por `contacto_id`.
- Cuando el CRM se alimenta de ventas, la ficha del cliente debe mostrar su perfil de compra: ticket medio, cada cuántos días compra en promedio, producto más económico y más costoso que se le ha vendido, e inversión total — todo esto ya calculado en `vista_perfil_cliente`, no hay que recalcularlo en el frontend.
- Las interacciones (`crm_interacciones`) son siempre manuales. Una compra no genera una interacción — ya queda registrada como venta.
- Necesita pantalla propia de "Agregar cliente" (captura de un contacto antes de que compre — un lead), además de lo que ya se llena solo desde Ventas. Es una inserción simple en `crm_contactos`, no necesita una función de base de datos aparte como `registrar_venta()` — un trigger le pone la primera etapa sola si no se indica ninguna.
- Pantallas: directorio de clientes (buscable, filtrable por etapa), ficha de un cliente (datos + historial de compras + interacciones + cambio de etapa), agregar cliente manual, y "Configurar etapas" (agregar, renombrar, reordenar, marcar cuál es de cierre, y las reglas de inactividad).

### Inventario — reglas cerradas

- **Caso estándar** (la mayoría de los negocios): agregar un producto es solo nombre, cantidad, precio de compra (costo) y precio de venta. `unidad` existe pero por defecto es "unidad" — no hay que pedirla si el negocio no la necesita.
- **Caso trasvase** (ej. Aseo Total comprando galones de jabón líquido para venderlo en botellas de 250ml): un ítem puede declarar de qué otro ítem sale (`item_origen_id`) y cuántas unidades salen de una unidad del origen (`factor_conversion`). `registrar_trasvase()` descuenta del ítem a granel y agrega al ítem de venta al detal en una sola operación, usando ese factor — nadie hace la conversión a mano cada vez.
- Esa configuración (`item_origen_id` + `factor_conversion`) se define **una sola vez, al dar de alta el producto** — no en cada trasvase. El trasvase del día a día solo pide cuánto se trasvasó del origen; el resto lo calcula la función.
- No construir la pantalla de trasvase antes que la de agregar producto estándar. La mayoría de los negocios nunca la va a usar — es para el caso específico de Aseo Total y similares, se personaliza cuando un cliente real lo necesite.

### Estado de pérdidas y ganancias — reglas cerradas

- Estructura contable real, no una resta simple: Ingresos por ventas − Costo de ventas = Utilidad bruta; + otros ingresos − gastos operacionales = Utilidad neta. Todo calculado en `vista_estado_resultados`, con el costo congelado en cada venta (no el costo actual).
- **Pasivos y deudas por pagar** (tabla `pasivos`): criterio de caja, no de causación. Crear una deuda no genera ningún gasto por sí sola — ese dinero todavía no ha salido. El gasto real se registra cuando efectivamente se abona o se paga, con la fecha en que ocurrió (la persona la elige, no siempre es "hoy"). Cada abono o pago genera su propio movimiento en `finanzas_movimientos` (categoría `'pago de deuda'`, enlazado a la deuda vía `pasivo_id`) por el monto exacto abonado — así sí impacta `vista_estado_resultados` en el mes correspondiente, sin duplicar: nunca se cuenta la deuda completa de una vez, solo lo que se ha pagado hasta el momento.
- Cada deuda muestra su historial de abonos (fecha + monto de cada uno) — funciona como "cuotas", aunque todavía no hay un plan de cuotas fijo predefinido (número de pagos, monto por cuota). Eso se agrega cuando haya un caso real que lo necesite — cada negocio maneja sus deudas distinto.
- No hace falta que la persona entienda la diferencia contable — simplemente ve "Utilidad neta: $X" y "Deudas pendientes: $Y" como dos números separados en la misma pantalla, sabiendo que un abono si mueve ambos números (baja la deuda, y ese mismo abono ya cuenta como gasto del mes en que se hizo).
- El desglose por producto y categoría (`vista_utilidad_por_producto`, `vista_utilidad_por_categoria`) vive dentro de este módulo, ya construido.

### Descuentos y promociones — reglas cerradas

- Cuatro tipos de campaña: `descuento_porcentaje`, `descuento_fijo`, `2x1`, `lleve_x_gratis`. Para `2x1`, el segundo ítem se agrega en `ventas_items` con `precio_unitario = 0` y `descuento_aplicado` igual a su precio normal. Para `lleve_x_gratis`, el producto regalado (`promociones.item_regalo_id`) se agrega como línea aparte, también con `precio_unitario = 0`.
- Toda campaña tiene `fecha_inicio` y `fecha_fin` — con eso, cualquier gráfica de ventas puede marcar visualmente el período en que hubo una campaña activa, sin necesitar una tabla aparte para eso.
- `vista_efectividad_promociones` ya trae todo lo necesario para la pantalla de desempeño: ventas que usaron el descuento, ticket promedio de esas ventas, unidades con descuento, dinero regalado, y las ventas totales de todo el período de la campaña (para comparar campaña vs. período sin campaña) — no recalcular nada de esto en el frontend.
- Al hacer clic en una campaña se despliega el detalle completo que ya da esa vista — no hace falta una consulta distinta para eso.

### Insights (Panel de control) — construido

Los insights se calculan sobre los datos reales de ventas, CRM, inventario, P y G y promociones — nunca son un texto genérico ni igual para todas las empresas. Un insight vale la pena si cambia cuando cambian los datos; cada uno se explica con una consulta concreta sobre las tablas y vistas que ya existen, no con lógica inventada aparte.

- **Respeta el horario real del negocio**, para no mostrarle datos que no le aplican: `empresas.hora_apertura` / `hora_cierre` recortan la gráfica "Ventas por hora del día" a solo las horas en que de verdad atiende (si abre a las 10, no le muestra la hora 9 en $0); `empresas.atiende_festivos` (default `true`) oculta por completo la comparación de festivos vs. días normales cuando el negocio nunca abre festivos — comparar contra $0 todos los festivos no es información, es ruido. Las tres columnas son opcionales y se activan a mano, empresa por empresa (mismo criterio que `crm_modo`) — sin configurarlas, el comportamiento es el de siempre.

### Migración de datos — reglas cerradas

Para cuando una empresa nueva viene de otra herramienta (Siigo, Alegra, una hoja de Excel a mano) y no quiere perder su historial. No construir esto antes de la Fase 6 (piloto real) — es para el momento de onboarding de un cliente externo, no antes.

- **Basado en plantillas, no en detección automática de columnas.** Le damos al cliente (o resolvemos nosotros durante la implementación) un CSV con columnas fijas por tipo de dato. Es más simple de construir y más seguro con datos financieros reales que intentar adivinar qué significa cada columna de un archivo ajeno.
- **Las ventas históricas nunca descuentan inventario.** Usan `importar_ventas_historicas()`, que desactiva el disparador de descuento mientras corre — esas ventas ya pasaron en la realidad con el sistema anterior del cliente, descontar de nuevo sería duplicar el efecto.
- **El inventario actual se carga aparte**, con `cargar_inventario_inicial()` — es una foto de "cuánto hay hoy", no un historial de movimientos. Los productos deben existir ya en el catálogo (dados de alta con nombre, costo, precio de venta) antes de correr esto.
- **Los clientes importados** (`importar_clientes()`) usan `on conflict do nothing` sobre `(empresa_id, telefono)` — si el archivo se sube dos veces por error, no crea duplicados.
- Cuando se construya la pantalla de importación, siempre debe mostrar una vista previa de lo que se va a importar antes de confirmar — nunca una carga a ciegas.

### Apartados — desarrollo a la medida de Manantial, no un módulo del producto

Manantial (tienda de ropa) vende con "apartados": el cliente abona una parte, la prenda se separa del inventario de inmediato, y tiene 30 días para completar el pago. Si no completa, el abono queda como ingreso (el cliente lo pierde) y la prenda vuelve a estar disponible. Esto es desarrollo específico para un cliente (ver "Planes y precios" — se cobra aparte de la suscripción), no un módulo general: se activa a mano con `empresas.permite_apartados`, igual criterio que `crm_modo` — ninguna otra empresa ve el check "Es un apartado" en Agregar venta ni la pestaña "Apartados". Vive integrado dentro de Ventas (pestaña en `VentasTabs`, rutas `/ventas/apartados`), no como un módulo propio en el menú lateral — no tiene sentido como concepto aparte, es una forma distinta de registrar una venta.

- **Las cifras de venta solo cuentan la plata que de verdad entró**, nunca el precio completo por adelantado — mismo criterio de caja que ya usan los pasivos. Un apartado no le genera ninguna fila a `ventas` hasta que se resuelve (reclamado o vencido); mientras está activo, vive aparte en `apartados`/`apartados_items`/`apartados_abonos` y no aparece en ningún reporte de ventas ni en el P y G.
- `permite_apartados` **no depende de tener el módulo de Inventario activo** — son cosas aparte. Manantial no tiene Inventario (no lo quiere), así que un apartado se arma exactamente igual que una venta normal sin catálogo: nombre y costo del producto escritos a mano (`apartados_items.nombre_libre` + `costo_unitario`), sin tocar ningún stock. `apartados_items.item_id` queda ahí por si algún día una empresa con Inventario Y apartados lo necesita (ahí sí se descuenta del inventario disponible, FIFO, igual que una venta) — pero hoy nadie lo usa. Nunca actives `inventario` en `modulos_activos` de una empresa solo para que le aparezca el check de apartado — son interruptores independientes.
- Cada abono se registra con `agregar_abono_apartado()`. Si con ese abono se completa el precio total, el apartado se resuelve solo — no hace falta un botón aparte para "entregar" la prenda: se convierte en una venta real (`reclamar_apartado()`) y el contacto del CRM pasa a la etapa de cierre, igual que cualquier otra venta.
- El vencimiento (30 días corridos desde que se apartó, no mes calendario) tampoco corre en segundo plano — se revisa cada vez que alguien abre la pantalla de Apartados (`aplicar_vencimiento_apartados()`), mismo patrón que las reglas de inactividad del CRM.
- Si vence sin completar: lo abonado se registra como una venta por ese monto (fecha = la del vencimiento), la prenda vuelve al inventario disponible, y el contacto también pasa a etapa de cierre (si pagó algo, sigue siendo un cliente real).

## Los módulos del producto, y su estado
| Módulo | Estado |
|---|---|
| Informe general de ventas | **especificación cerrada** — ver detalle arriba, listo para construir |
| CRM | **especificación cerrada** — ver detalle arriba, listo para construir |
| Inventario | **especificación cerrada** — ver detalle arriba, listo para construir |
| Estado de pérdidas y ganancias | **especificación cerrada** — ver detalle arriba, listo para construir |
| Proyecciones e insights | **construido** — Panel de control, ver detalle arriba |
| Descuentos y promociones | **especificación cerrada** — ver detalle arriba, listo para construir |
| Facturación electrónica | **fuera de alcance por ahora, en revisión.** Requiere integración con un proveedor tecnológico habilitado por la DIAN — no se va a construir un sistema de facturación propio desde cero. Varios clientes reales lo han pedido (ya tienen esto resuelto con Siigo), así que vale la pena investigar proveedores e integración antes de descartarlo del todo — pero es una decisión de negocio (con quién integrarse, cómo se cobra) antes que una tarea de código. No escribir código de facturación sin definir ese rumbo primero. |
| Nómina | **por construir, alcance completo** — no un simple gasto recurrente más: empleados, salario, deducciones de ley (salud, pensión, ARL, prestaciones sociales) y desprendible de pago. Módulo grande, con reglas legales colombianas reales — necesita su propia sesión dedicada de diseño antes de escribir código, no se ha empezado. |

## Orden de construcción
1. Cimientos: login + esquema + Row Level Security funcionando, de punta a punta
2. Ventas + CRM (incluye el buscador de clientes y `registrar_venta()`)
3. Inventario + Estado de pérdidas y ganancias (incluye utilidad por producto y por categoría)
4. Proyecciones + Insights
5. Descuentos y promociones
6. Migración de datos (pantalla de importación) — solo al llegar al primer cliente piloto real, no antes

No adelantes fases sin que yo lo pida. Prefiero un módulo bien hecho que cinco a medias. Dentro de cada fase, primero la lógica y los datos correctos, las gráficas y visualizaciones van al final.

## Planes y precios (para decidir qué módulo mostrarle a cada empresa)
**La estructura ya está decidida: suscripción mensual pura, sin ningún cobro inicial de implementación.** Los montos exactos de cada plan todavía no están en firme — lo de abajo es un punto de partida, no una decisión cerrada. No lo trates como definitivo hasta que yo lo confirme explícitamente.

| Plan | Módulos incluidos | Mensual |
|---|---|---|
| Básico | Ventas + CRM | $200.000 COP/mes |
| Pro | + Inventario + Estado P y G | $350.000 COP/mes |
| Full | + Proyecciones e Insights | $500.000 COP/mes |

Descuentos y promociones va a ser su propio módulo — falta decidir en qué plan entra o si es un add-on aparte.

**Desarrollo específico para un cliente se cobra aparte, fuera de la suscripción.** Si una empresa cabe en la plataforma tal como está — usando `atributos` (JSON) para lo que varía por su tipo de negocio, sin tocar el esquema ni el código — no hay ningún cobro adicional, la suscripción mensual ya lo cubre. Pero si un cliente de verdad necesita algo que requiere código nuevo (una tabla propia, una integración, una función de negocio a la medida — el mismo criterio que ya usa este archivo para decidir cuándo algo amerita tabla propia en vez de `atributos`), ese trabajo se cotiza y se cobra aparte, como un proyecto puntual. Todavía falta definir cómo se cotiza ese trabajo a la medida (por horas, por alcance fijo, etc.) — no asumas una tarifa ni un formato hasta que yo lo confirme.

## Cobros
Por ahora, manuales (transferencia + factura de venta simple). No integrar ninguna pasarela de pagos todavía — eso viene después de validar con los primeros clientes reales.

## Cuenta y sesión
- **Recuperar contraseña**: flujo estándar de Supabase Auth (correo con enlace de un solo uso → `/auth/confirm` valida el token → `/restablecer-password` define la nueva). Todos los mensajes de error de autenticación se traducen al español en `src/lib/auth-errores.ts` — nunca se le muestra a nadie el texto en inglés que devuelve Supabase.
- **Aviso de actualizaciones**: pop-up que se muestra una sola vez, en el siguiente inicio de sesión después de agregar una fila a la tabla `actualizaciones` (título + contenido). Cada perfil recuerda cuál fue la última que ya cerró (`perfiles.ultima_actualizacion_vista_id`), así que no se repite. No hay pantalla propia para crearlas todavía — se agregan a mano desde la tabla de Supabase, igual que `festivos`. Hoy la tabla está vacía a propósito, así que no le sale a nadie.

## Cómo trabajar conmigo
- Sesiones cortas, un objetivo claro cada vez. Mejor "agrega la tabla de contactos con su formulario de creación" que "construye todo el CRM".
- Muéstrame qué vas a cambiar antes de tocar archivos.
- Si algo no está en este archivo y no sabes qué decisión tomar, pregúntame — no asumas.
