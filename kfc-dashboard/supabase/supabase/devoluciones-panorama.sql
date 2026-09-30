-- =====================================================================
-- Devoluciones — Panorama general (parte 2 del SQL)
-- Ejecutar completo en Supabase: SQL Editor > New query > Run.
-- Se puede correr más de una vez sin problema.
-- =====================================================================

-- 1) Estado y ciudad, sacados de la dirección (para filtrar y agrupar)
alter table tiempos_orders add column if not exists estado text;
alter table tiempos_orders add column if not exists ciudad text;
create index if not exists idx_tiempos_estado on tiempos_orders (estado);

create or replace function tiempos_orders_derivar()
returns trigger language plpgsql as $$
declare
  partes text[];
  n int;
begin
  partes := string_to_array(coalesce(new.direccion, ''), ',');
  n := coalesce(array_length(partes, 1), 0);

  new.calle := trim(coalesce(partes[1], ''));
  if n >= 5 then
    new.colonia := trim(partes[n - 3]);
    new.cp := trim(partes[n - 2]);
  else
    new.colonia := '';
    new.cp := '';
  end if;
  new.estado := nullif(upper(trim(coalesce(partes[n], ''))), '');
  new.ciudad := case when n >= 2 then nullif(upper(trim(partes[n - 1])), '') end;
  if new.estado in ('MÉXICO', 'MEXICO') then new.estado := 'ESTADO DE MEXICO'; end if;

  new.cp_faltante := new.cp = '';
  new.cp_incompleto := new.cp ~ '^[0-9]{1,4}$';
  new.calle_sin_numero := new.calle !~ '[0-9]';
  new.colonia_vacia := new.colonia = '';
  new.problema_direccion := new.cp_faltante or new.cp_incompleto
                            or new.calle_sin_numero or new.colonia_vacia;

  new.direccion_norm := upper(trim(coalesce(new.direccion, '')));
  new.direccion_corta := upper(new.calle || ', ' || new.colonia);
  new.telefono := nullif(regexp_replace(coalesce(new.telefono_raw, ''), '[^0-9]', '', 'g'), '');
  new.is_flotilla := coalesce(trim(new.restaurant), '') ~* '\sMF$';
  return new;
end;
$$;

-- Llenar estado/ciudad en lo que ya estaba cargado (el trigger recalcula todo)
update tiempos_orders set estado = null where estado is null;

-- 2) Opciones de filtro y rango de fechas con data
create or replace function get_dev_filtros()
returns jsonb
language sql stable set timezone to 'UTC' as $$
  select jsonb_build_object(
    'estados', (select coalesce(jsonb_agg(e order by e), '[]') from
                 (select distinct estado e from tiempos_orders where estado is not null) x),
    'tiendas', (select coalesce(jsonb_agg(t order by t), '[]') from
                 (select distinct restaurant t from tiempos_orders where restaurant is not null) x),
    'repartidores', (select coalesce(jsonb_agg(r order by r), '[]') from
                 (select distinct coalesce(nullif(repartido_por, ''), 'SIN ASIGNAR') r from tiempos_orders) x),
    'fecha_min', (select min(creada_en)::date from tiempos_orders),
    'fecha_max', (select max(creada_en)::date from tiempos_orders)
  );
$$;

-- 3) Panorama del periodo elegido (KPIs, por día, mapa, motivos, repartidor)
create or replace function get_dev_panorama(
  p_desde date,
  p_hasta date,
  p_estados text[] default null,
  p_tiendas text[] default null,
  p_repartidores text[] default null,
  p_incluir_returning boolean default false,
  p_incluir_rechazadas boolean default true
)
returns jsonb
language plpgsql stable set timezone to 'UTC' as $$
declare
  v_dias int := (p_hasta - p_desde) + 1;
  v_res jsonb;
begin
  with
  base as (
    select o.*,
      dev_es_devuelta(o.estatus_orden, p_incluir_returning) as dev,
      dev_es_cancelada(o.estatus_orden, p_incluir_rechazadas) as canc,
      upper(coalesce(o.metodo_pago, '')) like '%CASH%' as efectivo,
      coalesce(nullif(o.repartido_por, ''), 'SIN ASIGNAR') as repartidor
    from tiempos_orders o
    where (p_estados is null or cardinality(p_estados) = 0 or o.estado = any(p_estados))
      and (p_tiendas is null or cardinality(p_tiendas) = 0 or o.restaurant = any(p_tiendas))
      and (p_repartidores is null or cardinality(p_repartidores) = 0
           or coalesce(nullif(o.repartido_por, ''), 'SIN ASIGNAR') = any(p_repartidores))
      and o.creada_en >= (p_desde - v_dias)::timestamptz
      and o.creada_en < (p_hasta + 1)::timestamptz
  ),
  per as (select * from base where creada_en >= p_desde::timestamptz),
  ant as (select * from base where creada_en < p_desde::timestamptz),
  tiendas as (
    select
      restaurant,
      count(*) as ordenes,
      count(*) filter (where dev) as devueltas,
      count(*) filter (where canc) as canceladas,
      coalesce(sum(total) filter (where dev), 0) as monto_devuelto,
      percentile_cont(0.5) within group (order by latitud)
        filter (where latitud between 14 and 33 and longitud between -118 and -86) as lat,
      percentile_cont(0.5) within group (order by longitud)
        filter (where latitud between 14 and 33 and longitud between -118 and -86) as lon
    from per
    group by restaurant
  )
  select jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'total', count(*),
        'devueltas', count(*) filter (where dev),
        'canceladas', count(*) filter (where upper(coalesce(estatus_orden, '')) = 'CANCELLED'),
        'rechazadas', count(*) filter (where upper(coalesce(estatus_orden, '')) = 'REJECTED'),
        'canceladas_criterio', count(*) filter (where canc),
        'pct_dev', count(*) filter (where dev)::numeric / nullif(count(*), 0),
        'pct_canc', count(*) filter (where canc)::numeric / nullif(count(*), 0),
        'monto_devuelto', coalesce(sum(total) filter (where dev), 0),
        'dev_efectivo', count(*) filter (where dev and efectivo),
        'tiendas_con_ordenes', count(distinct restaurant),
        'tiendas_sobre_meta', (select count(*) from tiendas
                               where ordenes >= 50 and devueltas::numeric / ordenes > 0.02),
        'tiendas_evaluadas', (select count(*) from tiendas where ordenes >= 50),
        'ant_total', (select count(*) from ant),
        'ant_pct_dev', (select count(*) filter (where dev)::numeric / nullif(count(*), 0) from ant),
        'ant_pct_canc', (select count(*) filter (where canc)::numeric / nullif(count(*), 0) from ant)
      ) from per
    ),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dia', dia, 'total', total, 'devueltas', devueltas, 'canceladas', canceladas,
        'pct_dev', devueltas::numeric / nullif(total, 0),
        'pct_canc', canceladas::numeric / nullif(total, 0)
      ) order by dia)
      from (
        select date(creada_en) as dia, count(*) as total,
          count(*) filter (where dev) as devueltas,
          count(*) filter (where canc) as canceladas
        from per group by 1
      ) d
    ), '[]'::jsonb),
    'tiendas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tienda', restaurant, 'lat', lat, 'lon', lon, 'ordenes', ordenes,
        'devueltas', devueltas, 'canceladas', canceladas, 'monto_devuelto', monto_devuelto,
        'pct_dev', devueltas::numeric / ordenes,
        'pct_problema', (devueltas + canceladas)::numeric / ordenes
      ) order by devueltas desc)
      from tiendas
    ), '[]'::jsonb),
    'puntos', coalesce((
      select jsonb_agg(jsonb_build_array(
        round(latitud::numeric, 5), round(longitud::numeric, 5), restaurant,
        to_char(creada_en, 'DD/MM HH24:MI'), dev_id_corto(order_id), total
      ))
      from (
        select * from per
        where dev and latitud between 14 and 33 and longitud between -118 and -86
        order by creada_en desc
        limit 6000
      ) p
    ), '[]'::jsonb),
    'motivos', coalesce((
      select jsonb_agg(jsonb_build_object('motivo', motivo, 'ordenes', n) order by n desc)
      from (
        select coalesce(nullif(motivo_cancelacion, ''), 'SIN MOTIVO') as motivo, count(*) as n
        from per where canc group by 1
      ) m
    ), '[]'::jsonb),
    'repartidores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'repartidor', repartidor, 'ordenes', ordenes, 'devueltas', devueltas, 'canceladas', canceladas,
        'pct_dev', devueltas::numeric / ordenes, 'pct_canc', canceladas::numeric / ordenes
      ) order by ordenes desc)
      from (
        select repartidor, count(*) as ordenes,
          count(*) filter (where dev) as devueltas,
          count(*) filter (where canc) as canceladas
        from per group by 1
      ) r
    ), '[]'::jsonb),
    'estados', coalesce((
      select jsonb_agg(jsonb_build_object(
        'estado', estado, 'ordenes', ordenes, 'devueltas', devueltas,
        'pct_dev', devueltas::numeric / ordenes
      ) order by devueltas desc)
      from (
        select coalesce(estado, 'SIN ESTADO') as estado, count(*) as ordenes,
          count(*) filter (where dev) as devueltas
        from per group by 1
      ) e
    ), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;
