# Aldo Prestera Pizzeria — sito one page + ordini online

Astro 7 (statico) + isola Preact per l'ordine + endpoint Node per l'invio dell'ordine.

## Avvio

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # astro check + build in dist/
npm start          # avvia il server di produzione (dist/server/entry.mjs)
```

Copiare `.env.example` in `.env` e impostare l'SMTP per ricevere gli ordini via email.
Senza SMTP, in sviluppo l'ordine viene stampato nella console del server; in produzione l'invio fallisce con errore.

## Struttura

| Percorso | Cosa contiene |
| --- | --- |
| `src/pages/index.astro` | Landing one page (mockup 1a/1b): hero, Le nostre pizze, Come funziona, Dove siamo |
| `src/pages/ordina.astro` | Pagina d'ordine, monta l'isola `OrderApp` |
| `src/components/order/OrderApp.tsx` | Flusso Menù → Dati e orario → Conferma (mockup 2a/2b, 1e, 1f) |
| `src/pages/api/ordine.ts` | `POST /api/ordine`: valida, ricalcola i prezzi, assegna il n° d'ordine, invia l'email |
| `src/lib/notify.ts` | Email ad Aldo (mockup 1g) con "Chiama cliente" e "Apri su mappa" |
| `src/data/menu.ts` | Menù tipizzato (categorie → voci) |
| `src/data/site.ts` | Telefono, indirizzo, P.IVA, orari, social, coordinate mappa, orari ordini |
| `src/lib/slots.ts` | Slot da 15' ricavati da giorni di apertura, primo/ultimo slot e anticipo minimo |
| `docs/TODO-ordering-system.md` | Fase 2 (tracking stile Glovo) — non iniziata |

## Dati segnaposto da sostituire

Tutti in `src/data/site.ts` e `src/data/menu.ts`: telefono, indirizzo, P.IVA, orari, link social,
coordinate della mappa, menù e prezzi. Testi di Privacy e Cookie in `src/pages/privacy.astro` e `cookie.astro`.

## Note

- I font sono self-hosted (Fontsource), nessuna richiesta a Google Fonts.
- La mappa è un embed OpenStreetMap in tinta scura; "Indicazioni" apre Google Maps.
- Il carrello e la modalità (consegna/ritiro) sono salvati in `localStorage`.
- In sviluppo gli slot ignorano l'orario attuale e il giorno di chiusura, per poter provare il flusso.
- Gli ordini e il numero d'ordine stanno nel database di `ordini-api` (`ORDINI_API_URL`). Non c'è un limite di ordini per fascia oraria: in futuro Aldo bloccherà le fasce da una sua interfaccia.
