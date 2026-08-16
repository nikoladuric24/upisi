-- e-Upisi / Postani student - trajni 4-znamenkasti PIN za prijavu ucenika.
-- Pokrenuti u Supabase SQL Editoru u zajednickom projektu.

create table if not exists public.admissions_login_pins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  portal_type text not null check (portal_type in ('SECONDARY_ADMISSIONS', 'FACULTY_ADMISSIONS')),
  phone_country text not null default '+385',
  phone_number text not null,
  pin_hash text not null,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, portal_type)
);

create index if not exists admissions_login_pins_email_idx
  on public.admissions_login_pins (lower(email));

alter table public.admissions_login_pins enable row level security;

drop policy if exists "Service role manages admissions pins"
on public.admissions_login_pins;

create policy "Service role manages admissions pins"
on public.admissions_login_pins
for all
to service_role
using (true)
with check (true);

notify pgrst, 'reload schema';
