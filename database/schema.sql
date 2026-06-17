-- Tabla principal de tickets
create table tickets (
  id            text primary key,
  source        text not null,
  title         text not null,
  description   text,
  priority      text,
  user_email    text,
  status        text default 'received',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Tabla de análisis generados por el LLM
create table analyses (
  id                      uuid primary key default gen_random_uuid(),
  ticket_id               text references tickets(id),
  summary                 text,
  category                text,
  severity                text,
  root_cause              text,
  fix_script              text,
  fix_instructions        text,
  escalate                boolean default false,
  escalate_reason         text,
  estimated_time_minutes  int,
  created_at              timestamptz default now()
);

-- Tabla de acciones ejecutadas
create table actions (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     text references tickets(id),
  action_type   text,
  platform      text,
  status        text default 'pending',
  result        jsonb,
  created_at    timestamptz default now()
);

-- Activar realtime en todas las tablas
alter publication supabase_realtime add table tickets;
alter publication supabase_realtime add table analyses;
alter publication supabase_realtime add table actions;

-- Índices para consultas rápidas
create index idx_tickets_status   on tickets(status);
create index idx_tickets_source   on tickets(source);
create index idx_analyses_ticket  on analyses(ticket_id);
create index idx_actions_ticket   on actions(ticket_id);