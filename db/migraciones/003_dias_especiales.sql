-- Días con turnos reducidos (Navidad, 31/12…). Ver lib/horario.ts (DiaEspecial).

create table dias_especiales (
  fecha           date primary key,
  personas_manana smallint not null check (personas_manana between 0 and 2),
  personas_tarde  smallint not null check (personas_tarde between 0 and 2),
  horario_manana  text not null default '',
  horario_tarde   text not null default '',
  nota            text not null default '',
  creado_el       timestamptz not null default now(),
  creado_por      text not null default ''
);

alter table dias_especiales enable row level security;
