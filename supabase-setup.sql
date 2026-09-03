-- Run this once in your Supabase project's SQL Editor
-- (Supabase dashboard → SQL Editor → New query → paste → Run)

create table if not exists projects (
  id          text primary key,
  data        jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

-- Allow anonymous read/write.
-- The URL itself is the access control for now.
alter table projects enable row level security;

create policy "public_all" on projects
  for all
  using (true)
  with check (true);

-- Optional: index for faster ordering
create index if not exists projects_updated_at_idx
  on projects (updated_at desc);
