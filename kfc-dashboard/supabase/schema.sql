-- =====================================================================
-- KFC Dashboard — Esquema Fase 1
-- Ejecutar completo en Supabase: Project > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1) Tabla de control de cargas (histórico de archivos subidos)
-- ---------------------------------------------------------------------
create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('ops', 'ventas', 'devoluciones', 'tiempos')),
  filename text not null,
  row_count integer not null default 0,
  date_range_start date,
  date_range_end date,
  uploaded_by text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) Data de OPERACIONES (ops) — la "principal"
--    Se guardan como columnas propias los campos usados en filtros/KPIs
--    y el resto de las ~80 columnas del reporte se guarda íntegro en
--    "raw" (jsonb) para no perder nada y poder usarlo en fases futuras
--    (tiempos, devoluciones, facturación, etc.) sin rehacer el esquema.
-- ---------------------------------------------------------------------
create table if not exists ops_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  comensal text,
  pais text,
  ciudad text,
  zona text,
  creada_en timestamptz,
  orden_manual boolean,
  orden_planeada boolean,
  hora_estimada_pickup text,
  cooking_time numeric,
  canal text,
  estatus_orden text,
  razon_rechazo text,
  subtotal numeric,
  promo_code text,
  total numeric,
  costo_de_envio numeric,
  metodo_pago text,
  aceptada_en timestamptz,
  cancelada_en timestamptz,
  completada_en timestamptz,
  restaurant_id text,
  restaurant text,
  is_flotilla boolean not null default false,
  repartido_por text,
  estatus_envio text,
  distancia_cliente_restaurante numeric,
  tiempo_total_orden numeric,
  raw jsonb not null default '{}'::jsonb,
  upload_batch_id uuid references uploads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ops_creada_en on ops_orders (creada_en);
create index if not exists idx_ops_ciudad on ops_orders (ciudad);
create index if not exists idx_ops_restaurant on ops_orders (restaurant);
create index if not exists idx_ops_zona on ops_orders (zona);
create index if not exists idx_ops_estatus on ops_orders (estatus_orden);
create index if not exists idx_ops_repartido_por on ops_orders (repartido_por);
create index if not exists idx_ops_total on ops_orders (total);

-- ---------------------------------------------------------------------
-- 3) Data de VENTAS — usada para el desglose de pagos y facturación
-- ---------------------------------------------------------------------
create table if not exists ventas_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  comensal text,
  pais text,
  ciudad text,
  creada_en timestamptz,
  orden_planeada boolean,
  hora_estimada_pickup text,
  cooking_time numeric,
  telefono_comensal text,
  canal text,
  estatus_orden text,
  razon_rechazo text,
  subtotal numeric,
  promo_code text,
  total numeric,
  a_depositar_aproximado numeric,
  costo_envio_fijo numeric,
  costo_envio_distancia_extra numeric,
  costo_envio_facturado numeric,
  metodo_pago text,
  estatus_pago text,
  aceptada_en timestamptz,
  cancelada_en timestamptz,
  completada_en timestamptz,
  restaurant_id text,
  restaurant text,
  is_flotilla boolean not null default false,
  repartido_por text,
  estatus_envio text,
  raw jsonb not null default '{}'::jsonb,
  upload_batch_id uuid references uploads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ventas_creada_en on ventas_orders (creada_en);
create index if not exists idx_ventas_restaurant on ventas_orders (restaurant);
create index if not exists idx_ventas_estatus on ventas_orders (estatus_orden);
create index if not exists idx_ventas_repartido_por on ventas_orders (repartido_por);
create index if not exists idx_ventas_metodo_pago on ventas_orders (metodo_pago);

-- ---------------------------------------------------------------------
-- 4) Helpers de clasificación de estatus (mismo criterio que tu Apps
--    Script: "contiene" en vez de comparación exacta, para tolerar
--    variantes como "Cancelada" / "Cancelado" / "CANCELLED").
-- ---------------------------------------------------------------------
create or replace function is_completada(estatus text) returns boolean
  language sql immutable as $$
    select estatus ilike '%complet%';
$$;

create or replace function is_devuelta(estatus text) returns boolean
  language sql immutable as $$
    select estatus ilike '%return%' or estatus ilike '%devol%';
$$;

create or replace function is_cancelada(estatus text) returns boolean
  language sql immutable as $$
    select estatus ilike '%cancel%' or estatus ilike '%rechaz%' or estatus ilike '%reject%';
$$;

-- ---------------------------------------------------------------------
-- 5) RPC: opciones disponibles para los filtros del dashboard
-- ---------------------------------------------------------------------
create or replace function get_ops_filter_options()
returns table (
  ciudades text[],
  restaurantes text[],
  zonas text[],
  estatus text[],
  repartidores text[]
)
language sql stable as $$
  select
    (select array_agg(distinct ciudad order by ciudad) from ops_orders where ciudad is not null and ciudad <> ''),
    (select array_agg(distinct restaurant order by restaurant) from ops_orders where restaurant is not null and restaurant <> ''),
    (select array_agg(distinct zona order by zona) from ops_orders where zona is not null and zona <> ''),
    (select array_agg(distinct estatus_orden order by estatus_orden) from ops_orders where estatus_orden is not null and estatus_orden <> ''),
    (select array_agg(distinct repartido_por order by repartido_por) from ops_orders where repartido_por is not null and repartido_por <> '');
$$;

-- ---------------------------------------------------------------------
-- 6) RPC: KPIs del panel principal, con todos los filtros opcionales
--    (NULL = sin filtrar por ese campo)
-- ---------------------------------------------------------------------
create or replace function get_ops_summary(
  p_date_from date default null,
  p_date_to date default null,
  p_ciudad text default null,
  p_restaurant text default null,
  p_zona text default null,
  p_estatus text default null,
  p_repartido_por text default null,
  p_orden_planeada boolean default null,
  p_price_min numeric default null,
  p_price_max numeric default null
)
returns table (
  total_ordenes bigint,
  completadas bigint,
  devueltas bigint,
  canceladas bigint,
  pct_completadas numeric,
  pct_devueltas numeric,
  pct_canceladas numeric,
  tiendas_activas bigint,
  ordenes_efectivo bigint,
  ordenes_tarjeta bigint,
  promedio_total numeric,
  suma_total numeric
)
language sql stable as $$
  with base as (
    select *
    from ops_orders o
    where (p_date_from is null or o.creada_en >= p_date_from::timestamptz)
      and (p_date_to is null or o.creada_en < (p_date_to + 1)::timestamptz)
      and (p_ciudad is null or o.ciudad = p_ciudad)
      and (p_restaurant is null or o.restaurant = p_restaurant)
      and (p_zona is null or o.zona = p_zona)
      and (p_estatus is null or o.estatus_orden = p_estatus)
      and (p_repartido_por is null or o.repartido_por = p_repartido_por)
      and (p_orden_planeada is null or o.orden_planeada = p_orden_planeada)
      and (p_price_min is null or o.total >= p_price_min)
      and (p_price_max is null or o.total <= p_price_max)
  )
  select
    count(*) as total_ordenes,
    count(*) filter (where is_completada(estatus_orden)) as completadas,
    count(*) filter (where is_devuelta(estatus_orden)) as devueltas,
    count(*) filter (where is_cancelada(estatus_orden)) as canceladas,
    round(100.0 * count(*) filter (where is_completada(estatus_orden)) / nullif(count(*), 0), 2) as pct_completadas,
    round(100.0 * count(*) filter (where is_devuelta(estatus_orden)) / nullif(count(*), 0), 2) as pct_devueltas,
    round(100.0 * count(*) filter (where is_cancelada(estatus_orden)) / nullif(count(*), 0), 2) as pct_canceladas,
    count(distinct restaurant) as tiendas_activas,
    count(*) filter (where metodo_pago ilike '%efectivo%' or metodo_pago ilike '%cash%') as ordenes_efectivo,
    count(*) filter (where not (metodo_pago ilike '%efectivo%' or metodo_pago ilike '%cash%') and metodo_pago is not null) as ordenes_tarjeta,
    round(avg(total), 2) as promedio_total,
    round(sum(total), 2) as suma_total
  from base;
$$;

-- ---------------------------------------------------------------------
-- Nota sobre seguridad (RLS):
-- Estas tablas se leen y escriben hoy solo desde el backend de la app
-- (API routes con la service_role key) y desde el dashboard autenticado.
-- Cuando agreguemos Supabase Auth (Fase de secciones privadas), se
-- activará Row Level Security con políticas por usuario/rol. Por ahora,
-- mantenemos RLS desactivado a nivel tabla para no bloquear la Fase 1;
-- NO expongas la anon key con acceso de escritura a estas tablas desde
-- el cliente — las cargas siempre pasan por /api/upload en el servidor.
-- =====================================================================
