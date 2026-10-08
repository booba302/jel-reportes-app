-- Retiros: un registro por operación. El id es el mismo de Firestore
-- (MONEDA_JUGADOR_TIMESTAMP), así recargar un día actualiza en vez de duplicar.
create table retiros (
  id                text primary key,
  fecha_reporte     date not null,
  moneda            text not null,
  operador          text not null,
  jugador           text not null default '',
  alias             text not null default '',
  cantidad          double precision not null default 0,
  nivel             text not null default '',
  fecha_operacion   text not null default '',  -- tal como vino: "2026-03-01 14:35:00"
  update_date       text not null default '',
  hora              smallint,                  -- hora de fecha_operacion; null si no tiene
  tiempo            double precision not null default 0,
  cumple            boolean not null default false,
  comentario_brecha text not null default '',  -- solo lo escribe la auditoría
  autopago  boolean generated always as (operador = 'Autopago') stored,
  exonerado boolean generated always as (comentario_brecha ~ '\S') stored,
  vip       boolean generated always as (btrim(nivel, E' \t\r\n') in ('Nivel 2', 'Nivel 3', 'Nivel 4')) stored
);
create index retiros_fecha_moneda on retiros (fecha_reporte, moneda);
create index retiros_moneda_fecha on retiros (moneda, fecha_reporte);
create index retiros_operador_fecha on retiros (operador, fecha_reporte);

create table historial_reportes (
  id              text primary key,            -- MONEDA_YYYY-MM-DD
  fecha_reporte   date not null,
  moneda          text not null,
  subido_el       timestamptz not null,
  subido_por      text not null default '',
  total_registros integer not null default 0
);
create index historial_moneda_fecha on historial_reportes (moneda, fecha_reporte);

create table observaciones_diarias (
  moneda              text not null,
  fecha               date not null,
  observacion         text not null default '',
  fecha_actualizacion timestamptz not null default now(),
  primary key (moneda, fecha)
);

-- La API REST pública de Supabase no debe ver estas tablas: RLS sin políticas
-- la bloquea. La app entra como dueña de las tablas, que no está sujeta a RLS.
alter table retiros enable row level security;
alter table historial_reportes enable row level security;
alter table observaciones_diarias enable row level security;
