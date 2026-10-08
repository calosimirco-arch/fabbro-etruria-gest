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
-- 2c. Fatture (documento interno: NON e' una fattura elettronica da inviare allo SdI)
-- ---------------------------------------------------------
-- Una fattura e' un documento contabile: si crea completa con create_invoice (o dal preventivo accettato) e dopo
-- non si modifica. Cambia solo lo stato: in_attesa -> pagata, oppure in_attesa -> annullata. "Scaduta" non e' uno
-- stato salvato: lo calcola l'app (in attesa con scadenza passata). Nessuna scrittura diretta sulle tabelle.
-- La numerazione e' progressiva per anno e SENZA BUCHI: il contatore sta in una tabella e se la creazione fallisce
-- il numero non si consuma (con una sequenza invece si perderebbe).
create table if not exists invoice_counters (
  year integer primary key,
  last_number integer not null default 0
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  client_id uuid not null references clients (id),
  quote_id uuid references quotes (id) on delete set null,
  intervention_id uuid references interventions (id) on delete set null,
  title text not null check (btrim(title) <> '' and char_length(title) <= 200),
  notes text check (char_length(notes) <= 2000),
  issue_date date not null default current_date,
  due_date date not null,
  status text not null default 'in_attesa' check (status in ('in_attesa', 'pagata', 'annullata')),
  paid_at timestamptz,
  payment_method text check (payment_method in ('bonifico', 'contanti', 'carta', 'assegno', 'altro')),
  cancelled_at timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 300),
  created_by uuid references profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint invoices_due_after_issue check (due_date >= issue_date),
  constraint invoices_paid_has_date check (status <> 'pagata' or paid_at is not null),
  constraint invoices_cancelled_has_date check (status <> 'annullata' or cancelled_at is not null)
);
-- Da un preventivo si crea UNA sola fattura (non annullata).
create unique index if not exists idx_invoices_one_per_quote on invoices (quote_id) where quote_id is not null and status <> 'annullata';
create index if not exists idx_invoices_status_due on invoices (status, due_date);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  position integer not null default 0,
  description text not null check (btrim(description) <> '' and char_length(description) <= 300),
  quantity numeric(10, 2) not null check (quantity > 0 and quantity <= 100000),
  unit_price numeric(12, 2) not null check (unit_price >= 0 and unit_price <= 1000000),
  vat_rate numeric(5, 2) not null default 22 check (vat_rate >= 0 and vat_rate <= 100)
);
create index if not exists idx_invoice_items_invoice on invoice_items (invoice_id, position);

alter table invoice_counters enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
drop policy if exists "invoices_staff_select" on invoices;
create policy "invoices_staff_select" on invoices for select to authenticated using (is_staff());
drop policy if exists "invoice_items_staff_select" on invoice_items;
create policy "invoice_items_staff_select" on invoice_items for select to authenticated using (is_staff());
revoke all on invoice_counters, invoices, invoice_items from anon, authenticated;
grant select on invoices, invoice_items to authenticated;

-- Crea una fattura completa in un'unica operazione (fattura + voci + numero). p_items e' un elenco JSON di
-- {description, quantity, unit_price, vat_rate}. Se qualcosa non va, non resta niente e il numero non si consuma.
create or replace function create_invoice(
  p_client_id uuid, p_title text, p_notes text, p_due_date date, p_items jsonb,
  p_quote_id uuid default null, p_intervention_id uuid default null
) returns invoices language plpgsql security definer set search_path = public as $$
declare v_inv invoices; v_year integer := extract(year from current_date)::integer; v_n integer; v_due date;
begin
  if not is_staff() then raise exception 'Solo titolare e amministrazione possono emettere fatture'; end if;
  if not exists (select 1 from clients where id = p_client_id) then raise exception 'Cliente non trovato'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La fattura deve avere almeno una voce';
  end if;
  v_due := coalesce(p_due_date, current_date + 30);
  if v_due < current_date then raise exception 'La scadenza non puo'' essere nel passato'; end if;
  if p_quote_id is not null and not exists (select 1 from quotes where id = p_quote_id and status = 'accettato' and client_id = p_client_id) then
    raise exception 'Si puo'' fatturare solo un preventivo accettato dello stesso cliente';
  end if;

  insert into invoice_counters (year, last_number) values (v_year, 1)
    on conflict (year) do update set last_number = invoice_counters.last_number + 1
    returning last_number into v_n;

  begin
    insert into invoices (number, client_id, quote_id, intervention_id, title, notes, due_date)
    values ('FAT-' || v_year || '-' || lpad(v_n::text, 5, '0'), p_client_id, p_quote_id, p_intervention_id,
            p_title, nullif(btrim(coalesce(p_notes, '')), ''), v_due)
    returning * into v_inv;
  exception when unique_violation then
    raise exception 'Questo preventivo e'' gia'' stato fatturato';
  end;

  insert into invoice_items (invoice_id, position, description, quantity, unit_price, vat_rate)
  select v_inv.id, (ord - 1)::integer, btrim(e->>'description'), (e->>'quantity')::numeric, (e->>'unit_price')::numeric,
         coalesce((e->>'vat_rate')::numeric, 22)
    from jsonb_array_elements(p_items) with ordinality as t(e, ord);
  return v_inv;
end;
$$;

-- Fattura dal preventivo accettato: stesse voci, stesso cliente.
create or replace function create_invoice_from_quote(p_quote_id uuid, p_due_date date default null)
returns invoices language plpgsql security definer set search_path = public as $$
declare q quotes; v_items jsonb;
begin
  if not is_staff() then raise exception 'Solo titolare e amministrazione possono emettere fatture'; end if;
  select * into q from quotes where id = p_quote_id;
  if not found then raise exception 'Preventivo non trovato'; end if;
  if q.status <> 'accettato' then raise exception 'Si puo'' fatturare solo un preventivo accettato'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('description', description, 'quantity', quantity, 'unit_price', unit_price, 'vat_rate', vat_rate) order by position), '[]'::jsonb)
    into v_items from quote_items where quote_id = q.id;
  return create_invoice(q.client_id, q.title, q.notes, p_due_date, v_items, q.id, null);
end;
$$;

create or replace function mark_invoice_paid(p_id uuid, p_method text default null)
returns invoices language plpgsql security definer set search_path = public as $$
declare v_inv invoices;
begin
  if not is_staff() then raise exception 'Solo titolare e amministrazione possono registrare un pagamento'; end if;
  select * into v_inv from invoices where id = p_id for update;
  if not found then raise exception 'Fattura non trovata'; end if;
  if v_inv.status <> 'in_attesa' then raise exception 'Questa fattura e'' gia'' %', case v_inv.status when 'pagata' then 'pagata' else 'annullata' end; end if;
  update invoices set status = 'pagata', paid_at = now(), payment_method = nullif(p_method, '') where id = p_id returning * into v_inv;
  return v_inv;
end;
$$;

create or replace function cancel_invoice(p_id uuid, p_reason text default null)
returns invoices language plpgsql security definer set search_path = public as $$
declare v_inv invoices;
begin
  if not is_staff() then raise exception 'Solo titolare e amministrazione possono annullare una fattura'; end if;
  select * into v_inv from invoices where id = p_id for update;
  if not found then raise exception 'Fattura non trovata'; end if;
  if v_inv.status <> 'in_attesa' then raise exception 'Si puo'' annullare solo una fattura in attesa di pagamento'; end if;
  update invoices set status = 'annullata', cancelled_at = now(), cancel_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 300)
   where id = p_id returning * into v_inv;
  return v_inv;
end;
$$;

revoke execute on function create_invoice(uuid, text, text, date, jsonb, uuid, uuid), create_invoice_from_quote(uuid, date),
  mark_invoice_paid(uuid, text), cancel_invoice(uuid, text) from public, anon;
grant execute on function create_invoice(uuid, text, text, date, jsonb, uuid, uuid), create_invoice_from_quote(uuid, date),
  mark_invoice_paid(uuid, text), cancel_invoice(uuid, text) to authenticated;

-- ---------------------------------------------------------
-- 2d. Magazzino: materiali, magazzini multipli, movimenti (carico / scarico / rettifica / trasferimento)
-- ---------------------------------------------------------
-- La giacenza NON e' un numero scritto a mano: e' la somma dei movimenti (registro che non si modifica e non si
-- cancella). I movimenti si fanno solo con stock_move / stock_transfer, che impediscono giacenze negative e
-- serializzano i movimenti dello stesso materiale (due scarichi insieme non possono superare la scorta).
create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and char_length(name) <= 80),
  created_at timestamptz not null default now()
);
create unique index if not exists idx_warehouses_name on warehouses (lower(name));
insert into warehouses (name) select 'Magazzino principale' where not exists (select 1 from warehouses);

create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  code text not null check (btrim(code) <> '' and char_length(code) <= 40),
  name text not null check (btrim(name) <> '' and char_length(name) <= 150),
  unit text not null default 'pz' check (btrim(unit) <> '' and char_length(unit) <= 10),
  price numeric(12, 2) not null default 0 check (price >= 0 and price <= 1000000),
  min_stock numeric(12, 2) not null default 0 check (min_stock >= 0 and min_stock <= 1000000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_materials_code on materials (lower(code));

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials (id),
  warehouse_id uuid not null references warehouses (id),
  kind text not null check (kind in ('carico', 'scarico', 'rettifica')),
  delta numeric(12, 2) not null check (delta <> 0),
  note text check (char_length(note) <= 300),
  intervention_id uuid references interventions (id) on delete set null,
  transfer_id uuid,
  created_by uuid references profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint stock_movements_sign check ((kind = 'carico' and delta > 0) or (kind = 'scarico' and delta < 0) or kind = 'rettifica')
);
create index if not exists idx_stock_movements_material on stock_movements (material_id, created_at desc);
create index if not exists idx_stock_movements_warehouse on stock_movements (warehouse_id);

create or replace view stock_levels with (security_invoker = true) as
  select material_id, warehouse_id, sum(delta)::numeric(12, 2) as quantity
    from stock_movements group by material_id, warehouse_id;

alter table warehouses enable row level security;
alter table materials enable row level security;
alter table stock_movements enable row level security;
drop policy if exists "warehouses_staff_all" on warehouses;
create policy "warehouses_staff_all" on warehouses for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "materials_staff_all" on materials;
create policy "materials_staff_all" on materials for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "stock_movements_staff_select" on stock_movements;
create policy "stock_movements_staff_select" on stock_movements for select to authenticated using (is_staff());
revoke all on warehouses, materials, stock_movements, stock_levels from anon;
revoke all on stock_movements, stock_levels from authenticated;
grant select on stock_movements, stock_levels to authenticated;
grant select, insert, update on warehouses, materials to authenticated;

create or replace function stock_move(
  p_material uuid, p_warehouse uuid, p_kind text, p_quantity numeric, p_note text default null, p_intervention uuid default null
) returns stock_movements language plpgsql security definer set search_path = public as $$
declare v_mat materials; v_delta numeric; v_bal numeric; v_row stock_movements;
begin
  if not is_staff() then raise exception 'Solo titolare e amministrazione gestiscono il magazzino'; end if;
  if p_kind not in ('carico', 'scarico', 'rettifica') then raise exception 'Tipo di movimento non valido'; end if;
  if p_quantity is null or p_quantity = 0 then raise exception 'La quantita'' non puo'' essere zero'; end if;
  if p_kind <> 'rettifica' and p_quantity < 0 then raise exception 'Per carico e scarico la quantita'' e'' sempre positiva'; end if;
  -- Blocca il materiale: due movimenti insieme sullo stesso materiale si mettono in fila.
  select * into v_mat from materials where id = p_material for update;
  if not found then raise exception 'Materiale non trovato'; end if;
  if not v_mat.active then raise exception 'Il materiale e'' archiviato'; end if;
  if not exists (select 1 from warehouses where id = p_warehouse) then raise exception 'Magazzino non trovato'; end if;
  if p_intervention is not null and not exists (select 1 from interventions where id = p_intervention) then raise exception 'Intervento non trovato'; end if;
  v_delta := case p_kind when 'scarico' then -p_quantity else p_quantity end;
  select coalesce(sum(delta), 0) into v_bal from stock_movements where material_id = p_material and warehouse_id = p_warehouse;
  if v_bal + v_delta < 0 then raise exception 'Giacenza insufficiente: disponibili % %', v_bal, v_mat.unit; end if;
  insert into stock_movements (material_id, warehouse_id, kind, delta, note, intervention_id)
  values (p_material, p_warehouse, p_kind, v_delta, nullif(btrim(coalesce(p_note, '')), ''), p_intervention)
  returning * into v_row;
  return v_row;
end;
$$;

-- Trasferimento tra due magazzini: scarico + carico nella stessa operazione (o tutti e due o nessuno).
create or replace function stock_transfer(p_material uuid, p_from uuid, p_to uuid, p_quantity numeric, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_mat materials; v_bal numeric; v_id uuid := gen_random_uuid(); v_from text; v_to text;
begin
  if not is_staff() then raise exception 'Solo titolare e amministrazione gestiscono il magazzino'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'La quantita'' da trasferire deve essere maggiore di zero'; end if;
  if p_from = p_to then raise exception 'Scegli due magazzini diversi'; end if;
  select * into v_mat from materials where id = p_material for update;
  if not found then raise exception 'Materiale non trovato'; end if;
  if not v_mat.active then raise exception 'Il materiale e'' archiviato'; end if;
  select name into v_from from warehouses where id = p_from;
  select name into v_to from warehouses where id = p_to;
  if v_from is null or v_to is null then raise exception 'Magazzino non trovato'; end if;
  select coalesce(sum(delta), 0) into v_bal from stock_movements where material_id = p_material and warehouse_id = p_from;
  if v_bal < p_quantity then raise exception 'Giacenza insufficiente: disponibili % %', v_bal, v_mat.unit; end if;
  insert into stock_movements (material_id, warehouse_id, kind, delta, note, transfer_id)
  values (p_material, p_from, 'scarico', -p_quantity, concat_ws(' - ', 'Trasferimento a ' || v_to, nullif(btrim(coalesce(p_note, '')), '')), v_id),
         (p_material, p_to, 'carico', p_quantity, concat_ws(' - ', 'Trasferimento da ' || v_from, nullif(btrim(coalesce(p_note, '')), '')), v_id);
  return v_id;
end;
$$;

revoke execute on function stock_move(uuid, uuid, text, numeric, text, uuid), stock_transfer(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function stock_move(uuid, uuid, text, numeric, text, uuid), stock_transfer(uuid, uuid, uuid, numeric, text) to authenticated;

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
