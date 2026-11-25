# CLAUDE.md — workspace Aldo Prestera Pizzeria

Repo: https://github.com/StazzoKUn/aldoprestera-sito — si lavora da due PC (portatile e fisso).
Lingua: comunica, scrivi commenti, commit e documentazione in **italiano**.

## Cosa c'è qui

| Cartella | Cosa | Istruzioni dettagliate |
| --- | --- | --- |
| `aldo-prestera/` | Sito one page in Astro + isola Preact per gli ordini, endpoint Node in `src/pages/api/` | **`aldo-prestera/CLAUDE.md`** (leggilo prima di toccare il sito: contiene anche le decisioni sull'area ordini/gestione) e `README.md` |
| `aldo-prestera/whatsapp-bot/` | Servizio separato che inoltra le comande su WhatsApp (whatsapp-web.js) | `aldo-prestera/whatsapp-bot/README.md` |
| `ordini-api/` | Backend ordini: Express 5 + Prisma 7 + MariaDB (XAMPP), moduli prodotti/clienti/indirizzi/ordini (+ accesso e gestione: Fase 2) | questo file; esempi di chiamate in `ordini-api/requests.http` |
| `_mockup/`, `_handoff/` | Mockup grafico di riferimento (il sito lo segue 1:1) | `_handoff/design_handoff_aldo_prestera_astro/README.md` |

## Rimettere in piedi tutto su un PC nuovo

Prerequisiti: **Node.js ≥ 22.12**, Git, **XAMPP** (solo per `ordini-api`).

Cosa NON è nella repo (vedi `.gitignore`) e va ricreato a mano:
- i file **`.env`** (segreti): si copiano dall'altro PC oppure si parte da ogni `.env.example`. Non inventare valori per SMTP, token o numeri di telefono: chiedili all'utente.
- `node_modules/`, `dist/`, `.astro/`, il client Prisma generato (`ordini-api/src/generated/prisma`)
- i dati locali del sito (`aldo-prestera/.data/`, si ricrea da solo) e la sessione WhatsApp (`.wwebjs_auth/`, va riscansionato il QR)

### 1. Sito (`aldo-prestera/`)

```bash
cd aldo-prestera
cp .env.example .env    # senza SMTP, in sviluppo l'ordine viene stampato in console. Aggiungi ORDINI_API_TOKEN (stesso valore di ordini-api/.env, almeno 16 caratteri casuali)
npm install
npm run dev             # http://localhost:4321
```

In alternativa usa il preview integrato: configurazione `aldo-dev` in `.claude/launch.json` (non avviare il dev server con Bash). Il `.env` del sito può avere un SMTP vero: per le prove usa `aldo-dev-prova` (porta 4322, non invia nulla). Un solo dev server Astro per volta.
Prima di ogni consegna `npm run build` deve passare senza errori.

### 2. Bot WhatsApp (`aldo-prestera/whatsapp-bot/`) — facoltativo

```bash
cd aldo-prestera/whatsapp-bot
cp .env.example .env    # WA_TO, WA_BOT_TOKEN (uguale a quello nel .env del sito), WA_PORT=3100
npm install
npm start               # al primo avvio va scansionato il QR dal telefono del numero del sito
```

Se il bot è spento il sito funziona comunque (le comande partono solo via email).

### 3. API ordini (`ordini-api/`)

1. Avvia **MySQL/MariaDB** dal pannello di XAMPP.
2. Crea il database `aldop` (es. da phpMyAdmin, collation `utf8mb4_unicode_ci`).
3. Poi:

```bash
cd ordini-api
cp .env.example .env    # DATABASE_URL="mysql://root@localhost:3306/aldop" (root XAMPP senza password) + ORDINI_API_TOKEN (obbligatorio, uguale a quello del sito)
npm install
npm run prisma:generate # genera il client in src/generated/prisma
npm run db:check        # verifica connessione e permessi
npm run db:migrate      # applica le migration in prisma/migrations
npm run db:seed         # carica i prodotti di prisma/seed/ (ATTENZIONE: svuota menù e ordini)
npm run admin:dev       # solo sviluppo: account di prova per /gestione (credenziali in scripts/admin-dev.ts)
npm run dev             # http://localhost:3000
```

Altri script: `npm run typecheck`, `npm run db:studio` (Prisma Studio), `npm run build` / `npm start`.

## Prenotazione tavoli (implementata in locale il 2026-11-25, non ancora in produzione)

Decisioni del 2026-11-25. Fatta **prima di Stripe** (l'integrazione Stripe è sospesa). Unica fonte per questa funzione: non creare altri documenti di progetto.

**Su un altro PC dopo `git pull`**: serve una migration nuova (tabella `prenotazione`): in `ordini-api` esegui `npm run prisma:generate` e `npm run db:migrate`, poi riavvia API e sito. Nessuna nuova variabile `.env`.

**Principi**
- **Nessuna tabella dei tavoli**: la sala è variabile (due tavoli da 4 diventano uno da 8). La prenotazione dice solo **quante persone** e **a che ora arrivano**.
- **Nessuna durata né ora di fine**: Aldo guarda chi è seduto, non gli orari. Niente `durata_minuti`.
- **Decide Aldo, come per gli ordini**: il cliente manda una richiesta, Aldo la conferma o la rifiuta. **Nessun limite automatico di coperti** (come per gli slot degli ordini).
- **Il form online è aperto a tutti**, senza tetto di persone: per i gruppi grandi si può anche telefonare, ma decide sempre Aldo.
- Si prenota **fino a 7 giorni avanti** (gli ordini invece sono solo per oggi).
- Nome e cognome in un **campo unico**, come nel form ordini (`ordini-api.ts` lo divide in `nome`/`cognome` per `Cliente`).

**Stati** (`StatoPrenotazione`, enum): `richiesta`, `confermata`, `rifiutata`, `annullata`. Niente "arrivata" né "no show". **Solo Aldo cambia lo stato**: il cliente non annulla dal sito; sulla pagina del cliente (e nell'email) va messo l'avviso «per annullare o modificare chiama il ristorante» con il telefono da `site.ts`. Transizioni (`ordini-api/src/modules/prenotazioni/prenotazioni.stato.ts`): richiesta→confermata|rifiutata|annullata; confermata→rifiutata|annullata (Aldo può ripensarci, il rifiuto richiede sempre il motivo); rifiutata e annullata sono finali. **Rifiuto automatico**: una `richiesta` ancora senza risposta quando passa l'orario prenotato diventa `rifiutata` con motivo «La pizzeria non ha potuto rispondere» (nessun timer: si applica nelle letture, come per gli ordini). **Motivi di rifiuto** (lista fissa, provvisoria da confermare con Aldo, in `prenotazioni.motivi.ts`): «Siamo al completo in quell'orario», «Locale chiuso in quella data», «Non siamo riusciti a contattarti».

**Backend fatto (passo 2, 2026-11-25)**: modulo `ordini-api/src/modules/prenotazioni/`. Route del sito (solo token): `POST /prenotazioni` (orario nel futuro ed entro 7 giorni, `persone` 1–200 solo come limite tecnico) e `GET /prenotazioni/pubblico/:codice` (mai tavolo_note; `contatto` solo se scaduta proprio ora, per l'email di rifiuto). Route del pannello (token + sessione, in `gestione.routes.ts`): `GET /gestione/prenotazioni` (da_confermare, confermate, chiuse, da oggi in avanti, + `appena_scadute`), `POST /gestione/prenotazioni/:id/stato` (restituisce `stato_precedente`: il sito manda l'email a ogni cambio di stato, anche da confermata), `PATCH /gestione/prenotazioni/:id/tavolo`. Gli orari prenotabili (turni, ultimo arrivo) NON sono controllati dall'API: sono compito del sito.

**Orari nel sito fatti (passo 3, 2026-11-25)**: config `reservationHours` in `aldo-prestera/src/data/site.ts` (step 15', ultimo arrivo 16:00 pranzo / 23:00 cena, 7 giorni avanti, anticipo minimo 30' **provvisorio**), logica in `src/lib/prenotazioni-slots.ts` (`availableReservationDays`, `isReservationSlotAvailable` da usare nel POST del passo 4, `reservationToDate` → `inizio` UTC), endpoint `GET /api/prenotazione-slot`. `daysAhead` deve coincidere con `GIORNI_ANTICIPO` di ordini-api. **Email al cliente**: oltre a quella della decisione su una `richiesta`, parte anche quando Aldo cambia una prenotazione già `confermata` (→ rifiutata o annullata), così il cliente riceve sempre la conferma completa della modifica. Nessun annullamento da parte del cliente, per scelta (vedi sopra).

**Tabella `Prenotazione`** (scelta A: **nessun dato duplicato** da `Cliente`; nome, cognome, telefono ed email si leggono da `Cliente`, come l'email dell'ordine):
`id`, `codice_pubblico` (univoco, per la pagina di attesa del cliente, mai l'id), `cliente_id` (obbligatorio), `persone`, `inizio` (UTC), `note` (solo del cliente), `stato`, `motivo_stato`, `tavolo_note` (promemoria libero di Aldo, es. "T3+T4 uniti", non vincola niente), `creato_il`, `aggiornato_il`. Indici su `[stato, inizio]` e `inizio`. Il sito deve tenere aggiornato il telefono di `Cliente` a ogni prenotazione.

**Orari prenotabili**: gli stessi turni di `orderHours` in `aldo-prestera/src/data/site.ts` (unica fonte, non duplicarli), arrivi ogni 15 minuti, **primo arrivo = l'apertura del turno** (si prenota appena aprono). **Ultimo arrivo prenotabile: le 16:00 a pranzo e le 23:00 a cena** (non si prenota fino alla chiusura), e comunque mai oltre la chiusura del turno. Giorni di apertura: lunedì e mercoledì solo cena; gli altri giorni pranzo e cena.

**Flusso cliente nel sito fatto (passo 4, 2026-11-25)**: pagina `/prenota` (isola `ReserveApp.tsx`: giorno, orario di arrivo a pulsanti Pranzo/Sera, persone, contatti, note, privacy; avviso «per annullare o modificare chiama il ristorante» con il telefono di `site.ts`), `POST /api/prenotazione` (rate limit 6 ogni 10 min per IP, rivalida orario con `isReservationSlotAvailable`, salva con `createReservation` in `ordini-api.ts`), pagina di attesa `/prenotazione/<codice>` (`ReservationWaitApp.tsx`, polling 15 s, `noindex`) con `GET /api/prenotazione/stato/<codice>`. Nome e telefono vivono solo su `Cliente`: a ogni prenotazione il sito li **aggiorna** sul cliente esistente (stessa email). Email al cliente in `src/lib/notify-prenotazione.ts` (stesso stile e stessa SMTP degli ordini; testi diversi se la prenotazione era già confermata) con `sendReservationDecision` e `reservationEmailFailed` (in memoria, per codice) in `decisione.ts`; parte alla scadenza automatica e a ogni decisione di Aldo dal pannello (passo 5). Nessuna email ad Aldo per le nuove richieste (le vede nel pannello). `/prenota` è linkata dal menù della home (voce «Prenota», e «Prenota un tavolo» nel menù mobile) e dal menù ordini `/ordina` (riga «Vuoi cenare da noi? Prenota un tavolo →» sotto l'intestazione).

**Pannello di Aldo fatto (passo 5, 2026-11-25)**: in `/gestione` c'è una barra «Ordini | Prenotazioni» (la seconda col contatore rosso delle richieste da confermare, anche mentre si guardano gli ordini). Colonne/schede «Da confermare», «Confermate», «Chiuse» (da oggi in avanti; chiuse = rifiutate, annullate, scadute), stesso stile e aggiornamento ogni 3 s degli ordini. Il suono ripetuto vale per ordini da accettare **e** prenotazioni da confermare. Azioni: Conferma (un tocco), Rifiuta con motivo (lista fissa, anche da una già confermata), Annulla (con conferma, solo da confermata), promemoria «Tavolo» libero salvato al blur/Invio, Chiama. Ogni cambio di stato manda l'email al cliente (`lib/decisione-prenotazione.ts`); se fallisce la scheda mostra «Email non inviata: avvisa il cliente a voce». Endpoint del sito: `GET /api/gestione/prenotazioni`, `POST /api/gestione/prenotazioni/<id>/stato`, `POST /api/gestione/prenotazioni/<id>/tavolo` (sessione + controllo Origin, come gli ordini). Codice: `components/gestione/PrenotazioniView.tsx` (`api.ts` e `Modal.tsx` estratti da `Pannello.tsx`). Nessuno storico delle prenotazioni per ora.

**Prova finale delle prenotazioni (passo 6, 2026-11-25) — esito.** Verificato: `npm run typecheck` (ordini-api) e `npm run build` (sito) verdi; 24 controlli sull'API, 19 sugli orari, 9 sulle email, 4 sulla concorrenza (due conferme insieme, conferma + rifiuto insieme, scadenza letta in parallelo, 20 richieste insieme); percorso completo nel browser (cliente invia → Aldo vede e conferma dal pannello → la pagina del cliente si aggiorna da sola); API spenta (form con messaggio chiaro, pagina di attesa con «Connessione assente», pannello con avviso rosso, tutto si riprende da solo); SMTP guasto (decisione valida, toast e scheda «Email non inviata»); regressione degli ordini dopo il refactoring di `Pannello.tsx` (ordine → pannello → accetta → pagina del cliente → ritirato → Annulla → storico). **Non verificato**: suono e schermo acceso del pannello su un telefono vero, layout su telefono/desktop reali (solo anteprime), controllo `Origin` simulato dal browser, email vere con SMTP vero, il resto della prova finale degli ordini del 2026-11-10 (casi d'errore completi, scadenza 15 min, rifiuto con motivo).

**Da definire**: i testi definitivi con Aldo (motivi di rifiuto, copy della pagina).

**Rimandato (non deciso)**: `BloccoPrenotazioni` (Aldo che chiude una serata o un turno). Il blocco delle fasce è già previsto «alla fine» per gli ordini: se si fa, un'unica soluzione per entrambi.

**Fuori ambito per ora**: Stripe, annullamento da parte del cliente, storico delle prenotazioni, avviso ad Aldo per le nuove richieste, deploy su Plesk; si iniziano solo su richiesta esplicita. La modifica di `schema.prisma` e la migration vanno confermate prima.

## Lavorare su due PC

- All'inizio di ogni sessione: `git pull`. Alla fine: commit e `git push` (solo se l'utente lo chiede).
- Se cambiano dipendenze (`package-lock.json`) dopo un pull: `npm install` nella cartella relativa; se cambiano `prisma/schema.prisma` o le migration: `npm run prisma:generate` e `npm run db:migrate` in `ordini-api/`.
- Mai committare `.env` o segreti.
- La memoria di Claude e la cronologia delle chat restano sul singolo PC: le decisioni importanti vanno scritte nei file della repo (questo file, `aldo-prestera/CLAUDE.md`, `aldo-prestera/docs/`).
