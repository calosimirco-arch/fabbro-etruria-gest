# Sara Gest

Gestionale per attività di manutenzione e interventi, con **Sara**, un'assistente vocale in italiano che fa da segretaria:
raccoglie i dati di chi chiama e **non decide mai niente da sola** — ogni richiesta resta "da confermare" finché il titolare preme *Conferma*.

Progetto **indipendente**: ha il proprio database Supabase e non condivide codice, tabelle o account con altre app.

## Cosa c'è
- **Sara** (`/sara`): conversazione a voce o scritta (domande una alla volta: motivo, nome, telefono, email, indirizzo, urgenza, note), parola di attivazione «Ehi Sara», promemoria («ricordami domani di…»), listino prezzi preimpostato, riconoscimento del tono e dell'urgenza, cliente abituale riconosciuto dal telefono/email.
- **Conferma obbligatoria**: Conferma/Rifiuta. Solo dopo la conferma si crea il cliente (se nuovo) e l'intervento (un'urgenza → priorità critica).
- **Preventivi**: bozza → inviato → accettato/rifiutato, voci con quantità, prezzo e IVA, totali in centesimi (niente errori di arrotondamento), stampa/PDF. Quando confermi una richiesta di preventivo di Sara, il cliente (se nuovo) e una bozza già compilata col prezzo di listino compaiono qui. Un preventivo inviato non si modifica più.
- **Fatture**: emessa completa (numero progressivo per anno SENZA buchi, voci, scadenza a 30 giorni se non indicata), poi non si modifica: si può solo segnare **pagata** (con metodo) o **annullare** (se non pagata). «Scaduta» si calcola dalla data. Riepilogo: da incassare, scadute, incassato nel mese; stampa/PDF. Da un preventivo **accettato** un clic crea la fattura (una sola per preventivo). Sono documenti interni, **non fatture elettroniche** per l'Agenzia delle Entrate.
- **Magazzino**: materiali (codice, unità, prezzo, scorta minima), **più magazzini** (es. sede e furgoni), carico / scarico / rettifica d'inventario / trasferimento. La giacenza è la somma dei movimenti (registro che non si modifica né si cancella): impossibile andare sotto zero, anche con due scarichi contemporanei. Uno scarico si può collegare a un intervento. Avviso «Da riordinare» (esauriti e sotto scorta minima) nella pagina e nella Home. Nei preventivi e nelle fatture si aggiunge una voce «dal magazzino» con il prezzo già pronto.
- **Clienti**, **Interventi** (nuovo → in corso → chiuso, numero progressivo dato dal database), **Home** con riquadri quadrati.
- Ruoli: titolare, amministrazione, tecnico (il tecnico vede solo i propri interventi e non usa Sara). Il primo account registrato è il titolare.

## Non ancora fatto (i riquadri in Home dicono "In arrivo")
Agenda, gestione tecnici/turni, fornitori, marketing, documenti e firma digitale, app dedicata al tecnico, WhatsApp/SMS/Google Calendar,
e soprattutto **la risposta alle telefonate vere** (serve un numero e un provider telefonico, es. Twilio, più un servizio vocale: oggi Sara parla con chi si presenta o scrive).

## Il modo più semplice: un solo file, senza installare niente
Scarica `sara-gest.html` (qui nel repository), aprilo con un doppio clic in **Chrome o Edge** e, al primo avvio, incolla il *Project URL* e la chiave *anon public* del tuo progetto Supabase (Project Settings → API). I dati restano nel browser.
Il file si rigenera con `npm run build:single` (poi copia `dist-single/index.html` in `sara-gest.html`). Limite: aperto da file, il browser chiede il permesso del microfono a ogni apertura.

## «Hey Sara» sempre disponibile (cosa si può e cosa no)
Un sito o una PWA **non può ascoltare il microfono ad app chiusa**: i browser lo vietano per la privacy. Per questo ci sono due modi, entrambi provati:
- **Avvio con la voce dal telefono**: nella pagina Sara trovi un collegamento (`#/sara?attiva=1`) che apre Sara già in ascolto. Lo abbini a una *Routine dell'Assistente Google* («Ok Google, Sara») o a un *Comando di Siri* («Ehi Siri, Sara»): l'assistente del telefono funziona anche con l'app chiusa.
  Se il browser non permette alla voce di parlare senza un tocco (succede quando la pagina si apre da sola), compare il pulsante «Tocca per attivare la voce di Sara».
- **Postazione sempre attiva 24 ore**: un tablet o PC lasciato acceso con la pagina Sara aperta. Resta in ascolto di «Ehi Sara», tiene lo schermo acceso (Screen Wake Lock), si riaccende da sola dopo un'interruzione, si ricarica ogni notte alle 4:00 (mai durante una chiamata) e ricorda la scelta quando la pagina si riapre. Serve l'indirizzo online (https) con il permesso del microfono e la pagina in primo piano.
Un vero «Hey Sara» con il telefono bloccato richiederebbe un'app Android nativa con un servizio sempre acceso e un motore di parola-chiave dedicato: non è incluso.

## Sul telefono (GitHub Pages)
1. Su GitHub: repository → **Settings → Pages** → *Build and deployment*: **Deploy from a branch**, branch `main`, cartella **/docs** → **Save**.
2. Dopo 1-2 minuti l'app è online su `https://<utente>.github.io/<repository>/`. Aprila dal computer e collega il progetto Supabase (una volta).
3. Nella Home compare **«Usa Sara Gest sul telefono»**: copia il collegamento, invialo a te stesso e aprilo dal telefono. Il progetto si collega da solo; basta accedere. Poi, dal menu del browser, «Aggiungi a schermata Home».
Online (HTTPS) il microfono funziona meglio che aprendo il file. Il collegamento contiene la chiave *anon public* (pubblica per natura), mai la *service_role*: tienilo comunque per te.
`docs/index.html` è generato da `npm run build:single` (come `sara-gest.html`): non si modifica a mano.

## Installazione per sviluppatori
1. Crea un progetto Supabase **nuovo** (solo per Sara Gest) ed esegui `supabase/schema.sql` nell'SQL Editor (rieseguibile).
2. `cp .env.example .env` e inserisci indirizzo e chiave anon del progetto.
3. `npm install && npm run dev` (porta 5173). Registra il primo account: sarà il titolare.
4. Per la voce usa Chrome o Edge (il riconoscimento vocale non c'è in Firefox).

## Comandi
`npm run build` · `npm run lint` · `npm test` (logica di Sara) · `npm run test:db` (schema SQL provato su un vero Postgres, 73 controlli)

## Limiti da conoscere
- «Ehi Sara» ascolta solo mentre la pagina di Sara è aperta (microfono sempre acceso = batteria e privacy).
- Le voci sono quelle del browser: cambiano da dispositivo a dispositivo.
- Schema provato su Postgres con auth simulata, **non** sul vero Supabase; voce e interfaccia non provate in un browser reale.
