# Sara Gest

Gestionale per attività di manutenzione e interventi, con **Sara**, un'assistente vocale in italiano che fa da segretaria:
raccoglie i dati di chi chiama e **non decide mai niente da sola** — ogni richiesta resta "da confermare" finché il titolare preme *Conferma*.

Progetto **indipendente**: ha il proprio database Supabase e non condivide codice, tabelle o account con altre app.

## Cosa c'è
- **Sara** (`/sara`): conversazione a voce o scritta (domande una alla volta: motivo, nome, telefono, email, indirizzo, urgenza, note), parola di attivazione «Ehi Sara», promemoria («ricordami domani di…»), listino prezzi preimpostato, riconoscimento del tono e dell'urgenza, cliente abituale riconosciuto dal telefono/email.
- **Conferma obbligatoria**: Conferma/Rifiuta. Solo dopo la conferma si crea il cliente (se nuovo) e l'intervento (un'urgenza → priorità critica).
- **Clienti**, **Interventi** (nuovo → in corso → chiuso, numero progressivo dato dal database), **Home** con riquadri quadrati.
- Ruoli: titolare, amministrazione, tecnico (il tecnico vede solo i propri interventi e non usa Sara). Il primo account registrato è il titolare.

## Non ancora fatto (i riquadri in Home dicono "In arrivo")
Preventivi, fatture, magazzino, agenda, gestione tecnici/turni, fornitori, marketing, documenti e firma digitale, app dedicata al tecnico, WhatsApp/SMS/Google Calendar,
e soprattutto **la risposta alle telefonate vere** (serve un numero e un provider telefonico, es. Twilio, più un servizio vocale: oggi Sara parla con chi si presenta o scrive).

## Il modo più semplice: un solo file, senza installare niente
Scarica `sara-gest.html` (qui nel repository), aprilo con un doppio clic in **Chrome o Edge** e, al primo avvio, incolla il *Project URL* e la chiave *anon public* del tuo progetto Supabase (Project Settings → API). I dati restano nel browser.
Il file si rigenera con `npm run build:single` (poi copia `dist-single/index.html` in `sara-gest.html`). Limite: aperto da file, il browser chiede il permesso del microfono a ogni apertura.

## Installazione per sviluppatori
1. Crea un progetto Supabase **nuovo** (solo per Sara Gest) ed esegui `supabase/schema.sql` nell'SQL Editor (rieseguibile).
2. `cp .env.example .env` e inserisci indirizzo e chiave anon del progetto.
3. `npm install && npm run dev` (porta 5173). Registra il primo account: sarà il titolare.
4. Per la voce usa Chrome o Edge (il riconoscimento vocale non c'è in Firefox).

## Comandi
`npm run build` · `npm run lint` · `npm test` (logica di Sara) · `npm run test:db` (schema SQL provato su un vero Postgres, 22 controlli)

## Limiti da conoscere
- «Ehi Sara» ascolta solo mentre la pagina di Sara è aperta (microfono sempre acceso = batteria e privacy).
- Le voci sono quelle del browser: cambiano da dispositivo a dispositivo.
- Schema provato su Postgres con auth simulata, **non** sul vero Supabase; voce e interfaccia non provate in un browser reale.
