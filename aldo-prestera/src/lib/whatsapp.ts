// Invio della comanda al servizio whatsapp-bot (cartella /whatsapp-bot), in ascolto solo in locale.

const env = (k: string): string | undefined => process.env[k] ?? import.meta.env[k];

/**
 * Manda il testo al bot, che lo inoltra al numero di Aldo (fissato nella configurazione del bot).
 * Non lancia mai: WhatsApp è un canale in più, l'email resta quello principale.
 */
export const sendWhatsApp = async (text: string, ref: string): Promise<boolean> => {
  const url = env('WA_BOT_URL');
  if (!url) {
    if (import.meta.env.DEV) console.info('[whatsapp] WA_BOT_URL non impostato, messaggio non inviato');
    return false;
  }
  try {
    const res = await fetch(new URL('/send', url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('WA_BOT_TOKEN') ?? ''}` },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().catch(() => '')}`);
    return true;
  } catch (err) {
    console.error(`[whatsapp] comanda ${ref} non inviata`, err);
    return false;
  }
};
