-- Alliance AI Agent Portal — Supabase schema
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Auth itself needs no setup here — Supabase's built-in `auth.users` table and email
-- magic-link sign-in are used as-is (Dashboard -> Authentication -> Providers -> Email should
-- be enabled, which it is by default on a new project).
--
-- This creates one table: `proposals`, used by the portal's "Save proposal" / "My proposals"
-- feature to persist a finished draft (plus its Compliance Review and Red Team output) per
-- signed-in user, so it's available across devices and after closing the browser — unlike the
-- Cowork version, which only had localStorage.

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled proposal',
  draft_text text,
  compliance_review text,
  red_team_review text,
  toc_used jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_user_id_created_at_idx
  on public.proposals (user_id, created_at desc);

-- Row Level Security: this is what actually protects each user's data — the Supabase anon
-- key used by the frontend is public by design, and these policies are the real access
-- control, not the key itself.
alter table public.proposals enable row level security;

drop policy if exists "Users can view their own proposals" on public.proposals;
create policy "Users can view their own proposals"
  on public.proposals for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own proposals" on public.proposals;
create policy "Users can insert their own proposals"
  on public.proposals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own proposals" on public.proposals;
create policy "Users can update their own proposals"
  on public.proposals for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own proposals" on public.proposals;
create policy "Users can delete their own proposals"
  on public.proposals for delete
  using (auth.uid() = user_id);

-- Keep updated_at current on every update.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists proposals_set_updated_at on public.proposals;
create trigger proposals_set_updated_at
  before update on public.proposals
  for each row execute function public.set_updated_at();
