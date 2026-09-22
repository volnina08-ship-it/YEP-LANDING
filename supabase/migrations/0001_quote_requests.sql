-- Ajánlatkérések a YEP Content landing page-ről (PPC kampány)
-- Alkalmazva a qelmzmzpicsdaiagitsa projekten (2026-09-22). Újratelepítéshez: supabase db push / SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.quote_requests (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- űrlap mezők
  name          text not null check (char_length(btrim(name)) between 2 and 120),
  email         text not null check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone         text check (phone is null or char_length(phone) <= 40),
  company       text check (company is null or char_length(company) <= 120),
  service       text check (service is null or char_length(service) <= 80),
  budget        text check (budget is null or char_length(budget) <= 80),
  project_intro text not null check (char_length(btrim(project_intro)) between 3 and 300),
  message       text check (message is null or char_length(message) <= 3000),
  consent       boolean not null default false check (consent = true),

  -- kampány attribúció (PPC)
  source_url    text check (source_url is null or char_length(source_url) <= 2048),
  referrer      text check (referrer is null or char_length(referrer) <= 2048),
  utm_source    text check (utm_source is null or char_length(utm_source) <= 200),
  utm_medium    text check (utm_medium is null or char_length(utm_medium) <= 200),
  utm_campaign  text check (utm_campaign is null or char_length(utm_campaign) <= 200),
  utm_term      text check (utm_term is null or char_length(utm_term) <= 200),
  utm_content   text check (utm_content is null or char_length(utm_content) <= 200),
  gclid         text check (gclid is null or char_length(gclid) <= 200),
  fbclid        text check (fbclid is null or char_length(fbclid) <= 200),
  user_agent    text check (user_agent is null or char_length(user_agent) <= 512),
  language      text check (language is null or char_length(language) <= 16),

  -- belső státusz (Supabase dashboardon kezelhető)
  status        text not null default 'new' check (status in ('new','contacted','quoted','won','lost'))
);

comment on table public.quote_requests is 'YEP Content landing page – ajánlatkérő űrlap beküldései';

create index if not exists quote_requests_created_at_idx on public.quote_requests (created_at desc);
create index if not exists quote_requests_status_idx on public.quote_requests (status);

-- RLS: a publikus (anon) kulccsal csak beszúrni lehet, olvasni/módosítani nem
alter table public.quote_requests enable row level security;

drop policy if exists "anon_insert_quote_requests" on public.quote_requests;
create policy "anon_insert_quote_requests"
  on public.quote_requests for insert to anon with check (true);

revoke all on public.quote_requests from anon, authenticated;
grant insert on public.quote_requests to anon;
grant select, update on public.quote_requests to authenticated;

drop policy if exists "authenticated_read_quote_requests" on public.quote_requests;
create policy "authenticated_read_quote_requests"
  on public.quote_requests for select to authenticated using (true);

drop policy if exists "authenticated_update_quote_requests" on public.quote_requests;
create policy "authenticated_update_quote_requests"
  on public.quote_requests for update to authenticated using (true) with check (true);
