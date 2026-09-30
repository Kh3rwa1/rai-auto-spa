create type public.app_role as enum ('admin','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create or replace function public.claim_owner() returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.user_roles where role='admin') then
    return public.has_role(auth.uid(),'admin');
  end if;
  insert into public.user_roles(user_id, role) values (auth.uid(),'admin');
  return true;
end $$;
revoke execute on function public.claim_owner() from anon, public;
grant execute on function public.claim_owner() to authenticated;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text not null, email text,
  building text, floor text, area text, water_access boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  vehicle_model text, photo_url text, clean_preview_url text, video_url text, video_job_id text, video_status text,
  plan text not null, colour text, style text,
  location_type text not null default 'studio', map_pin jsonb, area text,
  guard_permission boolean default false, water_needed boolean default false,
  date date, time text, total integer not null default 0, deposit_paid boolean not null default false,
  status text not null default 'lead', approval_status text, email_status text,
  created_at timestamptz not null default now()
);
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  plan text not null default 'Daily Wash', active boolean not null default true,
  skip_dates date[] not null default '{}', preferred_time text not null default '07:00',
  created_at timestamptz not null default now()
);
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  area text not null, date date not null, created_at timestamptz not null default now()
);
create table public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  date date not null, time text not null, reason text not null default 'Water shortage',
  unique(date, time)
);

do $$ declare t text; begin
  foreach t in array array['clients','bookings','subscriptions','waitlist','blocked_slots'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner all" on public.%I for all to authenticated using (public.has_role(auth.uid(),''admin'')) with check (public.has_role(auth.uid(),''admin''))', t);
  end loop;
end $$;

-- Demo data is created by the seedDemo() server function (src/lib/seed.server.ts), not by migrations.
