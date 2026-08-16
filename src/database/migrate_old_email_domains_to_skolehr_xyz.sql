-- Migracija starih e-mail nastavaka na @skolehr.xyz.
-- Pokrenuti u Supabase SQL Editoru zajednickog projekta.
--
-- Pokriva varijante:
--   @eskole.hr
--   @eskole.me
--   @eskolehr.hr
--   @eskolehr.me
--   @eskolehr.xyz
--   @eskolehr.

begin;

create or replace function public.normalize_skolehr_email(input_email text)
returns text
language sql
immutable
as $$
  select case
    when input_email is null then null
    else regexp_replace(
      lower(trim(input_email)),
      '@(eskole\.hr|eskole\.me|eskolehr\.hr|eskolehr\.me|eskolehr\.xyz|eskolehr\.)$',
      '@skolehr.xyz',
      'i'
    )
  end
$$;

-- Supabase Auth korisnici.
update auth.users
set
  email = public.normalize_skolehr_email(email),
  raw_user_meta_data = case
    when raw_user_meta_data ? 'email' then
      jsonb_set(raw_user_meta_data, '{email}', to_jsonb(public.normalize_skolehr_email(raw_user_meta_data->>'email')))
    else raw_user_meta_data
  end,
  updated_at = now()
where lower(email) ~ '@(eskole\.hr|eskole\.me|eskolehr\.hr|eskolehr\.me|eskolehr\.xyz|eskolehr\.)$';

-- Supabase Auth identities.
update auth.identities
set
  identity_data = case
    when identity_data ? 'email' then
      jsonb_set(identity_data, '{email}', to_jsonb(public.normalize_skolehr_email(identity_data->>'email')))
    else identity_data
  end,
  updated_at = now()
where identity_data->>'email' is not null
  and lower(identity_data->>'email') ~ '@(eskole\.hr|eskole\.me|eskolehr\.hr|eskolehr\.me|eskolehr\.xyz|eskolehr\.)$';

-- Public tablice koje se koriste kroz e-Dnevnik/e-Maticu/e-Upise.
do $$
declare
  target record;
begin
  for target in
    select table_schema, table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and data_type in ('text', 'character varying')
      and column_name in ('email', 'contact_email', 'admin_email', 'guardian_email', 'username')
  loop
    execute format(
      'update %I.%I set %I = public.normalize_skolehr_email(%I) where lower(%I) ~ %L',
      target.table_schema,
      target.table_name,
      target.column_name,
      target.column_name,
      target.column_name,
      '@(eskole\.hr|eskole\.me|eskolehr\.hr|eskolehr\.me|eskolehr\.xyz|eskolehr\.)$'
    );
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
