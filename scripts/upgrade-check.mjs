// Prova: un database creato con lo schema precedente si aggiorna rieseguendo quello nuovo, senza perdere dati.
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const [oldPath, newPath] = process.argv.slice(2);
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
 create publication supabase_realtime;`);
await db.exec(fs.readFileSync(oldPath, "utf8"));
const u = (await db.query("insert into auth.users (email) values ('a@x.it') returning id")).rows[0].id;
await db.exec(`set role authenticated; select set_config('request.uid','${u}',false)`);
await db.query(`select sara_register_request('intervento','Mario Rossi','338','','via Roma','guasto','normale','','sereno',null,null,'p')`);
await db.exec("reset role");
await db.exec(fs.readFileSync(newPath, "utf8"));
const n = (await db.query("select count(*)::int c from sara_requests")).rows[0].c;
const col = (await db.query("select count(*)::int c from information_schema.columns where table_name='sara_requests' and column_name='quote_id'")).rows[0].c;
const q = (await db.query("select to_regclass('public.quotes') is not null ok")).rows[0].ok;
console.log(n === 1 && col === 1 && q ? "AGGIORNAMENTO OK: dati conservati, colonna e tabelle nuove presenti" : `KO n=${n} col=${col} quotes=${q}`);
