# TODO — Fase 2: sistema di tracking ordini (NON ANCORA INIZIATO)

> **Local order-tracking system, "Glovo-style" but owned by the pizzeria and embedded in the site.** After sending an order, the customer sees a live status page: *order received → accepted by the pizzeria → being prepared → ready / out for delivery → completed*, plus estimated time until pickup/delivery and updates when Aldo changes status. Aldo needs a simple back-office view to accept/refuse orders, set prep time, and advance status. To be specified and built **last**, after the one-page site is complete and approved. Follow the mockup's visual language and keep scope close to it. Open questions for later: realtime transport (SSE/WebSocket/polling), storage, auth for the back-office, notifications (WhatsApp/SMS/email).

Stato: in attesa dell'approvazione della Fase 1. Nessun modello dati, UI o scelta di backend ancora fatta.

Punti di aggancio già pronti nella Fase 1:
- `src/data/menu.ts` — stessa forma che potrà arrivare da un'API.
- `src/pages/api/ordine.ts` — riceve l'ordine e assegna il numero (oggi: email ad Aldo).
