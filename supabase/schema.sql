-- Danish SDE cloud progress. Run once in Supabase Dashboard → SQL Editor.
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  xp integer not null default 0 check (xp >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_activity_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  question_title text not null,
  status text not null default 'unsolved' check (status in ('solved', 'unsolved')),
  solved_at timestamptz,
  interval_days integer not null default 0 check (interval_days >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  next_review_at timestamptz,
  last_review_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  question_title text not null,
  grade text not null check (grade in ('again', 'hard', 'good', 'easy')),
  interval_days integer not null,
  completed_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.question_progress enable row level security;
alter table public.review_events enable row level security;

create policy "profile owner access" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "progress owner access" on public.question_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "review owner access" on public.review_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
