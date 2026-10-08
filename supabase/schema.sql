-- SARA GEST: database completo, da zero. Si esegue UNA volta nell'SQL Editor di un progetto Supabase NUOVO e
-- DEDICATO a questa app (non condiviso con altre). E' sicuro rieseguirlo.
--
-- Modello: un'azienda sola per progetto. Ruoli: titolare, amministrazione, tecnico.
-- Il PRIMO account che si registra diventa titolare; gli altri nascono tecnici (li promuove il titolare).
-- Sara non decide mai: registra richieste "in_attesa" che il titolare conferma o rifiuta (sara_confirm_request).

-- ---------------------------------------------------------
-- 1. Persone e ruoli
-- ---------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'tecnico' check (role in ('titolare', 'amministrazione', 'tecnico')),
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    -- Il ruolo NON si legge dai dati scritti dall'utente: il primo account e' il titolare, gli altri tecnici.
    case when exists (select 1 from profiles) then 'tecnico' else 'titolare' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user after insert on auth.users for each row execute function handle_new_user();

create or replace function app_role() returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;
create or replace function is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(app_role() in ('titolare', 'amministrazione'), false);
$$;
revoke execute on function app_role(), is_staff() from public, anon;
grant execute on function app_role(), is_staff() to authenticated;

alter table profiles enable row level security;
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select to authenticated using (id = auth.uid() or is_staff());
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update to authenticated using (id = auth.uid());
-- Solo il nome si cambia da se': il ruolo mai (colonna non concessa).
revoke all on profiles from anon;
revoke insert, update, delete on profiles from authenticated;
grant select on profiles to authenticated;
grant update (full_name) on profiles to authenticated;

-- ---------------------------------------------------------
-- 2. Clienti e interventi
-- ---------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and char_length(name) <= 120),
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 160),
  address text check (char_length(address) <= 250),
  created_at timestamptz not null default now()
);

create sequence if not exists interventions_seq;
create table if not exists interventions (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  client_id uuid not null references clients (id),
  title text not null check (btrim(title) <> '' and char_length(title) <= 200),
  description text check (char_length(description) <= 2000),
  priority text not null default 'media' check (priority in ('bassa', 'media', 'alta', 'critica')),
  status text not null default 'nuovo' check (status in ('nuovo', 'assegnato', 'in_corso', 'chiuso')),
  address text,
  scheduled_at timestamptz,
  technician_id uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Il numero lo da' SEMPRE il database.
create or replace function assign_intervention_number() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.number := 'INT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('interventions_seq')::text, 5, '0');
  return new;
end;
$$;
drop trigger if exists trg_assign_intervention_number on interventions;
create trigger trg_assign_intervention_number before insert on interventions for each row execute function assign_intervention_number();

alter table clients enable row level security;
alter table interventions enable row level security;

drop policy if exists "clients_staff_all" on clients;
create policy "clients_staff_all" on clients for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "interventions_staff_all" on interventions;
create policy "interventions_staff_all" on interventions for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "interventions_tecnico_select" on interventions;
create policy "interventions_tecnico_select" on interventions for select to authenticated using (technician_id = auth.uid());
-- Il tecnico vede i clienti dei propri interventi (nome e indirizzo servono per andare sul posto).
drop policy if exists "clients_tecnico_select" on clients;
create policy "clients_tecnico_select" on clients for select to authenticated
  using (exists (select 1 from interventions i where i.client_id = clients.id and i.technician_id = auth.uid()));

revoke all on clients, interventions from anon;
grant select, insert, update, delete on clients, interventions to authenticated;

-- ---------------------------------------------------------
-- 2b. Preventivi (bozza -> inviato -> accettato / rifiutato)
-- ---------------------------------------------------------
create sequence if not exists quotes_seq;
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  client_id uuid not null references clients (id),
  title text not null check (btrim(title) <> '' and char_length(title) <= 200),
  notes text check (char_length(notes) <= 2000),
  status text not null default 'bozza' check (status in ('bozza', 'inviato', 'accettato', 'rifiutato')),
  valid_until date,
  created_by uuid references profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes (id) on delete cascade,
  position integer not null default 0,
  description text not null check (btrim(description) <> '' and char_length(description) <= 300),
  quantity numeric(10, 2) not null check (quantity > 0 and quantity <= 100000),
  unit_price numeric(12, 2) not null check (unit_price >= 0 and unit_price <= 1000000),
  vat_rate numeric(5, 2) not null default 22 check (vat_rate >= 0 and vat_rate <= 100)
);
create index if not exists idx_quote_items_quote on quote_items (quote_id, position);

-- Il numero lo da' SEMPRE il database.
create or replace function assign_quote_number() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.number := 'PRV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('quotes_seq')::text, 5, '0');
  return new;
end;
$$;
drop trigger if exists trg_assign_quote_number on quotes;
create trigger trg_assign_quote_number before insert on quotes for each row execute function assign_quote_number();

-- Regole del preventivo: lo stato avanza solo bozza -> inviato -> accettato/rifiutato; un preventivo inviato non si
-- modifica nelle voci; si cancella solo una bozza. Cosi' cio' che il cliente ha ricevuto non cambia di nascosto.
create or replace function guard_quote_update() returns trigger language plpgsql set search_path = public as $$
begin
  if new.client_id is distinct from old.client_id or new.number is distinct from old.number then
    raise exception 'Cliente e numero di un preventivo non si cambiano';
  end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'bozza' and new.status = 'inviato')
         or (old.status = 'inviato' and new.status in ('accettato', 'rifiutato'))) then
      raise exception 'Il preventivo non puo'' passare da % a %', old.status, new.status;
    end if;
  elsif old.status <> 'bozza' and (new.title is distinct from old.title or new.notes is distinct from old.notes
        or new.valid_until is distinct from old.valid_until) then
    raise exception 'Un preventivo gia'' inviato non si modifica';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_quote_update on quotes;
create trigger trg_guard_quote_update before update on quotes for each row execute function guard_quote_update();

create or replace function guard_quote_delete() returns trigger language plpgsql set search_path = public as $$
begin
  if old.status <> 'bozza' then raise exception 'Si puo'' eliminare solo un preventivo in bozza'; end if;
  return old;
end;
$$;
drop trigger if exists trg_guard_quote_delete on quotes;
create trigger trg_guard_quote_delete before delete on quotes for each row execute function guard_quote_delete();

create or replace function guard_quote_items() returns trigger language plpgsql set search_path = public as $$
declare v_status text;
begin
  select status into v_status from quotes where id = coalesce(new.quote_id, old.quote_id);
  -- Preventivo non trovato = si sta cancellando il preventivo intero (a cascata): consentito.
  if v_status is not null and v_status <> 'bozza' then
    raise exception 'Le voci di un preventivo gia'' inviato non si modificano';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_guard_quote_items on quote_items;
create trigger trg_guard_quote_items before insert or update or delete on quote_items for each row execute function guard_quote_items();

alter table quotes enable row level security;
alter table quote_items enable row level security;
drop policy if exists "quotes_staff_all" on quotes;
create policy "quotes_staff_all" on quotes for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "quote_items_staff_all" on quote_items;
create policy "quote_items_staff_all" on quote_items for all to authenticated using (is_staff()) with check (is_staff());
revoke all on quotes, quote_items from anon;
grant select, insert, update, delete on quotes, quote_items to authenticated;

-- ---------------------------------------------------------
-- 3. Sara: richieste da confermare e listino prezzi
-- ---------------------------------------------------------
create table if not exists sara_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'intervento'
    check (kind in ('intervento', 'urgenza', 'preventivo', 'appuntamento', 'materiali', 'promemoria', 'altro')),
  client_name text, client_phone text, client_email text, client_address text,
  reason text,
  urgency text not null default 'normale' check (urgency in ('normale', 'alta', 'urgente')),
  notes text,
  mood text not null default 'sereno' check (mood in ('sereno', 'preoccupato', 'irritato')),
  scheduled_at timestamptz,
  price_hint numeric(12, 2),
  proposal text,
  status text not null default 'in_attesa' check (status in ('in_attesa', 'confermata', 'rifiutata')),
  decided_by uuid references profiles (id) on delete set null,
  decided_at timestamptz,
  reject_reason text,
  client_id uuid references clients (id) on delete set null,
  intervention_id uuid references interventions (id) on delete set null,
  quote_id uuid references quotes (id) on delete set null,
  created_by uuid references profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint sara_requests_text_length check (
    coalesce(char_length(client_name), 0) <= 120 and coalesce(char_length(client_phone), 0) <= 40
    and coalesce(char_length(client_email), 0) <= 160 and coalesce(char_length(client_address), 0) <= 250
    and coalesce(char_length(reason), 0) <= 1000 and coalesce(char_length(notes), 0) <= 1000
    and coalesce(char_length(proposal), 0) <= 2000 and coalesce(char_length(reject_reason), 0) <= 300)
);
alter table sara_requests add column if not exists quote_id uuid references quotes (id) on delete set null;
create index if not exists idx_sara_requests_status on sara_requests (status, created_at desc);

create table if not exists sara_prices (
  id uuid primary key default gen_random_uuid(),
  label text not null check (btrim(label) <> '' and char_length(label) <= 120),
  keywords text[] not null default '{}',
  amount numeric(12, 2) not null check (amount >= 0 and amount <= 1000000),
  created_at timestamptz not null default now()
);

alter table sara_requests enable row level security;
alter table sara_prices enable row level security;
drop policy if exists "sara_requests_select" on sara_requests;
create policy "sara_requests_select" on sara_requests for select to authenticated using (is_staff());
drop policy if exists "sara_prices_select" on sara_prices;
create policy "sara_prices_select" on sara_prices for select to authenticated using (is_staff());

-- Nessuna scrittura diretta: si scrive solo con le funzioni sara_* qui sotto.
revoke all on sara_requests, sara_prices from anon;
revoke insert, update, delete on sara_requests, sara_prices from authenticated;
grant select on sara_requests, sara_prices to authenticated;

do $$ begin alter publication supabase_realtime add table sara_requests;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- Sara registra una richiesta (resta in attesa). Un promemoria e' del titolare: nasce gia' confermato.
create or replace function sara_register_request(
  p_kind text, p_client_name text, p_client_phone text, p_client_email text, p_client_address text,
  p_reason text, p_urgency text, p_notes text, p_mood text, p_scheduled_at timestamptz,
  p_price_hint numeric, p_proposal text
) returns sara_requests language plpgsql security definer set search_path = public as $$
declare v_row sara_requests;
begin
  if not is_staff() then raise exception 'Solo titolare e amministrazione possono usare Sara'; end if;
  if p_kind not in ('intervento', 'urgenza', 'preventivo', 'appuntamento', 'materiali', 'promemoria', 'altro') then
    raise exception 'Tipo di richiesta non valido';
  end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Manca il motivo della richiesta'; end if;
  if p_kind <> 'promemoria' and coalesce(btrim(p_client_name), '') = '' then
    raise exception 'Manca il nome del cliente';
  end if;

  insert into sara_requests (kind, client_name, client_phone, client_email, client_address, reason, urgency, notes,
    mood, scheduled_at, price_hint, proposal, status, decided_by, decided_at)
  values (p_kind, nullif(btrim(p_client_name), ''), nullif(btrim(p_client_phone), ''), nullif(btrim(p_client_email), ''),
    nullif(btrim(p_client_address), ''), btrim(p_reason), coalesce(nullif(p_urgency, ''), 'normale'),
    nullif(btrim(p_notes), ''), coalesce(nullif(p_mood, ''), 'sereno'), p_scheduled_at, p_price_hint,
    nullif(btrim(p_proposal), ''),
    case when p_kind = 'promemoria' then 'confermata' else 'in_attesa' end,
    case when p_kind = 'promemoria' then auth.uid() end,
    case when p_kind = 'promemoria' then now() end)
  returning * into v_row;
  return v_row;
end;
$$;

-- Conferma del titolare: intervento/urgenza/appuntamento creano il cliente (se nuovo) e l'intervento.
create or replace function sara_confirm_request(p_id uuid)
returns sara_requests language plpgsql security definer set search_path = public as $$
declare v_row sara_requests; v_client uuid; v_int uuid; v_quote uuid; v_digits text;
begin
  if not is_staff() then raise exception 'Solo titolare e amministrazione possono confermare'; end if;
  select * into v_row from sara_requests where id = p_id for update;
  if not found then raise exception 'Richiesta non trovata'; end if;
  if v_row.status <> 'in_attesa' then raise exception 'Questa richiesta e'' gia'' stata decisa'; end if;

  if v_row.kind in ('intervento', 'urgenza', 'appuntamento', 'preventivo') then
    v_digits := regexp_replace(coalesce(v_row.client_phone, ''), '[^0-9]', '', 'g');
    -- Cliente abituale: stesso telefono (solo cifre) o stessa email.
    select c.id into v_client from clients c
     where (v_digits <> '' and regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') = v_digits)
        or (v_row.client_email is not null and lower(c.email) = lower(v_row.client_email))
     limit 1;
    if v_client is null then
      insert into clients (name, email, phone, address)
      values (v_row.client_name, v_row.client_email, v_row.client_phone, v_row.client_address)
      returning id into v_client;
    end if;

    if v_row.kind = 'preventivo' then
      -- Una BOZZA: il titolare la completa e la invia lui. Se Sara ha un prezzo di listino, e' la prima voce.
      insert into quotes (number, client_id, title, notes)
      values ('', v_client, left(v_row.reason, 200),
              concat_ws(E'\n', case when v_row.notes is not null then 'Note: ' || v_row.notes end, 'Richiesta raccolta da Sara.'))
      returning id into v_quote;
      if v_row.price_hint is not null then
        insert into quote_items (quote_id, position, description, quantity, unit_price)
        values (v_quote, 0, left(v_row.reason, 300), 1, v_row.price_hint);
      end if;
    else
      insert into interventions (client_id, title, description, priority, address, scheduled_at, number)
      values (v_client, left('Richiesta telefonica: ' || v_row.reason, 200),
        concat_ws(E'\n', v_row.reason, case when v_row.notes is not null then 'Note: ' || v_row.notes end,
                  'Raccolta da Sara. Tono del cliente: ' || v_row.mood || '.'),
        case when v_row.kind = 'urgenza' or v_row.urgency = 'urgente' then 'critica'
             when v_row.urgency = 'alta' then 'alta' else 'media' end,
        v_row.client_address, case when v_row.kind = 'appuntamento' then v_row.scheduled_at end, '')
      returning id into v_int;
    end if;
  end if;

  update sara_requests set status = 'confermata', decided_by = auth.uid(), decided_at = now(),
         client_id = v_client, intervention_id = v_int, quote_id = v_quote
   where id = p_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function sara_reject_request(p_id uuid, p_reason text default null)
returns sara_requests language plpgsql security definer set search_path = public as $$
declare v_row sara_requests;
begin
  if not is_staff() then raise exception 'Solo titolare e amministrazione possono rifiutare'; end if;
  select * into v_row from sara_requests where id = p_id for update;
  if not found then raise exception 'Richiesta non trovata'; end if;
  if v_row.status <> 'in_attesa' then raise exception 'Questa richiesta e'' gia'' stata decisa'; end if;
  update sara_requests set status = 'rifiutata', decided_by = auth.uid(), decided_at = now(),
         reject_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 300)
   where id = p_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function sara_save_price(p_label text, p_keywords text, p_amount numeric, p_id uuid default null)
returns sara_prices language plpgsql security definer set search_path = public as $$
declare v_kw text[]; v_row sara_prices;
begin
  if app_role() is distinct from 'titolare' then raise exception 'Solo il titolare puo'' modificare il listino'; end if;
  if coalesce(btrim(p_label), '') = '' then raise exception 'Indica il nome della prestazione'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Importo non valido'; end if;
  select coalesce(array_agg(distinct lower(btrim(k))) filter (where btrim(k) <> ''), '{}')
    into v_kw from unnest(string_to_array(coalesce(p_keywords, ''), ',')) k;
  if p_id is null then
    insert into sara_prices (label, keywords, amount) values (btrim(p_label), v_kw, p_amount) returning * into v_row;
  else
    update sara_prices set label = btrim(p_label), keywords = v_kw, amount = p_amount where id = p_id returning * into v_row;
    if not found then raise exception 'Voce del listino non trovata'; end if;
  end if;
  return v_row;
end;
$$;

create or replace function sara_delete_price(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if app_role() is distinct from 'titolare' then raise exception 'Solo il titolare puo'' modificare il listino'; end if;
  delete from sara_prices where id = p_id;
end;
$$;

revoke execute on function sara_register_request(text, text, text, text, text, text, text, text, text, timestamptz, numeric, text),
  sara_confirm_request(uuid), sara_reject_request(uuid, text), sara_save_price(text, text, numeric, uuid),
  sara_delete_price(uuid) from public, anon;
grant execute on function sara_register_request(text, text, text, text, text, text, text, text, text, timestamptz, numeric, text),
  sara_confirm_request(uuid), sara_reject_request(uuid, text), sara_save_price(text, text, numeric, uuid),
  sara_delete_price(uuid) to authenticated;
