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

## Lavorare su due PC

- All'inizio di ogni sessione: `git pull`. Alla fine: commit e `git push` (solo se l'utente lo chiede).
- Se cambiano dipendenze (`package-lock.json`) dopo un pull: `npm install` nella cartella relativa; se cambiano `prisma/schema.prisma` o le migration: `npm run prisma:generate` e `npm run db:migrate` in `ordini-api/`.
- Mai committare `.env` o segreti.
- La memoria di Claude e la cronologia delle chat restano sul singolo PC: le decisioni importanti vanno scritte nei file della repo (questo file, `aldo-prestera/CLAUDE.md`, `aldo-prestera/docs/`).
