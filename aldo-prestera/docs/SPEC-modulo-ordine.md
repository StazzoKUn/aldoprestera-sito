# Specifica — Modulo di ordinazione online

Stato: **in progettazione**. Il flusso base esiste già (vedi §1); i punti in §2 sono requisiti decisi ma non ancora sviluppati; §3 sono decisioni aperte.

## 1. Come funziona oggi

1. **Menù** — Consegna / Ritiro, carrello con −/+, consegna € 2,00 solo in consegna. Carrello salvato nel browser.
2. **Dati e orario** — Nome*, Telefono*, Indirizzo* e N°* (solo consegna), Citofono/piano, Orario* (slot da 15', solo oggi, con anticipo minimo), Note, Pagamento alla consegna (Contanti / Carta-POS).
3. **Invio** — il server ricalcola prezzi e totali dal menù, verifica lo slot, assegna il n° d'ordine e invia la **comanda ad Aldo** via email.
4. **Conferma a schermo** — "Ordine ricevuto", n° ordine, orario, riepilogo, "Chiama la pizzeria".

## 2. Requisiti decisi

### 2.1 Comanda alla pizzeria
Email con: n° ordine, Consegna/Ritiro + orario, cliente, telefono cliccabile, indirizzo e citofono, righe, totale e metodo di pagamento, note, pulsanti "Chiama cliente" e "Apri su mappa" (mockup 1g).

### 2.2 Email di riepilogo al cliente  *(nuovo)*
Dopo l'invio, il cliente riceve un'email di recap del suo ordine.

- **Nuovo campo nel passo 2:** `Email` **obbligatoria** (tipo email, validata lato client e server), dopo il Telefono. Etichetta "Email", aiuto: "Ti mandiamo il riepilogo dell'ordine". Errori: "Inserisci la tua email." / "Email non valida."
- **Quando parte:** subito dopo che la comanda è stata inviata alla pizzeria.
- **Mittente:** `ordini@…` con *Reply-To* l'indirizzo della pizzeria.
- **Oggetto:** `Il tuo ordine #0142 — Consegna ore 20:15` / `… — Ritiro ore 20:15`.
- **Contenuto** (stesso stile della conferma 1f, sfondo scuro, logo):
  - "Ordine ricevuto. Ti chiamiamo per confermare."
  - n° ordine, modalità e orario ("Consegna alle 20:15" / "Pronta alle 20:15")
  - indirizzo di consegna e citofono (se consegna) oppure indirizzo della pizzeria (se ritiro)
  - righe ordine, consegna, totale e metodo di pagamento ("si paga alla consegna")
  - note inserite
  - telefono della pizzeria cliccabile per modifiche o annullamenti
- **Se fallisce solo l'email al cliente:** l'ordine resta valido (la comanda è arrivata), il cliente vede comunque la conferma a schermo; l'errore viene solo registrato nei log.
- **Se fallisce la comanda alla pizzeria:** l'ordine non è valido, nessuna email al cliente, errore a schermo con il telefono.
- In Fase 2 lo stesso canale servirà per gli aggiornamenti di stato (accettato, in preparazione, in consegna…).

### 2.3 Comanda anche su WhatsApp
Oltre all'email, la comanda arriva su WhatsApp ad Aldo, usando [whatsapp-web.js](https://wwebjs.dev/).

- **Come funziona la libreria:** non è l'API ufficiale di WhatsApp. Apre WhatsApp Web in un Chromium nascosto (Puppeteer) collegato a un numero, che si abbina una volta sola scansionando un QR code dal telefono, come per WhatsApp Web.
- **Numero mittente:** un numero dedicato (SIM separata) per il sito, che scrive al numero di Aldo. **Non** il numero personale o della pizzeria: se WhatsApp lo blocca, si perde solo il numero del sito.
- **Messaggio:** testo semplice con n° ordine, Consegna/Ritiro + orario, cliente, telefono, indirizzo, righe, totale e pagamento, note, link "Apri su mappa".
- **Architettura:** un piccolo servizio separato (`whatsapp-bot`), sempre acceso sullo stesso server, raggiungibile solo in locale. L'endpoint `/api/ordine` gli passa la comanda. Separato perché Chromium è pesante, va riavviato da solo e non deve far cadere il sito.
- **Regola di affidabilità:** l'**email resta il canale principale**. Se WhatsApp non è collegato o fallisce, l'ordine è comunque valido (l'email è arrivata) e l'errore viene registrato.
- **Rischi da accettare:**
  - blocco del numero: rischio **molto basso**. Il bot scrive solo ad Aldo, che lo ha in rubrica e lo aspetta; nessun messaggio a clienti o sconosciuti, quindi nessuna segnalazione possibile. Resta solo il caso raro di blocco per client non ufficiale.
    Accorgimenti: Aldo salva il numero del sito in rubrica e risponde al primo messaggio; il bot non scrive mai ad altri numeri (destinatario fisso da configurazione);
  - si rompe quando WhatsApp aggiorna WhatsApp Web, finché la libreria non viene aggiornata;
  - serve un server sempre acceso con Chromium (no hosting serverless) e un telefono con il numero del sito che si colleghi almeno ogni 14 giorni.
- **Alternativa ufficiale:** WhatsApp Cloud API di Meta. Stabile e consentita, ma richiede un account Business verificato, un modello di messaggio approvato e costa qualche centesimo a messaggio.

### 2.4 Pagamento online con Stripe  *(nuovo)*
Accanto al pagamento alla consegna, il cliente può pagare subito online.

- **Scelte nel passo 2 (Pagamento), uguali per consegna e ritiro:** Contanti · Carta / POS (alla consegna o al ritiro, come nel mockup) · **Paga ora online** come opzione in più. Predefinito: Contanti, come oggi.
- **Provider:** Stripe Checkout, pagina di pagamento ospitata da Stripe. Metodi attivati dalla dashboard Stripe: carte, **Apple Pay**, **Google Pay** e gli altri metodi locali disponibili (es. PayPal tramite Stripe, Link). Con la pagina ospitata Apple Pay funziona senza verifica del dominio.
- **Flusso:**
  1. "Invia ordine" → il server salva l'ordine come *in attesa di pagamento*, blocca la fascia oraria per 20 minuti e crea la sessione Stripe Checkout con le righe e la consegna.
  2. Il cliente paga sulla pagina Stripe.
  3. Il **webhook** `checkout.session.completed` segna l'ordine *pagato* e solo allora fa partire comanda (email + WhatsApp, con "PAGATO ONLINE"), riepilogo al cliente e conferma.
  4. Ritorno sul sito: pagina di conferma con "Pagamento ricevuto". Se il cliente annulla, torna al passo 2 con il carrello intatto.
  5. Sessione scaduta o non pagata → ordine *scaduto*, fascia liberata, nessuna comanda.
- **Importi:** calcolati solo dal server dal menù (mai dal browser), in euro.
- **Rimborsi:** se Aldo non può evadere un ordine pagato, rimborso dalla dashboard Stripe (in Fase 2 dal back-office).
- **Testi:** restano quelli del mockup ("Pagamento alla consegna", "Paghi alla consegna · contanti o carta"); si aggiunge solo l'opzione "Paga ora online". Per gli ordini pagati la conferma diventa "Pagamento ricevuto. Ordine confermato." al posto di "Ti chiamiamo per confermare".
- **Requisiti:** archivio degli ordini (stati: in attesa, pagato, scaduto); account Stripe intestato alla pizzeria con IBAN di Aldo; chiavi di test per lo sviluppo, chiavi live solo in produzione.
- **Landing:** invariata rispetto al mockup (il pagamento alla consegna resta disponibile).
- **Fisco:** il pagamento online non sostituisce il documento commerciale; da verificare con il commercialista di Aldo.

## 3. Decisioni prese

- **Email del cliente obbligatoria** (28/10/2026).
- **Varianti:** nessuna; richieste particolari nel campo Note (28/10/2026).
- **Privacy:** casella obbligatoria prima di "Invia ordine": "Ho letto l'[informativa privacy](/privacy)". Senza spunta l'ordine non parte; errore "Devi accettare l'informativa privacy." (28/10/2026).
- **Giorni:** si ordina solo per la sera stessa (28/10/2026).
- **Pagamento online:** Stripe Checkout con carte, Apple Pay, Google Pay. Il pagamento alla consegna/al ritiro **resta come nel mockup**; il pagamento online è un'opzione in più (28/10/2026).
- **WhatsApp:** comanda anche su WhatsApp con whatsapp-web.js, da un numero dedicato al sito verso il numero di Aldo; rischi in §2.3 accettati; l'email resta il canale principale (28/10/2026).

## 4. Decisioni aperte

| # | Domanda | Proposta |
| --- | --- | --- |
| 1 | Numero dedicato del sito e numero di Aldo che riceve le comande | Da fornire |
| 1b | Account Stripe della pizzeria (e chiavi di test per lo sviluppo) | Da creare a nome di Aldo |
| 2 | ~~Capacità per slot~~ | Nessun limite: sarà Aldo a bloccare le fasce da una sua interfaccia (da sviluppare) |
| 3 | Zona di consegna, ordine minimo, tariffa per zona | Da chiedere ad Aldo |
| 4 | Chiusura straordinaria degli ordini online (serata piena, ferie) | Interruttore in Fase 2 |
