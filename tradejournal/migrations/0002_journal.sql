-- Per-user trade journal. JSONB keeps the existing client shape intact
-- so open/close/cash mutations stay one round-trip.
create table if not exists journal_state (
  user_id          text primary key,
  starting_equity  numeric not null default 4000,
  trades           jsonb not null default '[]'::jsonb,
  cash_moves       jsonb not null default '[]'::jsonb,
  updated_at       timestamptz not null default now()
);
