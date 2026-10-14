-- Horarios de turnos de retiros internacionales (ver docs/superpowers/specs/2026-10-14-horarios-turnos-design.md).

create table ausencias (
  id          uuid primary key default gen_random_uuid(),
  colaborador text not null,
  tipo        text not null check (tipo in ('vacaciones', 'medica', 'otra')),
  inicio      date not null,
  retorno     date not null,              -- primer día de vuelta (exclusivo)
  nota        text not null default '',
  creado_el   timestamptz not null default now(),
  creado_por  text not null default '',
  check (retorno > inicio)
);
create index ausencias_rango on ausencias (inicio, retorno);

create table horario_turnos (
  fecha          date not null,
  turno          text not null check (turno in ('manana', 'tarde')),
  puesto         text not null check (puesto in ('pen_usd_mxn', 'clp')),
  colaborador    text not null,
  editado_manual boolean not null default false,
  primary key (fecha, turno, puesto)
);

-- Estado de la rotación al INICIO de cada día generado (y del día siguiente al último).
create table horario_estado (
  fecha  date primary key,
  estado jsonb not null
);

create table horario_meses (
  mes          text primary key check (mes ~ '^\d{4}-\d{2}$'),
  generado_el  timestamptz not null default now(),
  generado_por text not null default ''
);

create table horario_enlaces (
  id         text primary key,
  anio       integer not null,
  activo     boolean not null default true,
  creado_el  timestamptz not null default now(),
  creado_por text not null default ''
);
create unique index horario_enlaces_un_activo on horario_enlaces (anio) where activo;

-- Igual que 001: la API REST pública de Supabase no ve estas tablas.
alter table ausencias enable row level security;
alter table horario_turnos enable row level security;
alter table horario_estado enable row level security;
alter table horario_meses enable row level security;
alter table horario_enlaces enable row level security;
