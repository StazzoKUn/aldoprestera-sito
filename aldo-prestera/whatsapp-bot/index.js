// Servizio WhatsApp per le comande: riceve il testo dal sito e lo inoltra al numero di Aldo.
// Usa whatsapp-web.js (WhatsApp Web in un Chromium nascosto) collegato al numero dedicato del sito.
//
// Variabili d'ambiente (vedi .env.example):
//   WA_TO         numero di Aldo, solo cifre con prefisso internazionale (es. 393331234567)
//   WA_BOT_TOKEN  segreto condiviso con il sito
//   WA_PORT       porta HTTP (default 3100), in ascolto solo su 127.0.0.1

import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';

const { Client, LocalAuth } = pkg;

// Carica .env se presente (senza dipendenze)
if (existsSync(new URL('./.env', import.meta.url))) {
  for (const line of readFileSync(new URL('./.env', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const TO = (process.env.WA_TO ?? '').replace(/\D/g, '');
const TOKEN = process.env.WA_BOT_TOKEN ?? '';
const PORT = Number(process.env.WA_PORT ?? 3100);

if (!TO || !TOKEN) {
  console.error('Imposta WA_TO e WA_BOT_TOKEN (vedi .env.example).');
  process.exit(1);
}

const log = (...a) => console.log(new Date().toISOString(), ...a);

let ready = false;
let chatId = null;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

client.on('qr', (qr) => {
  log('Scansiona il QR con WhatsApp del numero del sito (Impostazioni → Dispositivi collegati):');
  qrcode.generate(qr, { small: true });
});
client.on('authenticated', () => log('Autenticato.'));
client.on('auth_failure', (m) => log('Autenticazione fallita:', m));
client.on('ready', async () => {
  try {
    // Risolve il numero di Aldo in una chat WhatsApp valida
    const id = await client.getNumberId(TO);
    if (!id) throw new Error(`il numero ${TO} non risulta su WhatsApp`);
    chatId = id._serialized;
    ready = true;
    log(`Pronto. Le comande vanno a ${TO}.`);
  } catch (err) {
    log('Errore:', err.message);
  }
});
client.on('disconnected', (reason) => {
  ready = false;
  log('Disconnesso:', reason, '— riprovo tra 15 s');
  setTimeout(() => client.initialize().catch((e) => log('Riavvio fallito:', e.message)), 15_000);
});

client.initialize().catch((e) => {
  log('Avvio fallito:', e.message);
  process.exit(1);
});

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, ready ? 200 : 503, { ready });
  if (req.method !== 'POST' || req.url !== '/send') return send(res, 404, { error: 'not found' });
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'unauthorized' });
  if (!ready || !chatId) return send(res, 503, { error: 'WhatsApp non collegato' });

  let raw = '';
  req.on('data', (c) => {
    raw += c;
    if (raw.length > 20_000) req.destroy();
  });
  req.on('end', async () => {
    let text;
    try {
      text = JSON.parse(raw).text;
    } catch {
      return send(res, 400, { error: 'JSON non valido' });
    }
    if (typeof text !== 'string' || !text.trim()) return send(res, 400, { error: 'testo mancante' });
    try {
      // Il destinatario è sempre e solo il numero di Aldo
      await client.sendMessage(chatId, text.slice(0, 4000));
      log('Comanda inviata.');
      send(res, 200, { ok: true });
    } catch (err) {
      log('Invio fallito:', err.message);
      send(res, 502, { error: err.message });
    }
  });
});

server.listen(PORT, '127.0.0.1', () => log(`In ascolto su http://127.0.0.1:${PORT}`));

const stop = async () => {
  server.close();
  await client.destroy().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
