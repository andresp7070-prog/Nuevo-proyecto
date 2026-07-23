-- ============================================================
-- Esquema inicial — plataforma de diagnóstico + módulos SaaS
-- Para pegar en el SQL Editor de Supabase (Fase 1 de la hoja de ruta)
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- ------------------------------------------------------------
-- 1. PLANES — catálogo fijo, no pertenece a ninguna empresa
-- ------------------------------------------------------------
create table planes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                       -- 'Basico' | 'Pro' | 'Full'
  precio_implementacion numeric(12,2) not null,
  precio_mensual numeric(12,2) not null,
  modulos_incluidos text[] not null,          -- ej. {'ventas','crm'}
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. EMPRESAS — cada empresa cliente es un tenant
-- ------------------------------------------------------------
create table empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  -- Lista fija para que quede consistente y se pueda agrupar/filtrar bien
  -- (antes era texto libre). 'otro' es el escape para un negocio que no
  -- encaja en ninguna — nunca debe bloquear un onboarding.
  tipo_negocio text
    check (tipo_negocio is null or tipo_negocio in (
      'aseo','ropa','restaurante','cafeteria','belleza','ferreteria','taller','tienda','papeleria','otro'
    )),
  plan_id uuid references planes(id),
  modulos_activos text[] default '{}',        -- ajuste manual sobre el plan
  pagina_entrada text not null default 'ventas'
    check (pagina_entrada in ('ventas','crm','inventario','pyg','insights')),  -- en qué módulo aterriza al iniciar sesión; lo decide el diagnóstico, no el cliente
  -- 'ventas': el CRM se comporta como siempre — embudo fijo de 4 etapas, sin
  -- pantalla de configuración, contactos que nacen casi todos ya cerrados
  -- porque vienen de una venta (ej. Aseo Total, Café Mensajero). 'leads':
  -- habilita "Configurar etapas" y las reglas de inactividad, para un
  -- negocio que vive de cotizar/negociar antes de vender. Se activa a mano,
  -- igual que modulos_activos y pagina_entrada — nunca lo decide el cliente.
  crm_modo text not null default 'ventas' check (crm_modo in ('ventas','leads')),
  -- Desarrollo a la medida de un solo cliente (Manantial, tienda de ropa):
  -- habilita el check "Es un apartado" en Agregar venta y la pantalla
  -- "Apartados". Se activa a mano, nunca lo decide el cliente — el mismo
  -- criterio que crm_modo, pero esto ni siquiera es un módulo de precios,
  -- es una función hecha a la medida (ver la sección de Planes y precios).
  permite_apartados boolean not null default false,
  fecha_diagnostico date,
  -- Catálogo fijo de métodos de pago (igual para toda la plataforma); cada
  -- empresa activa cuáles acepta. Editable por ahora en la tabla de Supabase.
  metodos_pago_disponibles text[] not null default '{efectivo,tarjeta,transferencia}'
    check (metodos_pago_disponibles <@ array['efectivo','tarjeta','transferencia','nequi','daviplata','otro']::text[]),
  logo_path text,  -- ruta dentro del bucket 'empresas-logos' de Supabase Storage; opcional
  -- Cuánto paga esta empresa al mes por la suscripción — se llena a mano por
  -- ahora (los precios de los planes no están en firme, y no hay pasarela de
  -- pago conectada todavía). El día que haya cobro automático, esto se
  -- reemplaza por la suma de los cobros reales, no por este campo.
  monto_mensual numeric(12,2),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 3. PUNTOS DE VENTA — para empresas con más de un punto físico (varias
-- sedes, un carrito móvil, un stand de eventos). La mayoría de las empresas
-- nunca usan esta tabla: es opcional, no un paso obligatorio del onboarding.
-- El CRM (crm_contactos) queda a nivel de EMPRESA, no de punto — así un
-- cliente que compra en un punto y luego en otro sigue siendo la misma
-- persona con un solo historial. Ventas e inventario sí quedan por punto,
-- porque cada uno vende y tiene stock por separado.
-- ------------------------------------------------------------
create table puntos_venta (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz default now(),
  unique (empresa_id, nombre)
);

-- ------------------------------------------------------------
-- Actualizaciones de la plataforma — anuncios cortos que se muestran una
-- sola vez, la siguiente vez que la persona inicia sesión (ver
-- perfiles.ultima_actualizacion_vista_id más abajo). No hay pantalla propia
-- para crearlas todavía: se agregan a mano desde la tabla de Supabase,
-- igual que festivos. Solo la más reciente se le muestra a cada quien.
-- ------------------------------------------------------------
create table actualizaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  contenido text not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 4. PERFILES — une el login de Supabase (auth.users) con una empresa y un rol
-- ------------------------------------------------------------
create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid references empresas(id),
  -- 'admin' es un rol de plataforma reservado para futuro personal de
  -- soporte (sin acceso al reporte global). 'super_admin' es exclusivamente
  -- la cuenta dueña de la plataforma — ver requerirAdmin() en el código,
  -- que además verifica el id exacto del usuario, no solo este rol.
  rol text not null default 'cliente' check (rol in ('cliente','admin','super_admin')),
  -- Rol DENTRO de la empresa (solo aplica cuando rol = 'cliente'; varias
  -- personas de la misma empresa pueden tener perfiles distintos, cada una
  -- con su propio login). 'administrador' ve todo lo que la empresa tiene
  -- activo; 'vendedor' solo ve el módulo de Ventas, sin importar qué otros
  -- módulos tenga la empresa.
  rol_empresa text not null default 'administrador' check (rol_empresa in ('administrador','vendedor')),
  -- Solo aplica si la empresa usa puntos_venta. null = ve toda la empresa
  -- (cuenta general / administrador); con un punto asignado, ve solo ese
  -- punto (ej. el barista de un punto específico).
  punto_venta_id uuid references puntos_venta(id),
  nombre text,
  debe_cambiar_password boolean not null default true,  -- true al crear la cuenta; se apaga solo cuando cambia su contraseña por primera vez
  -- Cuál fue la última actualización (de la tabla actualizaciones) que esta
  -- persona ya cerró en el pop-up. null = todavía no ha visto ninguna.
  ultima_actualizacion_vista_id uuid references actualizaciones(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 4. DIAGNOSTICOS
-- ------------------------------------------------------------
create table diagnosticos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  respuestas jsonb not null,                  -- el cuestionario completo
  modulos_recomendados text[],
  fecha date default current_date
);

-- ------------------------------------------------------------
-- 5. SUSCRIPCIONES
-- ------------------------------------------------------------
create table suscripciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  plan_id uuid references planes(id) not null,
  estado text not null default 'activa' check (estado in ('activa','pausada','cancelada')),
  fecha_inicio date default current_date,
  proximo_cobro date
);

-- ------------------------------------------------------------
-- 6. VENTAS
-- ------------------------------------------------------------
create table ventas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  -- Solo aplica si la empresa usa puntos_venta; null para el resto (la
  -- inmensa mayoría de las empresas).
  punto_venta_id uuid references puntos_venta(id),
  fecha timestamptz not null default now(),  -- fecha Y hora; siempre sugiere el momento actual, pero es editable
  monto numeric(12,2) not null,
  cliente_nombre text,
  producto text,
  metodo_pago text
    check (metodo_pago is null or metodo_pago in ('efectivo','tarjeta','transferencia','nequi','daviplata','otro')),
  atributos jsonb default '{}',  -- lo que varía por tipo de negocio: canal de venta, tipo de servicio, etc.
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 7. CRM
-- Las etapas del embudo (crm_etapas) son personalizables por empresa: un
-- negocio que vive de ventas directas (ej. Aseo Total) apenas las toca —
-- casi todos sus contactos caen directo en la etapa de cierre porque
-- nacen de una venta. Un negocio que vive de leads y cotizaciones antes de
-- vender (ej. una empresa de servicios) necesita su propio embudo, con las
-- etapas que le hagan sentido a su proceso, y reglas de inactividad que
-- muevan solo a un lead que lleva mucho tiempo sin seguimiento.
-- ------------------------------------------------------------
create table crm_etapas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  nombre text not null,
  orden int not null,
  -- La etapa a la que cae un contacto automáticamente en cuanto se le
  -- registra una venta — exactamente una por empresa (ver el índice único
  -- más abajo). Se marca con marcar_etapa_cierre(), nunca a mano con un
  -- update directo, para garantizar que nunca haya cero o dos etapas de cierre.
  es_cierre boolean not null default false,
  -- Regla de inactividad, opcional: si un contacto lleva más de
  -- "dias_inactividad" sin ninguna interacción registrada mientras está en
  -- esta etapa, se mueve solo a "etapa_destino_inactividad_id". Los dos
  -- campos van juntos — o los dos tienen valor, o ninguno.
  dias_inactividad int,
  etapa_destino_inactividad_id uuid references crm_etapas(id),
  created_at timestamptz default now(),
  unique (empresa_id, nombre),
  unique (empresa_id, orden)
);

-- A lo sumo una etapa de cierre por empresa.
create unique index crm_etapas_una_cierre_por_empresa on crm_etapas (empresa_id) where es_cierre;

-- Toda empresa nueva arranca con las mismas 4 etapas de siempre — desde ahí
-- cada una las agrega, renombra o reordena a su gusto. Así nadie tiene que
-- acordarse de sembrarlas a mano cada vez que se crea una empresa cliente
-- desde el panel de Supabase.
create or replace function crear_etapas_por_defecto()
returns trigger language plpgsql as $$
begin
  insert into crm_etapas (empresa_id, nombre, orden, es_cierre) values
    (new.id, 'Nuevo', 1, false),
    (new.id, 'Contactado', 2, false),
    (new.id, 'Propuesta', 3, false),
    (new.id, 'Cerrado', 4, true);
  return new;
end;
$$;

create trigger trigger_crear_etapas_por_defecto
after insert on empresas
for each row execute function crear_etapas_por_defecto();

create table crm_contactos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  nombre text not null,
  telefono text,
  email text,
  etapa_id uuid references crm_etapas(id),
  atributos jsonb default '{}',  -- lo que varía por tipo de negocio: modelo de vehículo, preferencias, alergias, etc.
  created_at timestamptz default now()
);

-- Si se crea un contacto sin indicar en qué etapa arranca (ej. desde
-- "Agregar cliente" a mano), cae en la primera etapa del embudo de esa
-- empresa — no hace falta que cada punto de inserción lo calcule.
create or replace function etapa_inicial_crm(p_empresa_id uuid)
returns uuid language sql stable as $$
  select id from crm_etapas where empresa_id = p_empresa_id order by orden asc limit 1;
$$;

-- La etapa de cierre de una empresa — a dónde cae un contacto en cuanto compra.
create or replace function etapa_cierre_crm(p_empresa_id uuid)
returns uuid language sql stable as $$
  select id from crm_etapas where empresa_id = p_empresa_id and es_cierre limit 1;
$$;

create or replace function fijar_etapa_inicial_crm()
returns trigger language plpgsql as $$
begin
  if new.etapa_id is null then
    new.etapa_id := etapa_inicial_crm(new.empresa_id);
  end if;
  return new;
end;
$$;

create trigger trigger_etapa_inicial_crm
before insert on crm_contactos
for each row execute function fijar_etapa_inicial_crm();

-- Cambia cuál es la etapa de cierre de una empresa, quitándosela a la
-- anterior primero — así nunca queda ninguna, ni dos a la vez (lo que
-- rompería el índice único de arriba).
create or replace function marcar_etapa_cierre(p_etapa_id uuid)
returns void
language plpgsql
as $$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id from crm_etapas where id = p_etapa_id;
  if v_empresa_id is null then
    raise exception 'Etapa no encontrada';
  end if;
  update crm_etapas set es_cierre = false where empresa_id = v_empresa_id and es_cierre;
  update crm_etapas set es_cierre = true where id = p_etapa_id;
end;
$$;

-- Mueve una etapa un lugar hacia arriba o hacia abajo en el orden del
-- embudo, intercambiando su "orden" con el de la etapa vecina. Pasa por un
-- valor temporal (-1) porque (empresa_id, orden) es único: si se intentara
-- swapear con dos updates directos, el primero dejaría dos etapas con el
-- mismo orden a mitad de camino y la base de datos lo rechazaría.
create or replace function mover_etapa_crm(p_etapa_id uuid, p_direccion text)
returns void
language plpgsql
as $$
declare
  v_empresa_id uuid;
  v_orden_actual int;
  v_vecino_id uuid;
  v_vecino_orden int;
begin
  select empresa_id, orden into v_empresa_id, v_orden_actual from crm_etapas where id = p_etapa_id;
  if v_empresa_id is null then
    raise exception 'Etapa no encontrada';
  end if;

  if p_direccion = 'arriba' then
    select id, orden into v_vecino_id, v_vecino_orden
    from crm_etapas where empresa_id = v_empresa_id and orden < v_orden_actual
    order by orden desc limit 1;
  else
    select id, orden into v_vecino_id, v_vecino_orden
    from crm_etapas where empresa_id = v_empresa_id and orden > v_orden_actual
    order by orden asc limit 1;
  end if;

  if v_vecino_id is null then
    return; -- ya está en el extremo, no hay nada que mover
  end if;

  update crm_etapas set orden = -1 where id = p_etapa_id;
  update crm_etapas set orden = v_orden_actual where id = v_vecino_id;
  update crm_etapas set orden = v_vecino_orden where id = p_etapa_id;
end;
$$;

create table crm_interacciones (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid references crm_contactos(id) not null,
  fecha date default current_date,
  tipo text check (tipo in ('llamada','email','reunion','otro')),
  nota text
);

-- Aplica las reglas de inactividad de una empresa: por cada etapa que tenga
-- una configurada, mueve a "etapa_destino_inactividad_id" a cualquier
-- contacto que lleve más de "dias_inactividad" sin ninguna interacción
-- registrada (o, si nunca ha tenido ninguna, desde que se creó el contacto).
-- No corre como un proceso aparte en segundo plano (no hay servidor propio
-- para eso) — la aplicación la llama cada vez que alguien abre el CRM, así
-- que el movimiento ocurre la próxima vez que alguien entra a esa pantalla,
-- no exactamente al minuto del vencimiento.
create or replace function aplicar_reglas_inactividad_crm(p_empresa_id uuid)
returns void
language plpgsql
as $$
declare
  v_etapa record;
begin
  for v_etapa in
    select id, dias_inactividad, etapa_destino_inactividad_id
    from crm_etapas
    where empresa_id = p_empresa_id
      and dias_inactividad is not null
      and etapa_destino_inactividad_id is not null
  loop
    update crm_contactos c
    set etapa_id = v_etapa.etapa_destino_inactividad_id
    where c.empresa_id = p_empresa_id
      and c.etapa_id = v_etapa.id
      and coalesce(
        (select max(i.fecha) from crm_interacciones i where i.contacto_id = c.id),
        c.created_at::date
      ) <= current_date - v_etapa.dias_inactividad;
  end loop;
end;
$$;

-- Una venta puede quedar asociada a un contacto del CRM (opcional)
alter table ventas add column contacto_id uuid references crm_contactos(id);

-- ------------------------------------------------------------
-- 8. INVENTARIO
-- ------------------------------------------------------------
-- Proveedores: a quién le compra cada producto la empresa, y en qué condición
-- le paga (de contado o a cuotas fijas). Es una entidad propia (no un campo en
-- atributos) porque tiene su propia identidad y su propia forma de pago, no un
-- dato adicional sobre un producto que ya existe.
create table proveedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  nombre text not null,
  telefono text,
  frecuencia_pago text not null default 'contado'
    check (frecuencia_pago in ('contado', 'diario', 'semanal', 'mensual', 'personalizado')),
  -- Solo aplica cuando frecuencia_pago = 'semanal': qué día de la semana cae el pago
  -- (ej. compras un viernes, pero el pago cae cada lunes).
  dia_semana_pago text
    check (dia_semana_pago is null or dia_semana_pago in
      ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo')),
  -- Solo aplica cuando frecuencia_pago = 'personalizado': cada cuántos días se paga.
  dias_personalizado int,
  created_at timestamptz default now()
);

create table inventario_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  -- Solo aplica si la empresa usa puntos_venta; null para el resto. Cada
  -- punto tiene su propio stock — el mismo producto en dos puntos son dos
  -- filas distintas, no una compartida.
  punto_venta_id uuid references puntos_venta(id),
  nombre text not null,
  sku text,
  categoria text,
  tipo text not null default 'producto' check (tipo in ('producto','servicio')),  -- 'servicio' no descuenta inventario (ej. mano de obra)
  unidad text not null default 'unidad',  -- 'unidad', 'galon', 'litro', 'ml', 'kg', 'caja', etc. — solo para mostrar, no hace conversiones sola
  cantidad numeric(12,2) default 0,
  costo numeric(12,2),
  precio_venta numeric(12,2),
  foto_path text,  -- ruta dentro del bucket 'inventario-fotos' de Supabase Storage; opcional
  proveedor_id uuid references proveedores(id),  -- a quién se le compra este producto; opcional
  es_insumo boolean not null default false,  -- material de receta puro: no se vende individualmente, no tiene precio_venta
  atributos jsonb default '{}',  -- lo que varía por tipo de negocio: fecha de vencimiento, modelo compatible, etc.
  created_at timestamptz default now(),
  unique (empresa_id, sku)
);

create table inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references inventario_items(id) not null,
  tipo text not null check (tipo in ('entrada','salida')),
  motivo text check (motivo in ('compra','ajuste','devolucion','trasvase','dotacion')),  -- 'compra' genera un gasto automático (solo entradas); 'dotacion' también genera un gasto automático (solo salidas)
  cantidad numeric(12,2) not null,
  fecha date default current_date,
  nota text
);

-- Lotes de inventario: cada entrada de stock (compra, producción de un
-- compuesto, carga inicial) guarda su propio costo y fecha por separado —
-- así se puede consumir primero lo más antiguo (FIFO) y el costo que se
-- congela en cada venta refleja lo que de verdad costó esa unidad, no el
-- último precio de compra, aunque el costo haya cambiado entre compras.
create table inventario_lotes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references inventario_items(id) not null,
  cantidad_disponible numeric(12,2) not null,
  costo_unitario numeric(12,2) not null,
  fecha timestamptz not null default now()
);

-- Consume p_cantidad unidades de los lotes de un producto, del más antiguo al
-- más nuevo (FIFO), y devuelve el costo unitario promedio ponderado de lo
-- consumido. Si no hay suficiente en lotes (nunca se cargó uno, o quedó
-- desfasado), el resto se completa al costo actual del producto, para no
-- dejar la operación a medias.
create or replace function consumir_lotes_fifo(p_item_id uuid, p_cantidad numeric)
returns numeric
language plpgsql
as $$
declare
  v_lote record;
  v_restante numeric := p_cantidad;
  v_tomado numeric;
  v_costo_total numeric := 0;
  v_costo_actual numeric;
begin
  for v_lote in
    select id, cantidad_disponible, costo_unitario
    from inventario_lotes
    where item_id = p_item_id and cantidad_disponible > 0
    order by fecha asc
    for update
  loop
    exit when v_restante <= 0;
    v_tomado := least(v_restante, v_lote.cantidad_disponible);
    update inventario_lotes
    set cantidad_disponible = cantidad_disponible - v_tomado
    where id = v_lote.id;
    v_costo_total := v_costo_total + (v_tomado * v_lote.costo_unitario);
    v_restante := v_restante - v_tomado;
  end loop;

  if v_restante > 0 then
    select costo into v_costo_actual from inventario_items where id = p_item_id;
    v_costo_total := v_costo_total + (v_restante * coalesce(v_costo_actual, 0));
  end if;

  if p_cantidad = 0 then
    return coalesce((select costo from inventario_items where id = p_item_id), 0);
  end if;

  return v_costo_total / p_cantidad;
end;
$$;

-- Detalle de cada venta: qué producto del inventario se vendió y cuánto.
-- item_id queda vacío si el negocio no maneja inventario físico (ej. un servicio de peluquería).
create table ventas_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid references ventas(id) not null,
  item_id uuid references inventario_items(id),
  -- Nombre libre de lo vendido, para una empresa sin el módulo de Inventario
  -- activo (no tiene catálogo): item_id queda null y esto guarda qué se
  -- vendió, escrito a mano. Si item_id sí está, el nombre sale del catálogo
  -- y esto queda null — nunca se necesitan los dos a la vez.
  nombre_libre text,
  cantidad numeric(12,2) not null default 1,
  precio_unitario numeric(12,2) not null,
  costo_unitario numeric(12,2),   -- costo del ítem congelado al momento de la venta, para que la utilidad histórica no cambie si el costo sube después
  promocion_id uuid,              -- referencia a promociones, se enlaza más abajo
  descuento_aplicado numeric(12,2) default 0
);

-- Esto es la conexion automatica ventas -> inventario:
-- cada vez que se registra un item vendido, se congela su costo actual (para reportes de
-- utilidad futuros) y, si es un producto físico, se genera el movimiento de salida y se
-- resta la cantidad disponible. Nadie tiene que ajustar el inventario a mano.
-- Un producto compuesto (con receta en inventario_receta) también tiene su propia cantidad
-- en stock, igual que cualquier otro: sus insumos no se descuentan aquí al venderlo, sino
-- antes, cuando se ajusta hacia arriba su cantidad para reflejar un lote ya producido
-- (ver ajustar_inventario más abajo) — vender un producto compuesto solo descuenta su
-- propio stock, exactamente como un producto sin receta.
create or replace function descontar_inventario()
returns trigger language plpgsql as $$
declare
  v_tipo text;
  v_costo numeric(12,2);
  v_stock numeric(12,2);
  v_nombre text;
  v_es_insumo boolean;
begin
  -- Una venta histórica importada (importar_ventas_historicas) no debe volver
  -- a descontar inventario ni recalcular el costo — eso ya pasó de verdad con
  -- el sistema anterior del cliente, y el costo ya viene puesto a mano.
  -- Un apartado reclamado (reclamar_apartado) tampoco: la prenda ya se
  -- descontó cuando se apartó, no cuando se terminó de pagar.
  if current_setting('app.importando_historico', true) = 'true'
     or current_setting('app.apartado_ya_descontado', true) = 'true' then
    return new;
  end if;

  if new.item_id is not null then
    select tipo, costo, cantidad, nombre, es_insumo
    into v_tipo, v_costo, v_stock, v_nombre, v_es_insumo
    from inventario_items where id = new.item_id;

    if v_es_insumo then
      raise exception '"%" es material de receta y no se vende individualmente.', v_nombre;
    end if;

    if v_tipo = 'producto' then
      -- No se puede vender más de lo que hay — obliga a mantener el inventario
      -- al día en vez de dejar que la cantidad quede en negativo.
      if v_stock < new.cantidad then
        raise exception 'No hay suficiente stock de "%": quedan % y se intentó vender %. Agrega inventario antes de vender.',
          v_nombre, v_stock, new.cantidad;
      end if;

      -- El costo congelado en la venta sale de los lotes consumidos (FIFO),
      -- no del costo actual del producto — así el margen de esa venta no se
      -- distorsiona si el costo cambió después de comprar lo que se vendió.
      new.costo_unitario := consumir_lotes_fifo(new.item_id, new.cantidad);

      insert into inventario_movimientos (item_id, tipo, cantidad, nota)
      values (new.item_id, 'salida', new.cantidad, 'Descuento automático por venta');

      update inventario_items
      set cantidad = cantidad - new.cantidad
      where id = new.item_id;
    else
      new.costo_unitario := v_costo;
    end if;
  end if;
  return new;
end;
$$;

create trigger trigger_descontar_inventario
before insert on ventas_items
for each row execute function descontar_inventario();

-- Receta: qué insumos (y cuánto de cada uno) necesita un producto para
-- producirse — ej. "Jabón envasado 500ml" necesita 0.5 litros de "Jabón a
-- granel" + 1 unidad de "Envase vacío 500ml". Cada insumo es un producto
-- independiente del inventario con su propia unidad (gramos, mililitros,
-- metros, unidad, etc.); no hay conversión entre unidades — cada fila se
-- descuenta en la unidad propia de ese insumo. Se configura una sola vez,
-- no cada vez que se produce.
create table inventario_receta (
  id uuid primary key default gen_random_uuid(),
  item_resultante_id uuid references inventario_items(id) not null,
  item_insumo_id uuid references inventario_items(id) not null,
  cantidad_insumo numeric(12,4) not null,  -- cuánto se consume del insumo por CADA unidad producida del resultado
  created_at timestamptz default now(),
  unique (item_resultante_id, item_insumo_id)
);

-- Reabastecer un producto que ya existe: suma cantidad al stock actual
-- (nunca lo reemplaza) y actualiza costo, precio de venta y categoría a
-- los valores más recientes. Se usa desde "Agregar producto" cuando la
-- persona busca el nombre y encuentra que ya existe, en vez de crear un
-- duplicado. Es una sola operación atómica para evitar perder cantidad
-- si dos personas reabastecen el mismo producto casi al mismo tiempo.
create or replace function reabastecer_producto(
  p_item_id uuid,
  p_cantidad_agregada numeric,
  p_costo numeric,
  p_precio_venta numeric,
  p_categoria text,
  p_proveedor_id uuid default null
)
returns void
language plpgsql
as $$
begin
  update inventario_items
  set cantidad = cantidad + p_cantidad_agregada,
      costo = p_costo,
      precio_venta = p_precio_venta,
      categoria = p_categoria,
      proveedor_id = p_proveedor_id
  where id = p_item_id;

  -- Cada compra es su propio lote, con su propio costo — por si el próximo
  -- mes cambia el precio, para poder venderlos en el orden en que entraron.
  if p_cantidad_agregada > 0 then
    insert into inventario_lotes (item_id, cantidad_disponible, costo_unitario)
    values (p_item_id, p_cantidad_agregada, p_costo);
  end if;
end;
$$;

-- Corrige la cantidad en stock a lo que de verdad hay — pérdida, daño, o un
-- conteo físico que no coincide con el sistema. A diferencia de reabastecer
-- (que siempre suma), esto fija el número exacto y deja un movimiento en
-- inventario_movimientos con motivo 'ajuste' como registro de por qué cambió.
create or replace function ajustar_inventario(
  p_item_id uuid,
  p_cantidad_real numeric,
  p_nota text default null
)
returns void
language plpgsql
as $$
declare
  v_cantidad_actual numeric(12,2);
  v_costo_actual numeric(12,2);
  v_diferencia numeric(12,2);
  v_receta record;
  v_costo_producido numeric(12,2);
  v_costo_insumo numeric(12,2);
begin
  select cantidad, costo into v_cantidad_actual, v_costo_actual
  from inventario_items where id = p_item_id;
  if v_cantidad_actual is null then
    raise exception 'Producto no encontrado';
  end if;

  v_diferencia := p_cantidad_real - v_cantidad_actual;
  if v_diferencia = 0 then
    return;
  end if;

  insert into inventario_movimientos (item_id, tipo, motivo, cantidad, nota)
  values (
    p_item_id,
    case when v_diferencia > 0 then 'entrada' else 'salida' end,
    'ajuste',
    abs(v_diferencia),
    p_nota
  );

  update inventario_items set cantidad = p_cantidad_real where id = p_item_id;

  if v_diferencia > 0 then
    if exists (select 1 from inventario_receta where item_resultante_id = p_item_id) then
      -- Tiene receta: estas unidades de más se acaban de producir de verdad —
      -- se descuentan los insumos usados (de sus propios lotes, FIFO) y el
      -- costo del lote nuevo es lo que de verdad costaron esos insumos, no un
      -- número puesto a mano. Un ajuste hacia abajo no toca los insumos: esas
      -- unidades ya estaban producidas, solo se perdieron o se dañaron.
      v_costo_producido := 0;
      for v_receta in
        select item_insumo_id, cantidad_insumo
        from inventario_receta
        where item_resultante_id = p_item_id
      loop
        v_costo_insumo := consumir_lotes_fifo(v_receta.item_insumo_id, v_receta.cantidad_insumo * v_diferencia);
        v_costo_producido := v_costo_producido + (v_costo_insumo * v_receta.cantidad_insumo);

        insert into inventario_movimientos (item_id, tipo, motivo, cantidad, nota)
        values (
          v_receta.item_insumo_id, 'salida', 'trasvase',
          v_receta.cantidad_insumo * v_diferencia,
          'Consumido al producir ' || v_diferencia || ' unidad(es) de un producto compuesto'
        );

        update inventario_items
        set cantidad = cantidad - (v_receta.cantidad_insumo * v_diferencia)
        where id = v_receta.item_insumo_id;
      end loop;

      insert into inventario_lotes (item_id, cantidad_disponible, costo_unitario)
      values (p_item_id, v_diferencia, v_costo_producido);

      update inventario_items set costo = v_costo_producido where id = p_item_id;
    else
      -- Sin receta: se encontró más stock del que el sistema pensaba. Se
      -- registra como lote nuevo al costo actual del producto, que es el
      -- único dato de costo disponible para esas unidades.
      insert into inventario_lotes (item_id, cantidad_disponible, costo_unitario)
      values (p_item_id, v_diferencia, coalesce(v_costo_actual, 0));
    end if;
  else
    -- Ajuste hacia abajo (pérdida, daño, conteo): se descuenta de los lotes
    -- existentes empezando por el más antiguo, para no perder la trazabilidad.
    perform consumir_lotes_fifo(p_item_id, abs(v_diferencia));
  end if;
end;
$$;

-- Dotación: productos que se le entregan a un empleado (esponjas, uniformes,
-- etc.), no a un cliente. No es una venta (no genera ingreso), pero sí es un
-- costo real del negocio, así que además de descontar el inventario (por
-- FIFO, igual que una venta) genera su propio gasto automático en
-- finanzas_movimientos — a diferencia de un 'ajuste' por pérdida o daño, que
-- no debe tocar el P y G.
create or replace function registrar_dotacion(
  p_item_id uuid,
  p_cantidad numeric,
  p_nota text default null
)
returns void
language plpgsql
as $$
declare
  v_empresa_id uuid;
  v_nombre text;
  v_stock numeric(12,2);
  v_costo_consumido numeric(12,2);
begin
  select empresa_id, nombre, cantidad into v_empresa_id, v_nombre, v_stock
  from inventario_items where id = p_item_id;

  if v_empresa_id is null then
    raise exception 'Producto no encontrado';
  end if;
  if p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;
  if v_stock < p_cantidad then
    raise exception 'No hay suficiente stock de "%": quedan % y se intentó entregar %.',
      v_nombre, v_stock, p_cantidad;
  end if;

  v_costo_consumido := consumir_lotes_fifo(p_item_id, p_cantidad);

  insert into inventario_movimientos (item_id, tipo, motivo, cantidad, nota)
  values (p_item_id, 'salida', 'dotacion', p_cantidad, p_nota);

  update inventario_items set cantidad = cantidad - p_cantidad where id = p_item_id;

  insert into finanzas_movimientos (empresa_id, tipo, categoria, monto, nota)
  values (
    v_empresa_id, 'gasto', 'dotación a empleados',
    p_cantidad * coalesce(v_costo_consumido, 0),
    coalesce(p_nota, 'Dotación de "' || v_nombre || '" a empleado')
  );
end;
$$;

-- Carga masiva de inventario inicial: para una empresa que llega con su propio
-- catálogo (de otra herramienta o de una hoja de Excel a mano). Por cada fila
-- del CSV, si el producto ya existe (mismo nombre en la empresa) le suma la
-- cantidad y actualiza costo/precio/categoría — igual que reabastecer_producto();
-- si no existe, lo crea. Es una foto de "cuánto hay hoy", no un historial de
-- movimientos. Devuelve cuántos productos nuevos creó.
create or replace function cargar_inventario_inicial(
  p_empresa_id uuid,
  p_items jsonb,  -- [{"nombre":"...","categoria":"...","unidad":"unidad","cantidad":10,"costo":1000,"precio_venta":2000,"es_insumo":false}, ...]
  p_reemplazar boolean default false,  -- true: el archivo reemplaza la cantidad de cada producto (carga inicial o recuento completo); false: suma a lo que ya hay (reabastecimiento)
  p_punto_venta_id uuid default null   -- solo si la empresa usa puntos_venta; null para el resto
)
returns int
language plpgsql
as $$
declare
  v_item jsonb;
  v_existente_id uuid;
  v_item_id uuid;
  v_cantidad numeric;
  v_costo numeric;
  v_es_insumo boolean;
  v_precio_venta numeric;
  v_creados int := 0;
  v_items_reseteados uuid[] := '{}';
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_costo := (v_item->>'costo')::numeric;
    v_es_insumo := coalesce((v_item->>'es_insumo')::boolean, false);
    -- un insumo puro no se vende individualmente, así que nunca tiene precio de venta
    v_precio_venta := case when v_es_insumo then null else (v_item->>'precio_venta')::numeric end;

    -- El mismo nombre puede existir en puntos distintos como filas separadas
    -- (cada una con su propio stock) — "is not distinct from" trata null
    -- como igual a null, para no romper a las empresas sin puntos de venta.
    select id into v_existente_id
    from inventario_items
    where empresa_id = p_empresa_id
      and punto_venta_id is not distinct from p_punto_venta_id
      and lower(unaccent(nombre)) = lower(unaccent(v_item->>'nombre'))
    limit 1;

    if v_existente_id is not null then
      if p_reemplazar and not (v_existente_id = any(v_items_reseteados)) then
        -- primera fila de este producto en una carga que reemplaza: se
        -- descarta el stock y los lotes anteriores, empieza de cero con lo
        -- que diga el archivo
        delete from inventario_lotes where item_id = v_existente_id;
        update inventario_items
        set cantidad = v_cantidad,
            costo = coalesce(v_costo, costo),
            precio_venta = case when v_es_insumo then null else coalesce(v_precio_venta, precio_venta) end,
            categoria = coalesce(nullif(v_item->>'categoria', ''), categoria),
            es_insumo = v_es_insumo
        where id = v_existente_id;
        v_items_reseteados := v_items_reseteados || v_existente_id;
      else
        -- reabastecimiento normal, o segunda fila del mismo producto en una
        -- carga que reemplaza (mismo nombre, distinto costo = otro lote)
        update inventario_items
        set cantidad = cantidad + v_cantidad,
            costo = coalesce(v_costo, costo),
            precio_venta = case when v_es_insumo then null else coalesce(v_precio_venta, precio_venta) end,
            categoria = coalesce(nullif(v_item->>'categoria', ''), categoria),
            es_insumo = v_es_insumo
        where id = v_existente_id;
      end if;
      v_item_id := v_existente_id;
    else
      insert into inventario_items (empresa_id, punto_venta_id, nombre, categoria, unidad, cantidad, costo, precio_venta, es_insumo)
      values (
        p_empresa_id,
        p_punto_venta_id,
        v_item->>'nombre',
        nullif(v_item->>'categoria', ''),
        coalesce(nullif(v_item->>'unidad', ''), 'unidad'),
        v_cantidad,
        v_costo,
        v_precio_venta,
        v_es_insumo
      )
      returning id into v_item_id;
      v_creados := v_creados + 1;
      v_items_reseteados := v_items_reseteados || v_item_id;
    end if;

    if v_cantidad > 0 then
      insert into inventario_lotes (item_id, cantidad_disponible, costo_unitario)
      values (v_item_id, v_cantidad, coalesce(v_costo, 0));
    end if;
  end loop;

  return v_creados;
end;
$$;

-- ------------------------------------------------------------
-- 8.5. APARTADOS — desarrollo a la medida de Manantial (empresas.permite_apartados)
-- Venta parcial: el cliente paga un abono, la prenda se separa del
-- inventario disponible de inmediato, y tiene 30 días para completar el
-- pago. Si completa, se convierte en una venta real. Si no, lo abonado
-- queda como ingreso y la prenda vuelve a estar disponible. Las cifras de
-- venta solo cuentan la plata que de verdad entró en cada momento (mismo
-- criterio de caja que ya usan los pasivos) — nunca el precio completo por
-- adelantado, así vista_estado_resultados no necesita ningún cambio: un
-- apartado no le genera ninguna fila a "ventas" hasta que se resuelve.
-- ------------------------------------------------------------
create table apartados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  punto_venta_id uuid references puntos_venta(id),
  contacto_id uuid references crm_contactos(id),
  cliente_nombre text,
  cliente_telefono text,
  cliente_email text,
  monto_total numeric(12,2) not null,
  monto_abonado numeric(12,2) not null default 0,
  fecha date not null default current_date,
  fecha_limite date not null,
  estado text not null default 'activo' check (estado in ('activo','reclamado','vencido')),
  -- Se llena cuando se resuelve (reclamado o vencido) — enlaza a la venta
  -- real que sí cuenta en el P y G. Null mientras sigue activo.
  venta_id uuid references ventas(id),
  created_at timestamptz default now()
);

create table apartados_items (
  id uuid primary key default gen_random_uuid(),
  apartado_id uuid references apartados(id) not null,
  item_id uuid references inventario_items(id) not null,
  cantidad numeric(12,2) not null,
  precio_unitario numeric(12,2) not null,
  costo_unitario numeric(12,2)  -- congelado al momento de apartar (vía FIFO), igual que ventas_items
);

create table apartados_abonos (
  id uuid primary key default gen_random_uuid(),
  apartado_id uuid references apartados(id) not null,
  monto numeric(12,2) not null,
  fecha date not null default current_date,
  created_at timestamptz default now()
);

-- Convierte un apartado ya pagado por completo en una venta real. Las
-- prendas ya se descontaron del inventario cuando se apartaron, así que se
-- usa la bandera app.apartado_ya_descontado para que el trigger de
-- descuento automático (pensado para una venta normal) no las reste otra
-- vez.
create or replace function reclamar_apartado(p_apartado_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_apartado record;
  v_venta_id uuid;
  v_item record;
begin
  select * into v_apartado from apartados where id = p_apartado_id;
  if v_apartado.id is null then
    raise exception 'Apartado no encontrado';
  end if;

  insert into ventas (empresa_id, punto_venta_id, monto, contacto_id, cliente_nombre, atributos, fecha)
  values (
    v_apartado.empresa_id, v_apartado.punto_venta_id, v_apartado.monto_total,
    v_apartado.contacto_id, v_apartado.cliente_nombre,
    jsonb_build_object('origen', 'apartado', 'apartado_id', v_apartado.id), now()
  )
  returning id into v_venta_id;

  perform set_config('app.apartado_ya_descontado', 'true', true);

  for v_item in
    select item_id, cantidad, precio_unitario, costo_unitario
    from apartados_items where apartado_id = p_apartado_id
  loop
    insert into ventas_items (venta_id, item_id, cantidad, precio_unitario, costo_unitario)
    values (v_venta_id, v_item.item_id, v_item.cantidad, v_item.precio_unitario, v_item.costo_unitario);
  end loop;

  perform set_config('app.apartado_ya_descontado', 'false', true);

  update apartados set estado = 'reclamado', venta_id = v_venta_id where id = p_apartado_id;

  -- Ya hay una venta real de por medio — el contacto pasa a la etapa de
  -- cierre, exactamente igual que con cualquier otra venta.
  if v_apartado.contacto_id is not null then
    update crm_contactos set etapa_id = etapa_cierre_crm(v_apartado.empresa_id) where id = v_apartado.contacto_id;
  end if;

  return v_venta_id;
end;
$$;

-- Registra un abono sobre un apartado activo. Si con este abono se
-- completa el precio total, el apartado se resuelve solo — no hace falta
-- un botón aparte para "entregar" la prenda.
create or replace function agregar_abono_apartado(
  p_apartado_id uuid,
  p_monto numeric,
  p_fecha date default current_date
)
returns void
language plpgsql
as $$
declare
  v_estado text;
  v_monto_total numeric;
  v_monto_abonado numeric;
begin
  select estado, monto_total into v_estado, v_monto_total from apartados where id = p_apartado_id;

  if v_estado is null then
    raise exception 'Apartado no encontrado';
  end if;
  if v_estado <> 'activo' then
    raise exception 'Este apartado ya no está activo — no se le pueden agregar más abonos.';
  end if;
  if p_monto <= 0 then
    raise exception 'El abono debe ser mayor a cero.';
  end if;

  insert into apartados_abonos (apartado_id, monto, fecha) values (p_apartado_id, p_monto, p_fecha);

  update apartados set monto_abonado = monto_abonado + p_monto where id = p_apartado_id;

  select monto_abonado into v_monto_abonado from apartados where id = p_apartado_id;

  if v_monto_abonado >= v_monto_total then
    perform reclamar_apartado(p_apartado_id);
  end if;
end;
$$;

-- Crea un apartado nuevo: separa la(s) prenda(s) del inventario disponible
-- de inmediato (FIFO, igual que una venta) y arranca el plazo de 30 días.
-- El contacto del CRM se busca o se crea igual que en registrar_venta(),
-- pero sin moverlo a la etapa de cierre todavía — eso solo pasa cuando el
-- apartado se resuelve de verdad (reclamado o vencido).
create or replace function registrar_apartado(
  p_empresa_id uuid,
  p_contacto_id uuid,
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_cliente_email text,
  p_items jsonb,  -- [{"item_id":"...","cantidad":1,"precio_unitario":80000}, ...]
  p_monto_inicial numeric,
  p_punto_venta_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_contacto_id uuid;
  v_apartado_id uuid;
  v_monto_total numeric(12,2);
  v_item jsonb;
  v_item_id uuid;
  v_cantidad numeric;
  v_precio numeric;
  v_costo numeric;
  v_stock numeric;
  v_nombre text;
  v_es_insumo boolean;
  v_tipo text;
begin
  if p_contacto_id is not null then
    v_contacto_id := p_contacto_id;
    update crm_contactos
    set nombre = coalesce(p_cliente_nombre, nombre), email = coalesce(p_cliente_email, email)
    where id = v_contacto_id;
  elsif coalesce(p_cliente_nombre, '') <> '' then
    select id into v_contacto_id
    from crm_contactos where empresa_id = p_empresa_id and telefono = p_cliente_telefono
    limit 1;

    if v_contacto_id is null then
      insert into crm_contactos (empresa_id, nombre, telefono, email)
      values (p_empresa_id, p_cliente_nombre, p_cliente_telefono, p_cliente_email)
      returning id into v_contacto_id;
    else
      update crm_contactos
      set nombre = coalesce(p_cliente_nombre, nombre), email = coalesce(p_cliente_email, email)
      where id = v_contacto_id;
    end if;
  else
    v_contacto_id := null;
  end if;

  select sum((item->>'cantidad')::numeric * (item->>'precio_unitario')::numeric)
  into v_monto_total
  from jsonb_array_elements(p_items) as item;

  insert into apartados (empresa_id, punto_venta_id, contacto_id, cliente_nombre, cliente_telefono, cliente_email, monto_total, fecha, fecha_limite)
  values (p_empresa_id, p_punto_venta_id, v_contacto_id, p_cliente_nombre, p_cliente_telefono, p_cliente_email, v_monto_total, current_date, current_date + interval '30 days')
  returning id into v_apartado_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_id := (v_item->>'item_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_precio := (v_item->>'precio_unitario')::numeric;

    select tipo, cantidad, nombre, es_insumo into v_tipo, v_stock, v_nombre, v_es_insumo
    from inventario_items where id = v_item_id;

    if v_es_insumo then
      raise exception '"%" es material de receta y no se vende individualmente.', v_nombre;
    end if;
    if v_stock < v_cantidad then
      raise exception 'No hay suficiente stock de "%": quedan % y se intentó apartar %.', v_nombre, v_stock, v_cantidad;
    end if;

    v_costo := consumir_lotes_fifo(v_item_id, v_cantidad);

    insert into inventario_movimientos (item_id, tipo, cantidad, nota)
    values (v_item_id, 'salida', v_cantidad, 'Apartado — separado del inventario disponible');

    update inventario_items set cantidad = cantidad - v_cantidad where id = v_item_id;

    insert into apartados_items (apartado_id, item_id, cantidad, precio_unitario, costo_unitario)
    values (v_apartado_id, v_item_id, v_cantidad, v_precio, v_costo);
  end loop;

  if p_monto_inicial > 0 then
    perform agregar_abono_apartado(v_apartado_id, p_monto_inicial, current_date);
  end if;

  return v_apartado_id;
end;
$$;

-- Revisa los apartados vencidos de una empresa (más de 30 días sin
-- completar el pago) y los resuelve: lo abonado hasta ese momento queda
-- como ingreso (el cliente lo pierde), y la prenda vuelve a estar
-- disponible en el inventario. No corre sola en segundo plano (no hay
-- servidor propio para eso) — se llama cada vez que alguien abre la
-- pantalla de Apartados, así que el cierre ocurre en la próxima visita a
-- esa pantalla, no exactamente al minuto del vencimiento.
create or replace function aplicar_vencimiento_apartados(p_empresa_id uuid)
returns void
language plpgsql
as $$
declare
  v_apartado record;
  v_venta_id uuid;
  v_item record;
begin
  for v_apartado in
    select * from apartados
    where empresa_id = p_empresa_id and estado = 'activo' and fecha_limite < current_date
  loop
    if v_apartado.monto_abonado > 0 then
      insert into ventas (empresa_id, punto_venta_id, monto, contacto_id, cliente_nombre, fecha, atributos)
      values (
        v_apartado.empresa_id, v_apartado.punto_venta_id, v_apartado.monto_abonado,
        v_apartado.contacto_id, v_apartado.cliente_nombre, v_apartado.fecha_limite,
        jsonb_build_object('origen', 'apartado_vencido', 'apartado_id', v_apartado.id)
      )
      returning id into v_venta_id;

      insert into ventas_items (venta_id, nombre_libre, cantidad, precio_unitario, costo_unitario)
      values (v_venta_id, 'Apartado vencido — abono no reclamado', 1, v_apartado.monto_abonado, 0);

      if v_apartado.contacto_id is not null then
        update crm_contactos set etapa_id = etapa_cierre_crm(v_apartado.empresa_id) where id = v_apartado.contacto_id;
      end if;
    else
      v_venta_id := null;
    end if;

    for v_item in
      select item_id, cantidad, costo_unitario from apartados_items where apartado_id = v_apartado.id
    loop
      insert into inventario_lotes (item_id, cantidad_disponible, costo_unitario)
      values (v_item.item_id, v_item.cantidad, coalesce(v_item.costo_unitario, 0));

      insert into inventario_movimientos (item_id, tipo, motivo, cantidad, nota)
      values (v_item.item_id, 'entrada', 'devolucion', v_item.cantidad, 'Apartado vencido — vuelve a estar disponible');

      update inventario_items set cantidad = cantidad + v_item.cantidad where id = v_item.item_id;
    end loop;

    update apartados set estado = 'vencido', venta_id = v_venta_id where id = v_apartado.id;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 9. FINANZAS — alimenta el estado de pérdidas y ganancias
-- ------------------------------------------------------------
create table finanzas_movimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  -- Solo aplica si la empresa usa puntos_venta; null para el resto. Así el
  -- arriendo o la nómina de un punto no se mezclan con los de otro, y cada
  -- punto puede tener su propia utilidad neta.
  punto_venta_id uuid references puntos_venta(id),
  tipo text not null check (tipo in ('ingreso','gasto')),
  categoria text,
  monto numeric(12,2) not null,
  fecha date default current_date,
  nota text
);

-- Cuando una entrada de inventario es una compra real (no un ajuste o devolución),
-- se genera el gasto correspondiente solo. Los ajustes no deben inflar tus gastos —
-- por eso esto no es automático para cualquier entrada, solo para motivo = 'compra'.
create or replace function registrar_gasto_compra()
returns trigger language plpgsql as $$
declare
  v_empresa_id uuid;
  v_costo numeric(12,2);
begin
  if new.tipo = 'entrada' and new.motivo = 'compra' then
    select empresa_id, costo into v_empresa_id, v_costo
    from inventario_items where id = new.item_id;

    insert into finanzas_movimientos (empresa_id, tipo, categoria, monto, nota)
    values (v_empresa_id, 'gasto', 'compra de inventario', new.cantidad * coalesce(v_costo, 0),
            'Generado automáticamente por compra de inventario');
  end if;
  return new;
end;
$$;

create trigger trigger_registrar_gasto_compra
after insert on inventario_movimientos
for each row execute function registrar_gasto_compra();

-- ------------------------------------------------------------
-- Vista: Estado de pérdidas y ganancias
-- Estructura contable real: Ingresos - Costo de ventas = Utilidad bruta;
-- + otros ingresos - gastos operacionales = Utilidad neta.
-- Usa el costo congelado en cada venta (no el costo actual). Respeta
-- Row Level Security automáticamente: cada empresa solo ve su propia fila.
-- ------------------------------------------------------------
-- punto_venta_id se incluye en cada CTE y se junta con "is not distinct
-- from" en vez de "=" — así una empresa sin puntos de venta (punto_venta_id
-- siempre null en todas sus filas) sigue calzando null con null, y no se
-- rompe el cálculo de nadie que no use puntos de venta.
create or replace view vista_estado_resultados as
with periodos as (
  select empresa_id, punto_venta_id, date_trunc('month', fecha) as mes from ventas
  union
  select empresa_id, punto_venta_id, date_trunc('month', fecha) as mes from finanzas_movimientos
),
ventas_mes as (
  select empresa_id, punto_venta_id, date_trunc('month', fecha) as mes, sum(monto) as ingresos
  from ventas group by 1, 2, 3
),
costo_ventas_mes as (
  select v.empresa_id, v.punto_venta_id, date_trunc('month', v.fecha) as mes,
    sum(vi.cantidad * coalesce(vi.costo_unitario, 0)) as costo_ventas
  from ventas v
  join ventas_items vi on vi.venta_id = v.id
  group by 1, 2, 3
),
otros_mes as (
  select empresa_id, punto_venta_id, date_trunc('month', fecha) as mes,
    sum(case when tipo = 'ingreso' then monto else 0 end) as ingresos_otros,
    sum(case when tipo = 'gasto' then monto else 0 end) as gastos_operacionales
  from finanzas_movimientos group by 1, 2, 3
)
select
  p.empresa_id,
  p.mes,
  coalesce(vm.ingresos, 0) as ingresos_por_ventas,
  coalesce(cv.costo_ventas, 0) as costo_de_ventas,
  coalesce(vm.ingresos, 0) - coalesce(cv.costo_ventas, 0) as utilidad_bruta,
  coalesce(om.ingresos_otros, 0) as otros_ingresos,
  coalesce(om.gastos_operacionales, 0) as gastos_operacionales,
  (coalesce(vm.ingresos, 0) - coalesce(cv.costo_ventas, 0)
   + coalesce(om.ingresos_otros, 0) - coalesce(om.gastos_operacionales, 0)) as utilidad_neta,
  p.punto_venta_id
from periodos p
left join ventas_mes vm on vm.empresa_id = p.empresa_id and vm.mes = p.mes
  and vm.punto_venta_id is not distinct from p.punto_venta_id
left join costo_ventas_mes cv on cv.empresa_id = p.empresa_id and cv.mes = p.mes
  and cv.punto_venta_id is not distinct from p.punto_venta_id
left join otros_mes om on om.empresa_id = p.empresa_id and om.mes = p.mes
  and om.punto_venta_id is not distinct from p.punto_venta_id;

-- ------------------------------------------------------------
-- Pasivos y deudas por pagar
-- Crear la deuda no genera ningún gasto por sí sola — ese dinero
-- todavía no ha salido. El gasto real (criterio de caja) se registra
-- cuando efectivamente se abona o se paga, con la fecha en que
-- ocurrió: cada abono genera su propio movimiento en
-- finanzas_movimientos (enlazado vía pasivo_id más abajo), así sí
-- impacta vista_estado_resultados en el mes correspondiente, sin
-- duplicar — solo se cuenta la porción abonada, nunca la deuda
-- completa de una vez.
-- ------------------------------------------------------------
create table pasivos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  descripcion text not null,                    -- 'Préstamo Bancolombia', 'Pago proveedor Aseo Distribuciones'
  tipo text check (tipo in ('prestamo','proveedor','tarjeta_credito','otro')),
  monto_total numeric(12,2) not null,
  monto_pagado numeric(12,2) not null default 0,
  fecha_vencimiento date,
  estado text not null default 'pendiente' check (estado in ('pendiente','pagado','vencido')),
  -- Cada cuánto se planea pagar (informativo — no genera abonos solo, cada
  -- pago se sigue registrando a mano con registrarAbono()/marcarPagado()).
  frecuencia_pago text check (frecuencia_pago is null or frecuencia_pago in ('diario','mensual','anual','unico')),
  created_at timestamptz default now()
);

-- Enlaza cada abono/pago (registrado como gasto en finanzas_movimientos,
-- categoría 'pago de deuda') con la deuda a la que corresponde. Nulo
-- para cualquier otro gasto o ingreso que no sea un pago de deuda.
alter table finanzas_movimientos add column pasivo_id uuid references pasivos(id);

-- Si un gasto se repite (arriendo, nómina, servicios), queda marcado como
-- referencia — informativo, no genera el siguiente gasto solo: cada uno se
-- sigue registrando a mano cuando ocurre de verdad (criterio de caja).
alter table finanzas_movimientos add column recurrente boolean not null default false;
alter table finanzas_movimientos add column frecuencia text
  check (frecuencia is null or frecuencia in ('diario','mensual','anual'));

-- ------------------------------------------------------------
-- Vista: Utilidad por producto y por categoría
-- Usa el costo congelado en cada venta (no el costo actual), para que
-- la utilidad de ventas pasadas no cambie si el costo del producto sube después.
-- Vive dentro del módulo de Estado de P y G — es su desglose por producto.
-- ------------------------------------------------------------
create or replace view vista_utilidad_por_producto as
select
  i.empresa_id,
  i.id as item_id,
  i.nombre,
  i.categoria,
  i.tipo,
  sum(vi.cantidad) as unidades_vendidas,
  sum(vi.cantidad * vi.precio_unitario) as ingresos,
  sum(vi.cantidad * coalesce(vi.costo_unitario, 0)) as costos,
  sum(vi.cantidad * vi.precio_unitario) - sum(vi.cantidad * coalesce(vi.costo_unitario, 0)) as utilidad,
  case
    when sum(vi.cantidad * vi.precio_unitario) > 0
    then round(100.0 * (sum(vi.cantidad * vi.precio_unitario) - sum(vi.cantidad * coalesce(vi.costo_unitario, 0)))
                / sum(vi.cantidad * vi.precio_unitario), 1)
    else 0
  end as margen_porcentaje
from ventas_items vi
join inventario_items i on i.id = vi.item_id
group by i.empresa_id, i.id, i.nombre, i.categoria, i.tipo;

create or replace view vista_utilidad_por_categoria as
select
  empresa_id,
  categoria,
  sum(unidades_vendidas) as unidades_vendidas,
  sum(ingresos) as ingresos,
  sum(costos) as costos,
  sum(utilidad) as utilidad,
  case when sum(ingresos) > 0 then round(100.0 * sum(utilidad) / sum(ingresos), 1) else 0 end as margen_porcentaje
from vista_utilidad_por_producto
group by empresa_id, categoria;

-- ------------------------------------------------------------
-- Vista: Resumen por venta — cuántos ítems distintos y cuántas
-- unidades en total llevó cada venta (el "carrito" completo).
-- ------------------------------------------------------------
create or replace view vista_resumen_ventas as
select
  v.id as venta_id,
  v.empresa_id,
  v.fecha,
  v.monto,
  v.contacto_id,
  count(vi.id) as items_distintos,
  coalesce(sum(vi.cantidad), 0) as unidades_totales
from ventas v
left join ventas_items vi on vi.venta_id = v.id
group by v.id, v.empresa_id, v.fecha, v.monto, v.contacto_id;

-- ------------------------------------------------------------
-- Vista: Velocidad de venta reciente por producto — unidades
-- vendidas por día, promediado sobre los últimos 30 días. Alimenta
-- la pestaña "Proyecciones" de Inventario: cantidad disponible ÷
-- esto = días de stock que quedan al ritmo de venta actual.
-- ------------------------------------------------------------
create or replace view vista_velocidad_ventas as
select
  i.empresa_id,
  vi.item_id,
  round(sum(vi.cantidad) / 30.0, 4) as unidades_por_dia
from ventas_items vi
join ventas v on v.id = vi.venta_id
join inventario_items i on i.id = vi.item_id
where v.fecha >= now() - interval '30 days'
group by i.empresa_id, vi.item_id;

-- ------------------------------------------------------------
-- Festivos de Colombia — tabla de referencia, compartida por
-- todas las empresas (no es un dato de ninguna en particular,
-- por eso no lleva empresa_id ni Row Level Security).
-- Poblada con el calendario oficial 2026. Verificado en fuentes
-- públicas en julio 2026 — el festivo del 13 de julio (Virgen de
-- Chiquinquirá, Ley 2578 de 2026) tiene una demanda en curso ante
-- la Corte Constitucional; si se cae, basta con borrar esa fila.
-- Hay que agregar manualmente las fechas de cada año nuevo.
-- ------------------------------------------------------------
create table festivos (
  fecha date primary key,
  nombre text not null
);

insert into festivos (fecha, nombre) values
  ('2026-01-01', 'Año Nuevo'),
  ('2026-01-12', 'Día de los Reyes Magos'),
  ('2026-03-23', 'Día de San José'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-05-18', 'Día de la Ascensión'),
  ('2026-06-08', 'Corpus Christi'),
  ('2026-06-15', 'Sagrado Corazón de Jesús'),
  ('2026-06-29', 'San Pedro y San Pablo'),
  ('2026-07-13', 'Virgen del Rosario de Chiquinquirá'),
  ('2026-07-20', 'Día de la Independencia'),
  ('2026-08-07', 'Batalla de Boyacá'),
  ('2026-08-17', 'Asunción de la Virgen'),
  ('2026-10-12', 'Día de la Raza'),
  ('2026-11-02', 'Todos los Santos'),
  ('2026-11-16', 'Independencia de Cartagena'),
  ('2026-12-08', 'Inmaculada Concepción'),
  ('2026-12-25', 'Navidad');

-- Vista: ventas por día, marcando día de la semana y si fue festivo.
-- Responde directo "¿vendemos más los festivos?" — se filtra o agrupa por es_festivo.
-- "at time zone 'America/Bogota'" convierte la marca de tiempo (guardada en
-- UTC) a la hora real de Colombia antes de truncarla a un día — si no, una
-- venta después de las 7pm (Colombia) quedaba contada como del día
-- siguiente en UTC, y por eso podía no coincidir con el festivo real ni con
-- el día de la semana correcto.
create or replace view vista_ventas_por_dia as
select
  v.empresa_id,
  (v.fecha at time zone 'America/Bogota')::date as dia,
  case extract(dow from (v.fecha at time zone 'America/Bogota')::date)::int
    when 0 then 'Domingo' when 1 then 'Lunes' when 2 then 'Martes'
    when 3 then 'Miércoles' when 4 then 'Jueves' when 5 then 'Viernes'
    when 6 then 'Sábado'
  end as dia_semana,
  (f.fecha is not null) as es_festivo,
  f.nombre as nombre_festivo,
  count(v.id) as numero_ventas,
  sum(v.monto) as total_vendido
from ventas v
left join festivos f on f.fecha = (v.fecha at time zone 'America/Bogota')::date
group by v.empresa_id, (v.fecha at time zone 'America/Bogota')::date, f.fecha, f.nombre;

-- ------------------------------------------------------------
-- Vista: Perfil de compra de un cliente
-- Para la ficha del contacto cuando el CRM se alimenta de ventas:
-- ticket medio, cada cuántos días compra en promedio, el producto
-- más barato y más caro que se le ha vendido, e inversión total.
-- Un cliente sin compras (un lead puro) simplemente no aparece aquí.
-- ------------------------------------------------------------
create or replace view vista_perfil_cliente as
with agregados as (
  select
    c.id as contacto_id,
    c.empresa_id,
    count(v.id) as total_compras,
    sum(v.monto) as inversion_total,
    round(avg(v.monto), 0) as ticket_medio,
    min(v.fecha) as primera_compra,
    max(v.fecha) as ultima_compra,
    case
      when count(v.id) > 1
      then round(extract(epoch from (max(v.fecha) - min(v.fecha))) / 86400.0 / (count(v.id) - 1), 1)
      else null
    end as dias_promedio_entre_compras
  from crm_contactos c
  join ventas v on v.contacto_id = c.id
  group by c.id, c.empresa_id
),
items_cliente as (
  select
    v.contacto_id,
    vi.precio_unitario,
    i.nombre as producto_nombre,
    row_number() over (partition by v.contacto_id order by vi.precio_unitario asc) as rn_barato,
    row_number() over (partition by v.contacto_id order by vi.precio_unitario desc) as rn_caro
  from ventas v
  join ventas_items vi on vi.venta_id = v.id
  join inventario_items i on i.id = vi.item_id
  where v.contacto_id is not null
)
select
  a.contacto_id,
  a.empresa_id,
  a.total_compras,
  a.inversion_total,
  a.ticket_medio,
  a.primera_compra,
  a.ultima_compra,
  a.dias_promedio_entre_compras,
  barato.producto_nombre as producto_mas_economico,
  barato.precio_unitario as precio_mas_economico,
  caro.producto_nombre as producto_mas_costoso,
  caro.precio_unitario as precio_mas_costoso
from agregados a
left join (select * from items_cliente where rn_barato = 1) barato on barato.contacto_id = a.contacto_id
left join (select * from items_cliente where rn_caro = 1) caro on caro.contacto_id = a.contacto_id;

-- ------------------------------------------------------------
-- 10. PROMOCIONES Y DESCUENTOS
-- ------------------------------------------------------------
create table promociones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  -- Solo aplica si la empresa usa puntos_venta; null = aplica a todos los
  -- puntos (y es el único valor posible para el resto de las empresas).
  punto_venta_id uuid references puntos_venta(id),
  nombre text not null,                             -- ej. 'Cambio de aceite 20% - Julio'
  codigo text,                                       -- código de cupón, opcional
  tipo_promocion text not null
    check (tipo_promocion in ('descuento_porcentaje','descuento_fijo','2x1','lleve_x_gratis')),
  valor numeric(12,2),                                -- 20 (=20%) o 10000 (=$10.000); null para 2x1 y lleve_x_gratis
  aplica_a_categoria text,                            -- alternativa: toda una categoría
  item_regalo_id uuid references inventario_items(id),  -- solo para 'lleve_x_gratis': qué producto se regala
  fecha_inicio date not null,
  fecha_fin date not null,
  activo boolean not null default true,
  created_at timestamptz default now()
);

-- Productos específicos a los que aplica una promoción (cuando no aplica a todo el
-- catálogo ni a una categoría entera) — una promoción puede aplicar a varios productos.
create table promocion_items (
  promocion_id uuid references promociones(id) not null,
  item_id uuid references inventario_items(id) not null,
  primary key (promocion_id, item_id)
);

alter table ventas_items add constraint ventas_items_promocion_id_fkey
  foreign key (promocion_id) references promociones(id);

-- Vista: desempeño completo de cada promoción — ventas que la usaron, ticket promedio
-- de esas ventas, unidades movidas con descuento, cuánto dinero se regaló, y las ventas
-- totales de todo el período de la campaña (para comparar campaña vs. no campaña).
create or replace view vista_efectividad_promociones as
with ventas_con_promo as (
  select distinct v.id as venta_id, v.monto, vi.promocion_id
  from ventas v
  join ventas_items vi on vi.venta_id = v.id
  where vi.promocion_id is not null
)
select
  p.id as promocion_id,
  p.empresa_id,
  p.nombre,
  p.tipo_promocion,
  p.codigo,
  p.fecha_inicio,
  p.fecha_fin,
  count(distinct vc.venta_id) as ventas_con_este_descuento,
  coalesce(sum(vc.monto), 0) as ingresos_de_esas_ventas,
  case when count(distinct vc.venta_id) > 0
    then round(coalesce(sum(vc.monto), 0) / count(distinct vc.venta_id), 0)
    else 0
  end as ticket_promedio,
  (select coalesce(sum(vi2.cantidad), 0) from ventas_items vi2 where vi2.promocion_id = p.id) as unidades_con_descuento,
  (select coalesce(sum(vi2.descuento_aplicado), 0) from ventas_items vi2 where vi2.promocion_id = p.id) as descuento_total_otorgado,
  (select coalesce(sum(v2.monto), 0) from ventas v2
     where v2.empresa_id = p.empresa_id and v2.fecha::date between p.fecha_inicio and p.fecha_fin) as ventas_totales_del_periodo
from promociones p
left join ventas_con_promo vc on vc.promocion_id = p.id
group by p.id, p.empresa_id, p.nombre, p.tipo_promocion, p.codigo, p.fecha_inicio, p.fecha_fin;

-- ============================================================
-- ROW LEVEL SECURITY — el corazón del multi-tenant
-- Cada empresa ve solo sus propias filas; el admin las ve todas.
-- ============================================================

alter table empresas enable row level security;
alter table puntos_venta enable row level security;
alter table perfiles enable row level security;
alter table actualizaciones enable row level security;
alter table diagnosticos enable row level security;
alter table suscripciones enable row level security;
alter table ventas enable row level security;
alter table ventas_items enable row level security;
alter table crm_etapas enable row level security;
alter table crm_contactos enable row level security;
alter table crm_interacciones enable row level security;
alter table inventario_items enable row level security;
alter table inventario_movimientos enable row level security;
alter table inventario_lotes enable row level security;
alter table inventario_receta enable row level security;
alter table proveedores enable row level security;
alter table finanzas_movimientos enable row level security;
alter table pasivos enable row level security;
alter table promociones enable row level security;
alter table promocion_items enable row level security;
alter table apartados enable row level security;
alter table apartados_items enable row level security;
alter table apartados_abonos enable row level security;

-- Funciones auxiliares, para no repetir la misma subconsulta en cada política.
-- security definer es necesario aquí: la política de "perfiles" usa es_admin(),
-- que a su vez consulta "perfiles" — sin security definer, Postgres tendría que
-- re-evaluar esa misma política para resolver la función, entrando en un ciclo
-- que termina en error ("infinite recursion detected in policy for relation").
create or replace function mi_empresa_id()
returns uuid language sql stable security definer set search_path = public as $$
  select empresa_id from perfiles where id = auth.uid();
$$;

create or replace function es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select rol = 'admin' from perfiles where id = auth.uid();
$$;

-- A qué punto de venta está limitado el usuario actual. null = ve toda la
-- empresa (caso normal: cuenta general, o cualquier empresa que no usa
-- puntos_venta). Con un valor, solo ve ese punto.
create or replace function mi_punto_venta_id()
returns uuid language sql stable security definer set search_path = public as $$
  select punto_venta_id from perfiles where id = auth.uid();
$$;

-- Políticas: mismo patrón repetido en cada tabla con empresa_id
create policy "ver mi propia empresa" on empresas
  for select using (id = mi_empresa_id() or es_admin());

create policy "ver mis puntos de venta" on puntos_venta
  for all using (empresa_id = mi_empresa_id() or es_admin());

-- Solo permite actualizar (nunca crear ni borrar) la propia fila de empresa.
-- En la práctica, el único código de la aplicación que escribe aquí es
-- subirLogoEmpresa(), que solo toca logo_path — el resto de campos
-- (plan, módulos activos, etc.) siguen siendo de administración manual.
create policy "actualizar mi propia empresa" on empresas
  for update using (id = mi_empresa_id() or es_admin())
  with check (id = mi_empresa_id() or es_admin());

create policy "ver mi propio perfil" on perfiles
  for select using (id = auth.uid() or es_admin());

create policy "actualizar mi propio perfil" on perfiles
  for update using (id = auth.uid() or es_admin())
  with check (id = auth.uid() or es_admin());

-- No es un dato de ninguna empresa en particular (como festivos) — cualquier
-- persona con sesión puede leerlas, para que el pop-up funcione.
create policy "ver actualizaciones con sesión activa" on actualizaciones
  for select using (auth.uid() is not null);

create policy "ver mis diagnosticos" on diagnosticos
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis suscripciones" on suscripciones
  for all using (empresa_id = mi_empresa_id() or es_admin());

-- Con puntos_venta: si mi perfil está limitado a un punto (mi_punto_venta_id()
-- no es null), solo veo las filas de ese punto. Si no está limitado (caso de
-- casi todas las empresas), veo toda la empresa igual que siempre.
create policy "ver mis ventas" on ventas
  for all using (
    (empresa_id = mi_empresa_id()
      and (mi_punto_venta_id() is null or punto_venta_id = mi_punto_venta_id()))
    or es_admin()
  );

create policy "ver mis etapas de crm" on crm_etapas
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mi crm" on crm_contactos
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mi inventario" on inventario_items
  for all using (
    (empresa_id = mi_empresa_id()
      and (mi_punto_venta_id() is null or punto_venta_id = mi_punto_venta_id()))
    or es_admin()
  );

create policy "ver mis proveedores" on proveedores
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis finanzas" on finanzas_movimientos
  for all using (
    (empresa_id = mi_empresa_id()
      and (mi_punto_venta_id() is null or punto_venta_id = mi_punto_venta_id()))
    or es_admin()
  );

create policy "ver mis pasivos" on pasivos
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis promociones" on promociones
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis apartados" on apartados
  for all using (
    (empresa_id = mi_empresa_id()
      and (mi_punto_venta_id() is null or punto_venta_id = mi_punto_venta_id()))
    or es_admin()
  );

create policy "ver items de mis apartados" on apartados_items
  for all using (
    apartado_id in (select id from apartados where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver abonos de mis apartados" on apartados_abonos
  for all using (
    apartado_id in (select id from apartados where empresa_id = mi_empresa_id())
    or es_admin()
  );

-- Tablas sin empresa_id directo: se filtran a través de su tabla padre
create policy "ver interacciones de mi crm" on crm_interacciones
  for all using (
    contacto_id in (select id from crm_contactos where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver movimientos de mi inventario" on inventario_movimientos
  for all using (
    item_id in (select id from inventario_items where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver lotes de mi inventario" on inventario_lotes
  for all using (
    item_id in (select id from inventario_items where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver receta de mi inventario" on inventario_receta
  for all using (
    item_resultante_id in (select id from inventario_items where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver items de mis ventas" on ventas_items
  for all using (
    venta_id in (select id from ventas where empresa_id = mi_empresa_id())
    or es_admin()
  );

create policy "ver productos de mis promociones" on promocion_items
  for all using (
    promocion_id in (select id from promociones where empresa_id = mi_empresa_id())
    or es_admin()
  );

-- ============================================================
-- STORAGE — fotos de productos
-- Bucket privado: cada empresa solo puede ver y subir fotos dentro de su
-- propia carpeta ('{empresa_id}/{item_id}/archivo'). Límite de 5MB por foto,
-- solo formatos de imagen comunes.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventario-fotos', 'inventario-fotos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "ver fotos de mi empresa" on storage.objects
  for select using (
    bucket_id = 'inventario-fotos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

create policy "subir fotos de mi empresa" on storage.objects
  for insert with check (
    bucket_id = 'inventario-fotos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

create policy "actualizar fotos de mi empresa" on storage.objects
  for update using (
    bucket_id = 'inventario-fotos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

create policy "borrar fotos de mi empresa" on storage.objects
  for delete using (
    bucket_id = 'inventario-fotos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

-- Bucket separado para el logo de cada empresa — mismo patrón de RLS que
-- las fotos de producto, pero con límite más pequeño (2MB) y permitiendo SVG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('empresas-logos', 'empresas-logos', false, 2097152, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do nothing;

create policy "ver logo de mi empresa" on storage.objects
  for select using (
    bucket_id = 'empresas-logos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

create policy "subir logo de mi empresa" on storage.objects
  for insert with check (
    bucket_id = 'empresas-logos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

create policy "actualizar logo de mi empresa" on storage.objects
  for update using (
    bucket_id = 'empresas-logos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

create policy "borrar logo de mi empresa" on storage.objects
  for delete using (
    bucket_id = 'empresas-logos'
    and ((storage.foldername(name))[1] = mi_empresa_id()::text or es_admin())
  );

-- ============================================================
-- FUNCIONES DE NEGOCIO
-- El punto de entrada que usa la aplicación — nunca se arma
-- una venta con llamadas separadas al CRM, a ventas y a inventario.
-- ============================================================

-- Buscador de clientes: escribe cualquier parte del nombre, teléfono o placa
-- y devuelve las coincidencias dentro de la empresa. Si no aparece nada,
-- es un cliente nuevo; si aparece, es recurrente. unaccent() ignora tildes,
-- para que "jose" encuentre a "José" y viceversa.
create or replace function buscar_clientes(p_empresa_id uuid, p_query text)
returns setof crm_contactos
language sql stable
as $$
  select *
  from crm_contactos
  where empresa_id = p_empresa_id
    and (
      unaccent(nombre) ilike unaccent('%' || p_query || '%')
      or telefono ilike '%' || p_query || '%'
      or unaccent(atributos->>'placa') ilike unaccent('%' || p_query || '%')
    )
  order by nombre
  limit 20;
$$;

-- Registra una venta completa de una sola vez:
-- si ya se confirmó un cliente encontrado con buscar_clientes(), se usa directo;
-- si no, lo busca por teléfono o lo crea. Luego crea la venta y cada item
-- (lo que dispara el descuento de inventario automático solo para productos).
-- Si algo falla a mitad de camino, no queda nada guardado a medias.
create or replace function registrar_venta(
  p_empresa_id uuid,
  p_contacto_id uuid,           -- confirmado en el buscador; null si es cliente nuevo o no se buscó
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_cliente_email text,
  p_atributos_cliente jsonb,    -- ej. {"placa": "ABC123", "modelo": "Dominar 250"}
  p_atributos_venta jsonb,      -- ej. {"km": 15000}
  p_items jsonb,                 -- ej. [{"item_id":"...","cantidad":1,"precio_unitario":20000,"promocion_id":null,"descuento_aplicado":0}, ...]
                                  -- o, sin catálogo (empresa sin Inventario): [{"nombre_libre":"Camisa talla M","cantidad":1,"precio_unitario":45000,"costo_unitario":20000}, ...]
  p_fecha timestamptz default null,  -- si la persona cambió la fecha/hora sugerida; null = usar el momento actual
  p_metodo_pago text default null,   -- uno de los valores en empresas.metodos_pago_disponibles
  p_punto_venta_id uuid default null -- solo si la empresa usa puntos_venta; null para el resto
)
returns uuid
language plpgsql
as $$
declare
  v_contacto_id uuid;
  v_venta_id uuid;
  v_monto_total numeric(12,2);
  v_item jsonb;
begin
  -- 1. Cliente: si ya se confirmó uno en el buscador, se usa directo. Si no
  --    se dio ningún nombre (negocio sin CRM activo, venta anónima), se
  --    omite por completo — no se crea ni se busca ningún contacto.
  if p_contacto_id is not null then
    v_contacto_id := p_contacto_id;
    update crm_contactos
    set atributos = atributos || p_atributos_cliente,
        nombre = coalesce(p_cliente_nombre, nombre),
        email = coalesce(p_cliente_email, email),
        etapa_id = etapa_cierre_crm(p_empresa_id)
    where id = v_contacto_id;
  elsif coalesce(p_cliente_nombre, '') <> '' then
    select id into v_contacto_id
    from crm_contactos
    where empresa_id = p_empresa_id and telefono = p_cliente_telefono
    limit 1;

    if v_contacto_id is null then
      insert into crm_contactos (empresa_id, nombre, telefono, email, atributos, etapa_id)
      values (p_empresa_id, p_cliente_nombre, p_cliente_telefono, p_cliente_email, p_atributos_cliente, etapa_cierre_crm(p_empresa_id))
      returning id into v_contacto_id;
    else
      update crm_contactos
      set atributos = atributos || p_atributos_cliente,
          nombre = coalesce(p_cliente_nombre, nombre),
          email = coalesce(p_cliente_email, email),
          etapa_id = etapa_cierre_crm(p_empresa_id)
      where id = v_contacto_id;
    end if;
  else
    v_contacto_id := null;
  end if;

  -- 2. Calcular el monto total a partir de los items (ya con el descuento aplicado)
  select sum((item->>'cantidad')::numeric * (item->>'precio_unitario')::numeric)
  into v_monto_total
  from jsonb_array_elements(p_items) as item;

  -- 3. Crear la venta
  insert into ventas (empresa_id, punto_venta_id, monto, contacto_id, cliente_nombre, atributos, fecha, metodo_pago)
  values (p_empresa_id, p_punto_venta_id, v_monto_total, v_contacto_id, p_cliente_nombre, p_atributos_venta, coalesce(p_fecha, now()), p_metodo_pago)
  returning id into v_venta_id;

  -- 4. Agregar cada producto o servicio vendido, con su promoción si aplica
  --    (esto dispara el descuento de inventario, solo para productos con
  --    item_id — una empresa sin Inventario no manda item_id, solo
  --    nombre_libre y su propio costo_unitario, y no pasa por ese trigger)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into ventas_items (venta_id, item_id, nombre_libre, cantidad, precio_unitario, costo_unitario, promocion_id, descuento_aplicado)
    values (
      v_venta_id,
      nullif(v_item->>'item_id','')::uuid,
      nullif(v_item->>'nombre_libre',''),
      (v_item->>'cantidad')::numeric,
      (v_item->>'precio_unitario')::numeric,
      nullif(v_item->>'costo_unitario','')::numeric,
      nullif(v_item->>'promocion_id','')::uuid,
      coalesce((v_item->>'descuento_aplicado')::numeric, 0)
    );
  end loop;

  return v_venta_id;
end;
$$;

-- Deshacer una venta recién registrada, para corregir un error sin dejar el
-- inventario mal calculado. Solo funciona en los 2 minutos siguientes a
-- haberla creado (la app solo ofrece el botón durante 60 segundos; este
-- margen extra es por si hay algo de latencia). En vez de intentar
-- reconstruir el lote exacto que consumió el FIFO (frágil si hubo otra
-- venta del mismo producto en el medio), crea un lote nuevo de entrada al
-- costo que quedó congelado en la venta — la cantidad y el costo quedan
-- exactamente igual que antes de vender, aunque no sea "el mismo" lote.
-- No revierte nada del CRM (si creó o actualizó un contacto, se queda así).
create or replace function deshacer_venta(p_venta_id uuid)
returns void
language plpgsql
as $$
declare
  v_creada_en timestamptz;
  v_item record;
begin
  select created_at into v_creada_en from ventas where id = p_venta_id;
  if v_creada_en is null then
    raise exception 'Venta no encontrada';
  end if;
  if now() - v_creada_en > interval '2 minutes' then
    raise exception 'Ya pasó el tiempo para deshacer esta venta';
  end if;

  for v_item in
    select vi.item_id, vi.cantidad, vi.costo_unitario, ii.tipo
    from ventas_items vi
    join inventario_items ii on ii.id = vi.item_id
    where vi.venta_id = p_venta_id and vi.item_id is not null
  loop
    if v_item.tipo = 'producto' then
      insert into inventario_lotes (item_id, cantidad_disponible, costo_unitario)
      values (v_item.item_id, v_item.cantidad, coalesce(v_item.costo_unitario, 0));

      insert into inventario_movimientos (item_id, tipo, motivo, cantidad, nota)
      values (v_item.item_id, 'entrada', 'devolucion', v_item.cantidad, 'Venta deshecha');

      update inventario_items
      set cantidad = cantidad + v_item.cantidad
      where id = v_item.item_id;
    end if;
  end loop;

  delete from ventas_items where venta_id = p_venta_id;
  delete from ventas where id = p_venta_id;
end;
$$;

-- Carga masiva de ventas históricas: para una empresa que migra desde otra
-- herramienta (o una hoja de Excel) y quiere conservar su historial de
-- ventas. Por defecto (p_descontar_inventario = false) estas ventas NUNCA
-- descuentan inventario ni recalculan costo por FIFO — para migrar ventas
-- que ya pasaron de verdad en el sistema anterior del cliente, donde volver
-- a descontarlas duplicaría el efecto. Si p_descontar_inventario = true, se
-- comportan como ventas reales (registrar_venta()): sí descuentan stock por
-- FIFO y bloquean la fila si no hay suficiente — útil para cargar ventas
-- recientes en lote (ej. de un turno de noche) que sí deben afectar el
-- inventario actual. Como toda la carga corre en una sola transacción, si
-- una fila falla por falta de stock en ese modo, NINGUNA fila se importa.
-- Cada fila es una venta de un solo producto (una fila del CSV = una línea
-- vendida); si el producto no existe en el catálogo, la venta igual se
-- guarda, solo queda sin ligar a inventario. Devuelve cuántas se importaron.
create or replace function importar_ventas_historicas(
  p_empresa_id uuid,
  p_ventas jsonb,  -- [{"fecha":"2026-03-01","cliente_nombre":"...","cliente_telefono":"...","cliente_email":"...","producto":"...","cantidad":1,"precio_unitario":1000,"costo_unitario":700,"metodo_pago":"efectivo"}, ...]
  p_descontar_inventario boolean default false
)
returns int
language plpgsql
as $$
declare
  v_fila jsonb;
  v_item_id uuid;
  v_contacto_id uuid;
  v_venta_id uuid;
  v_importadas int := 0;
  v_cantidad numeric;
  v_precio numeric;
  v_costo numeric;
begin
  perform set_config('app.importando_historico', (not p_descontar_inventario)::text, true);

  for v_fila in select * from jsonb_array_elements(p_ventas)
  loop
    v_item_id := null;
    if coalesce(v_fila->>'producto', '') <> '' then
      select id into v_item_id
      from inventario_items
      where empresa_id = p_empresa_id
        and lower(unaccent(nombre)) = lower(unaccent(v_fila->>'producto'))
      limit 1;
    end if;

    v_contacto_id := null;
    if coalesce(v_fila->>'cliente_telefono', '') <> '' then
      select id into v_contacto_id
      from crm_contactos
      where empresa_id = p_empresa_id and telefono = (v_fila->>'cliente_telefono')
      limit 1;

      if v_contacto_id is null then
        insert into crm_contactos (empresa_id, nombre, telefono, email, etapa_id)
        values (
          p_empresa_id,
          coalesce(nullif(v_fila->>'cliente_nombre', ''), 'Cliente sin nombre'),
          v_fila->>'cliente_telefono',
          nullif(v_fila->>'cliente_email', ''),
          etapa_cierre_crm(p_empresa_id)
        )
        returning id into v_contacto_id;
      else
        update crm_contactos set etapa_id = etapa_cierre_crm(p_empresa_id) where id = v_contacto_id;
      end if;
    end if;

    v_cantidad := (v_fila->>'cantidad')::numeric;
    v_precio := (v_fila->>'precio_unitario')::numeric;
    v_costo := nullif(v_fila->>'costo_unitario', '')::numeric;
    if v_costo is null and v_item_id is not null then
      select costo into v_costo from inventario_items where id = v_item_id;
    end if;

    insert into ventas (empresa_id, fecha, monto, contacto_id, cliente_nombre, metodo_pago)
    values (
      p_empresa_id,
      (v_fila->>'fecha')::timestamptz,
      v_cantidad * v_precio,
      v_contacto_id,
      nullif(v_fila->>'cliente_nombre', ''),
      nullif(v_fila->>'metodo_pago', '')
    )
    returning id into v_venta_id;

    insert into ventas_items (venta_id, item_id, nombre_libre, cantidad, precio_unitario, costo_unitario)
    values (
      v_venta_id,
      v_item_id,
      case when v_item_id is null then nullif(v_fila->>'producto', '') end,
      v_cantidad,
      v_precio,
      v_costo
    );

    v_importadas := v_importadas + 1;
  end loop;

  return v_importadas;
end;
$$;

-- Tamaño total de la base de datos, en bytes — para el panel de
-- administrador (sección "Uso de la plataforma"). No expone nada de ninguna
-- empresa en particular, solo un número agregado de toda la base.
create or replace function tamano_base_datos()
returns bigint
language sql
stable
as $$
  select pg_database_size(current_database());
$$;
