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
  tipo_negocio text,                          -- 'ferreteria', 'peluqueria', etc.
  plan_id uuid references planes(id),
  modulos_activos text[] default '{}',        -- ajuste manual sobre el plan
  pagina_entrada text not null default 'ventas'
    check (pagina_entrada in ('ventas','crm','inventario','pyg','insights')),  -- en qué módulo aterriza al iniciar sesión; lo decide el diagnóstico, no el cliente
  fecha_diagnostico date,
  -- Catálogo fijo de métodos de pago (igual para toda la plataforma); cada
  -- empresa activa cuáles acepta. Editable por ahora en la tabla de Supabase.
  metodos_pago_disponibles text[] not null default '{efectivo,tarjeta,transferencia}'
    check (metodos_pago_disponibles <@ array['efectivo','tarjeta','transferencia','nequi','daviplata','otro']::text[]),
  logo_path text,  -- ruta dentro del bucket 'empresas-logos' de Supabase Storage; opcional
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 3. PERFILES — une el login de Supabase (auth.users) con una empresa y un rol
-- ------------------------------------------------------------
create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid references empresas(id),
  rol text not null default 'cliente' check (rol in ('cliente','admin')),
  nombre text,
  debe_cambiar_password boolean not null default true,  -- true al crear la cuenta; se apaga solo cuando cambia su contraseña por primera vez
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
-- ------------------------------------------------------------
create table crm_contactos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  nombre text not null,
  telefono text,
  email text,
  etapa_pipeline text default 'nuevo' check (etapa_pipeline in ('nuevo','contactado','propuesta','cerrado')),
  atributos jsonb default '{}',  -- lo que varía por tipo de negocio: modelo de vehículo, preferencias, alergias, etc.
  created_at timestamptz default now()
);

create table crm_interacciones (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid references crm_contactos(id) not null,
  fecha date default current_date,
  tipo text check (tipo in ('llamada','email','reunion','otro')),
  nota text
);

-- Una venta puede quedar asociada a un contacto del CRM (opcional)
alter table ventas add column contacto_id uuid references crm_contactos(id);

-- ------------------------------------------------------------
-- 8. INVENTARIO
-- ------------------------------------------------------------
create table inventario_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
  nombre text not null,
  sku text,
  categoria text,
  tipo text not null default 'producto' check (tipo in ('producto','servicio')),  -- 'servicio' no descuenta inventario (ej. mano de obra)
  unidad text not null default 'unidad',  -- 'unidad', 'galon', 'litro', 'ml', 'kg', 'caja', etc. — solo para mostrar, no hace conversiones sola
  cantidad numeric(12,2) default 0,
  costo numeric(12,2),
  precio_venta numeric(12,2),
  foto_path text,  -- ruta dentro del bucket 'inventario-fotos' de Supabase Storage; opcional
  atributos jsonb default '{}',  -- lo que varía por tipo de negocio: fecha de vencimiento, modelo compatible, etc.
  created_at timestamptz default now()
);

create table inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references inventario_items(id) not null,
  tipo text not null check (tipo in ('entrada','salida')),
  motivo text check (motivo in ('compra','ajuste','devolucion','trasvase')),  -- solo aplica a entradas; 'compra' genera un gasto automático
  cantidad numeric(12,2) not null,
  fecha date default current_date,
  nota text
);

-- Detalle de cada venta: qué producto del inventario se vendió y cuánto.
-- item_id queda vacío si el negocio no maneja inventario físico (ej. un servicio de peluquería).
create table ventas_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid references ventas(id) not null,
  item_id uuid references inventario_items(id),
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
-- Si el producto vendido es compuesto (tiene receta en inventario_receta), no tiene stock
-- propio: en vez de descontarse a sí mismo, se descuentan sus insumos según la receta × la
-- cantidad vendida — la "producción" y la venta pasan a ser una sola operación automática.
create or replace function descontar_inventario()
returns trigger language plpgsql as $$
declare
  v_tipo text;
  v_costo numeric(12,2);
  v_receta record;
begin
  if new.item_id is not null then
    select tipo, costo into v_tipo, v_costo from inventario_items where id = new.item_id;
    new.costo_unitario := v_costo;

    if v_tipo = 'producto' then
      if exists (select 1 from inventario_receta where item_resultante_id = new.item_id) then
        for v_receta in
          select item_insumo_id, cantidad_insumo
          from inventario_receta
          where item_resultante_id = new.item_id
        loop
          insert into inventario_movimientos (item_id, tipo, motivo, cantidad, nota)
          values (
            v_receta.item_insumo_id, 'salida', 'trasvase',
            v_receta.cantidad_insumo * new.cantidad,
            'Consumido al vender ' || new.cantidad || ' unidad(es) de un producto compuesto'
          );

          update inventario_items
          set cantidad = cantidad - (v_receta.cantidad_insumo * new.cantidad)
          where id = v_receta.item_insumo_id;
        end loop;
      else
        insert into inventario_movimientos (item_id, tipo, cantidad, nota)
        values (new.item_id, 'salida', new.cantidad, 'Descuento automático por venta');

        update inventario_items
        set cantidad = cantidad - new.cantidad
        where id = new.item_id;
      end if;
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
  p_categoria text
)
returns void
language sql
as $$
  update inventario_items
  set cantidad = cantidad + p_cantidad_agregada,
      costo = p_costo,
      precio_venta = p_precio_venta,
      categoria = p_categoria
  where id = p_item_id;
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
  v_diferencia numeric(12,2);
begin
  select cantidad into v_cantidad_actual from inventario_items where id = p_item_id;
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
end;
$$;

-- ------------------------------------------------------------
-- 9. FINANZAS — alimenta el estado de pérdidas y ganancias
-- ------------------------------------------------------------
create table finanzas_movimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) not null,
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
create or replace view vista_estado_resultados as
with periodos as (
  select empresa_id, date_trunc('month', fecha) as mes from ventas
  union
  select empresa_id, date_trunc('month', fecha) as mes from finanzas_movimientos
),
ventas_mes as (
  select empresa_id, date_trunc('month', fecha) as mes, sum(monto) as ingresos
  from ventas group by 1, 2
),
costo_ventas_mes as (
  select v.empresa_id, date_trunc('month', v.fecha) as mes,
    sum(vi.cantidad * coalesce(vi.costo_unitario, 0)) as costo_ventas
  from ventas v
  join ventas_items vi on vi.venta_id = v.id
  group by 1, 2
),
otros_mes as (
  select empresa_id, date_trunc('month', fecha) as mes,
    sum(case when tipo = 'ingreso' then monto else 0 end) as ingresos_otros,
    sum(case when tipo = 'gasto' then monto else 0 end) as gastos_operacionales
  from finanzas_movimientos group by 1, 2
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
   + coalesce(om.ingresos_otros, 0) - coalesce(om.gastos_operacionales, 0)) as utilidad_neta
from periodos p
left join ventas_mes vm on vm.empresa_id = p.empresa_id and vm.mes = p.mes
left join costo_ventas_mes cv on cv.empresa_id = p.empresa_id and cv.mes = p.mes
left join otros_mes om on om.empresa_id = p.empresa_id and om.mes = p.mes;

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
  created_at timestamptz default now()
);

-- Enlaza cada abono/pago (registrado como gasto en finanzas_movimientos,
-- categoría 'pago de deuda') con la deuda a la que corresponde. Nulo
-- para cualquier otro gasto o ingreso que no sea un pago de deuda.
alter table finanzas_movimientos add column pasivo_id uuid references pasivos(id);

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
create or replace view vista_ventas_por_dia as
select
  v.empresa_id,
  v.fecha::date as dia,
  case extract(dow from v.fecha::date)::int
    when 0 then 'Domingo' when 1 then 'Lunes' when 2 then 'Martes'
    when 3 then 'Miércoles' when 4 then 'Jueves' when 5 then 'Viernes'
    when 6 then 'Sábado'
  end as dia_semana,
  (f.fecha is not null) as es_festivo,
  f.nombre as nombre_festivo,
  count(v.id) as numero_ventas,
  sum(v.monto) as total_vendido
from ventas v
left join festivos f on f.fecha = v.fecha::date
group by v.empresa_id, v.fecha::date, f.fecha, f.nombre;

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
alter table perfiles enable row level security;
alter table diagnosticos enable row level security;
alter table suscripciones enable row level security;
alter table ventas enable row level security;
alter table ventas_items enable row level security;
alter table crm_contactos enable row level security;
alter table crm_interacciones enable row level security;
alter table inventario_items enable row level security;
alter table inventario_movimientos enable row level security;
alter table inventario_receta enable row level security;
alter table finanzas_movimientos enable row level security;
alter table pasivos enable row level security;
alter table promociones enable row level security;
alter table promocion_items enable row level security;

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

-- Políticas: mismo patrón repetido en cada tabla con empresa_id
create policy "ver mi propia empresa" on empresas
  for select using (id = mi_empresa_id() or es_admin());

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

create policy "ver mis diagnosticos" on diagnosticos
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis suscripciones" on suscripciones
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis ventas" on ventas
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mi crm" on crm_contactos
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mi inventario" on inventario_items
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis finanzas" on finanzas_movimientos
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis pasivos" on pasivos
  for all using (empresa_id = mi_empresa_id() or es_admin());

create policy "ver mis promociones" on promociones
  for all using (empresa_id = mi_empresa_id() or es_admin());

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
  p_fecha timestamptz default null,  -- si la persona cambió la fecha/hora sugerida; null = usar el momento actual
  p_metodo_pago text default null    -- uno de los valores en empresas.metodos_pago_disponibles
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
        etapa_pipeline = 'cerrado'
    where id = v_contacto_id;
  elsif coalesce(p_cliente_nombre, '') <> '' then
    select id into v_contacto_id
    from crm_contactos
    where empresa_id = p_empresa_id and telefono = p_cliente_telefono
    limit 1;

    if v_contacto_id is null then
      insert into crm_contactos (empresa_id, nombre, telefono, email, atributos, etapa_pipeline)
      values (p_empresa_id, p_cliente_nombre, p_cliente_telefono, p_cliente_email, p_atributos_cliente, 'cerrado')
      returning id into v_contacto_id;
    else
      update crm_contactos
      set atributos = atributos || p_atributos_cliente,
          nombre = coalesce(p_cliente_nombre, nombre),
          email = coalesce(p_cliente_email, email),
          etapa_pipeline = 'cerrado'
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
  insert into ventas (empresa_id, monto, contacto_id, cliente_nombre, atributos, fecha, metodo_pago)
  values (p_empresa_id, v_monto_total, v_contacto_id, p_cliente_nombre, p_atributos_venta, coalesce(p_fecha, now()), p_metodo_pago)
  returning id into v_venta_id;

  -- 4. Agregar cada producto o servicio vendido, con su promoción si aplica
  --    (esto dispara el descuento de inventario, solo para productos)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into ventas_items (venta_id, item_id, cantidad, precio_unitario, promocion_id, descuento_aplicado)
    values (
      v_venta_id,
      (v_item->>'item_id')::uuid,
      (v_item->>'cantidad')::numeric,
      (v_item->>'precio_unitario')::numeric,
      nullif(v_item->>'promocion_id','')::uuid,
      coalesce((v_item->>'descuento_aplicado')::numeric, 0)
    );
  end loop;

  return v_venta_id;
end;
$$;
