# whatsapp-bot

Inoltra le comande del sito su WhatsApp al numero di Aldo, usando [whatsapp-web.js](https://wwebjs.dev/).
L'email resta il canale principale: se il bot è spento o scollegato, gli ordini arrivano comunque via email.

## Primo avvio

1. `cp .env.example .env` e imposta `WA_TO` (numero di Aldo) e `WA_BOT_TOKEN`.
2. `npm install` e `npm start`.
3. Compare un QR nel terminale: dal telefono con il **numero dedicato del sito** apri WhatsApp →
   Impostazioni → Dispositivi collegati → Collega un dispositivo, e scansiona.
4. La sessione resta salvata in `.wwebjs_auth/`: ai riavvii successivi non serve più il QR.

Aldo deve salvare in rubrica il numero del sito e rispondere al primo messaggio.
Il telefono con il numero del sito deve collegarsi a internet almeno ogni 14 giorni circa.

## Collegamento con il sito

Nel `.env` del sito:

```
WA_BOT_URL=http://127.0.0.1:3100
WA_BOT_TOKEN=lo-stesso-segreto
```

Il bot ascolta solo su `127.0.0.1`, quindi deve girare sulla stessa macchina del sito.
Per tenerlo sempre acceso in produzione usare un process manager (es. `pm2 start index.js --name whatsapp-bot`).

## Endpoint

- `GET /health` → `{ ready: true|false }`
- `POST /send` con `Authorization: Bearer <WA_BOT_TOKEN>` e corpo `{ "text": "..." }` → invia a `WA_TO`
