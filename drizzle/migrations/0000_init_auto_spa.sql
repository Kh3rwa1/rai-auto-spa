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

insert into public.clients (name, phone, building, floor, area, water_access)
select n.name, '+91 98' || lpad((32000000 + n.i*7919)::text, 8, '0'),
  (array['Hilltop Residency','Namnang Heights','Tibet Road Apts','Deorali Greens','Zero Point View','Paljor Enclave','Rinzing Towers','Tashiling Court'])[1 + (n.i % 8)],
  ((n.i % 6) + 1)::text,
  (array['Tadong','MG Marg','Deorali','Development Area'])[1 + (n.i % 4)],
  (n.i % 5) <> 0
from (select ord::int as i, name from unnest(array[
 'Pema Bhutia','Karma Lepcha','Sonam Tamang','Anjali Pradhan','Tenzing Sherpa','Rohan Chettri','Dechen Wangmo','Bikash Rai','Priya Gurung','Nima Lama',
 'Suraj Subba','Mingma Sherpa','Kavita Sharma','Pasang Doma','Rajesh Thapa','Yangchen Bhutia','Arjun Limbu','Diki Tshering','Samir Mukhia','Ongmu Lepcha',
 'Dawa Norbu','Neha Agarwal','Phurba Tamang','Ritu Pradhan','Ugen Lachenpa','Manish Chettri','Sangay Bhutia','Asha Rai','Tashi Namgyal','Deepak Gurung',
 'Lhamu Sherpa','Vikram Basnet','Choden Lepcha','Nirmal Subba','Pooja Tamang','Jigme Dorjee','Sunita Thapa','Lobsang Tenzin','Ravi Sharma','Kinzang Wangdi']) with ordinality as u(name, ord)) n;

insert into public.subscriptions (client_id, plan, preferred_time)
select id, 'Daily Wash', (array['06:30','07:00','07:30','08:00','08:30'])[1 + (abs(hashtext(name)) % 5)] from public.clients;

with c as (select id, name, area, row_number() over (order by name) rn from public.clients)
insert into public.bookings (client_id, vehicle_model, plan, location_type, area, map_pin, date, time, total, deposit_paid, status, colour, style, approval_status, water_needed, guard_permission)
select c.id, v.model, v.plan, v.loc, c.area, v.pin::jsonb, current_date + v.d, v.t, v.total, v.dep, v.st, v.colour, v.style, v.appr, false, true
from c join (values
 (1,'Swift','Essential Wash','mobile','{"lat":27.3082,"lng":88.5976}',0,'07:00',699,true,'confirmed',null,null,null),
 (2,'Baleno','Full Detail','studio','{"lat":27.3314,"lng":88.6138}',0,'08:00',1999,true,'confirmed',null,null,null),
 (3,'Thar','Essential Wash','mobile','{"lat":27.3219,"lng":88.6108}',0,'17:00',699,false,'pending_deposit',null,null,null),
 (4,'Innova','Full Detail','mobile','{"lat":27.3172,"lng":88.6040}',1,'09:00',2199,true,'confirmed',null,null,null),
 (5,'Creta','Essential Wash','studio','{"lat":27.3314,"lng":88.6138}',2,'18:00',499,false,'pending_deposit',null,null,null),
 (6,'Thar','Signature Super Design','studio','{"lat":27.3314,"lng":88.6138}',3,'10:00',25000,true,'consultation','Matte Black','Blacked Out','pending'),
 (7,'Creta','Signature Super Design','studio','{"lat":27.3314,"lng":88.6138}',5,'09:00',25000,true,'consultation','Electric Blue','Racing Stripes','pending')
) as v(rn,model,plan,loc,pin,d,t,total,dep,st,colour,style,appr) on v.rn = c.rn;

insert into public.waitlist (client_id, area, date)
select id, area, current_date from public.clients order by name offset 10 limit 6;