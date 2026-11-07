-- =====================================================================
-- Snugz · database setup
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Creates the fit_profiles table and locks it so every user can only
-- read and change their OWN measurements (Row Level Security).
-- All measurements are stored in INCHES.
-- =====================================================================

create table if not exists public.fit_profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  name        text,
  gender      text check (gender in ('men', 'women')),
  chest       numeric(5,2),
  shoulder    numeric(5,2),
  sleeve      numeric(5,2),
  waist       numeric(5,2),
  length      numeric(5,2),
  top_fit     text default 'Regular' check (top_fit in ('Snug', 'Regular', 'Relaxed')),
  jeans_fit   text default 'Regular' check (jeans_fit in ('Slim', 'Regular', 'Loose')),
  unit        text default 'in' check (unit in ('in', 'cm')),   -- display preference only
  updated_at  timestamptz not null default now()
);

alter table public.fit_profiles enable row level security;

drop policy if exists "read own profile"   on public.fit_profiles;
drop policy if exists "insert own profile" on public.fit_profiles;
drop policy if exists "update own profile" on public.fit_profiles;
drop policy if exists "delete own profile" on public.fit_profiles;

create policy "read own profile"   on public.fit_profiles for select using (auth.uid() = user_id);
create policy "insert own profile" on public.fit_profiles for insert with check (auth.uid() = user_id);
create policy "update own profile" on public.fit_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own profile" on public.fit_profiles for delete using (auth.uid() = user_id);

-- keep updated_at fresh on every change
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists fit_profiles_touch on public.fit_profiles;
create trigger fit_profiles_touch before update on public.fit_profiles
for each row execute function public.touch_updated_at();
