-- Supabase Schema for Bessi
-- Run this in Supabase SQL Editor (supabase.com -> Your Project -> SQL Editor)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (profiles linked to Supabase Auth)
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  nafn text,
  mynd text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Verkefni (Projects)
create table public.verkefni (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete set null,
  verkefnanumer text,
  nafn text not null,
  mynd text,
  framleidsla text,
  produser text,
  produser_simi text,
  produser_netfang text,
  stofa text,
  tengill_nafn text,
  tengill_simi text,
  tengill_netfang text,
  art_director text,
  art_director_simi text,
  copywriter text,
  copywriter_simi text,
  lesari text,
  lesari_simi text,
  lesari_netfang text,
  handrit text,
  google_doc_url text,
  google_doc_id text,
  tonlist_titill text,
  tonlist_heimild text,
  tonlist_url text,
  tonlist_kostnadur numeric default 0,
  stada text default 'Í vinnslu',
  athugasemdir text,
  payday_tengill text,
  dropbox_slod text,
  mottekid text,
  skilad text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tímaskráning (Time tracking)
create table public.timaskraning (
  id bigint generated always as identity primary key,
  verkefni_id bigint references public.verkefni(id) on delete cascade not null,
  tegund text not null,
  titill text,
  lysing text,
  timi_minutur integer,
  dagsetning text,
  created_at timestamptz default now()
);

-- Auglýsingastofur (Ad agencies)
create table public.auglysingar_stofur (
  id bigint generated always as identity primary key,
  nafn text not null unique,
  netfang text,
  simi text
);

-- Framleiðsla (Production companies)
create table public.framleidsla (
  id bigint generated always as identity primary key,
  nafn text not null unique,
  netfang text,
  simi text
);

-- Lesendur (Voice actors)
create table public.lesendur (
  id bigint generated always as identity primary key,
  nafn text not null,
  netfang text,
  simi text
);

-- Aðkeypt tónlist (Licensed music)
create table public.adkeypt (
  id bigint generated always as identity primary key,
  verkefni_id bigint references public.verkefni(id) on delete cascade not null,
  titill text,
  heimild text,
  url text,
  kostnadur integer default 0,
  created_at timestamptz default now()
);

-- Insert sample data
insert into public.auglysingar_stofur (nafn) values
  ('Pipar TBWA'),
  ('Íslenska'),
  ('Brandenburg'),
  ('Hvíta húsið'),
  ('Jónsson & Le''macks'),
  ('Mannvit'),
  ('Sahara')
on conflict (nafn) do nothing;

insert into public.framleidsla (nafn) values
  ('Sagafilm'),
  ('Truenorth'),
  ('RVK Studios'),
  ('Glassriver'),
  ('Ísland í dag')
on conflict (nafn) do nothing;

-- Row Level Security (RLS) - THIS IS THE MAGIC!

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.verkefni enable row level security;
alter table public.timaskraning enable row level security;
alter table public.adkeypt enable row level security;
alter table public.auglysingar_stofur enable row level security;
alter table public.framleidsla enable row level security;
alter table public.lesendur enable row level security;

-- Users: can read own profile, admins can read all
create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- Verkefni: users see their own, admins see all
create policy "Users can view own projects" on public.verkefni
  for select using (
    user_id = auth.uid()
    or user_id is null
    or exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

create policy "Users can insert own projects" on public.verkefni
  for insert with check (user_id = auth.uid());

create policy "Users can update own projects" on public.verkefni
  for update using (
    user_id = auth.uid()
    or exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

create policy "Users can delete own projects" on public.verkefni
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- Timaskraning: follow verkefni access
create policy "Users can view time entries for their projects" on public.timaskraning
  for select using (
    exists (
      select 1 from public.verkefni
      where verkefni.id = timaskraning.verkefni_id
      and (verkefni.user_id = auth.uid() or verkefni.user_id is null or exists (select 1 from public.users where id = auth.uid() and is_admin = true))
    )
  );

create policy "Users can insert time entries" on public.timaskraning
  for insert with check (
    exists (
      select 1 from public.verkefni
      where verkefni.id = verkefni_id
      and (verkefni.user_id = auth.uid() or exists (select 1 from public.users where id = auth.uid() and is_admin = true))
    )
  );

create policy "Users can delete time entries" on public.timaskraning
  for delete using (
    exists (
      select 1 from public.verkefni
      where verkefni.id = timaskraning.verkefni_id
      and (verkefni.user_id = auth.uid() or exists (select 1 from public.users where id = auth.uid() and is_admin = true))
    )
  );

-- Adkeypt: follow verkefni access
create policy "Users can view adkeypt for their projects" on public.adkeypt
  for select using (
    exists (
      select 1 from public.verkefni
      where verkefni.id = adkeypt.verkefni_id
      and (verkefni.user_id = auth.uid() or verkefni.user_id is null or exists (select 1 from public.users where id = auth.uid() and is_admin = true))
    )
  );

create policy "Users can insert adkeypt" on public.adkeypt
  for insert with check (
    exists (
      select 1 from public.verkefni
      where verkefni.id = verkefni_id
      and (verkefni.user_id = auth.uid() or exists (select 1 from public.users where id = auth.uid() and is_admin = true))
    )
  );

create policy "Users can delete adkeypt" on public.adkeypt
  for delete using (
    exists (
      select 1 from public.verkefni
      where verkefni.id = adkeypt.verkefni_id
      and (verkefni.user_id = auth.uid() or exists (select 1 from public.users where id = auth.uid() and is_admin = true))
    )
  );

-- Lookup tables: everyone can read
create policy "Anyone can view stofur" on public.auglysingar_stofur for select using (true);
create policy "Anyone can view framleidsla" on public.framleidsla for select using (true);
create policy "Anyone can view lesendur" on public.lesendur for select using (true);

-- Function to auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, nafn, mynd)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger verkefni_updated_at
  before update on public.verkefni
  for each row execute procedure public.update_updated_at();
