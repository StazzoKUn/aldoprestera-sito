// Email al cliente per le prenotazioni tavolo: parte solo quando Aldo decide (o la richiesta scade),
// anche quando cambia una prenotazione già confermata. Stesso stile e stesso trasporto delle email degli ordini.
import { fullAddress, site } from '../data/site';
import { env, esc, transport } from './notify';

/** Dati per l'email (vengono dalla prenotazione salvata) */
export interface ReservationEmail {
  name: string;
  email: string;
  people: number;
  /** "sabato 28 novembre, ore 20:30" */
  when: string;
  notes?: string | null;
  /** Pagina di stato (/prenotazione/<codice>), consultabile anche a browser chiuso */
  statusUrl?: string;
  /** Stato prima della decisione: se era già confermata, il testo spiega la modifica */
  previous?: 'richiesta' | 'confermata';
}

export type ReservationDecision = { kind: 'confermata' } | { kind: 'rifiutata'; reason: string } | { kind: 'annullata' };

const peopleTxt = (n: number) => (n === 1 ? '1 persona' : `${n} persone`);

export const reservationSubject = (o: ReservationEmail, d: ReservationDecision) =>
  d.kind === 'confermata'
    ? `Prenotazione confermata — ${o.when}`
    : d.kind === 'annullata'
      ? `Prenotazione annullata — ${o.when}`
      : o.previous === 'confermata'
        ? `Prenotazione non più confermata — ${o.when}`
        : 'Prenotazione non accettata';

const title = (o: ReservationEmail, d: ReservationDecision) =>
  d.kind === 'confermata'
    ? 'Prenotazione confermata'
    : d.kind === 'annullata'
      ? 'Prenotazione annullata'
      : o.previous === 'confermata'
        ? 'Prenotazione non più confermata'
        : 'Prenotazione non accettata';

const intro = (o: ReservationEmail, d: ReservationDecision) => {
  if (d.kind === 'confermata') return `la pizzeria ha confermato la tua prenotazione per ${peopleTxt(o.people)}, ${o.when}. Ti aspettiamo!`;
  if (d.kind === 'annullata') return `la tua prenotazione per ${peopleTxt(o.people)}, ${o.when}, è stata annullata dalla pizzeria. Se hai dubbi chiamaci.`;
  return o.previous === 'confermata'
    ? `purtroppo dobbiamo annullare la prenotazione che ti avevamo confermato. Motivo: ${d.reason}.`
    : `purtroppo non possiamo accettare la tua prenotazione. Motivo: ${d.reason}.`;
};

const footer = `Per annullare o modificare la prenotazione chiama il ristorante al ${site.phone}.`;

export const reservationText = (o: ReservationEmail, d: ReservationDecision) =>
  [
    `Ciao ${o.name.trim()},`,
    '',
    intro(o, d),
    '',
    `${peopleTxt(o.people)} · ${o.when}`,
    o.notes ? `Note: ${o.notes}` : null,
    '',
    ...(o.statusUrl ? [`Segui lo stato della prenotazione: ${o.statusUrl}`, ''] : []),
    footer,
    site.name,
  ]
    .filter((l) => l !== null)
    .join('\n');

export const reservationHtml = (o: ReservationEmail, d: ReservationDecision, logoUrl?: string) => {
  const serif = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
  const ok = d.kind === 'confermata';
  return `<!doctype html><html lang="it"><body style="margin:0;background:#141312;font-family:Helvetica,Arial,sans-serif;color:#f2efe9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#141312"><tr><td align="center" style="padding:40px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px">
<tr><td align="center">
  ${
    logoUrl
      ? `<img src="${esc(logoUrl)}" alt="${esc(site.name)}" width="180" style="display:block;width:180px;height:auto;border:0">`
      : `<div style="font-family:${serif};font-style:italic;font-size:30px">${esc(site.name)}</div>`
  }
  <div style="width:52px;height:52px;line-height:52px;border:1px solid #d0443f;border-radius:50%;color:#d0443f;font-size:22px;margin:28px auto 18px;text-align:center">${ok ? '&#10003;' : '&#10005;'}</div>
  <div style="font-family:${serif};font-style:italic;font-size:38px;line-height:1.05">${esc(title(o, d))}</div>
  <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#bdb8b0">Ciao ${esc(o.name.trim())}, ${esc(intro(o, d))}</p>
</td></tr>
<tr><td style="padding-top:26px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #33302c;border-bottom:1px solid #33302c">
    <tr><td style="padding:16px 0 4px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#8e8983">${esc(peopleTxt(o.people))}</td></tr>
    <tr><td style="padding:0 0 ${o.notes ? '8px' : '16px'};font-size:18px;color:#f2efe9">${esc(o.when)}</td></tr>
    ${o.notes ? `<tr><td style="padding:0 0 16px;font-size:14px;color:#bdb8b0">Note: ${esc(o.notes)}</td></tr>` : ''}
  </table>
  <p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#bdb8b0">${esc(footer)}</p>
</td></tr>
<tr><td style="padding-top:26px">
  ${
    o.statusUrl
      ? `<a href="${esc(o.statusUrl)}" style="display:block;background:#b8262d;padding:15px;text-align:center;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#ffffff;text-decoration:none;margin-bottom:10px">Guarda la prenotazione</a>
  <p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#8e8983;text-align:center;word-break:break-all">Puoi riaprire questa pagina quando vuoi:<br><a href="${esc(o.statusUrl)}" style="color:#bdb8b0">${esc(o.statusUrl)}</a></p>
  `
      : ''
  }<a href="${site.phoneHref}" style="display:block;border:1px solid #5a5650;padding:15px;text-align:center;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#f2efe9;text-decoration:none">Chiama la pizzeria · ${esc(site.phone)}</a>
  <p style="margin:14px 0 0;font-size:12px;color:#6e6963;text-align:center">${esc(site.name)} · ${esc(fullAddress)}</p>
</td></tr>
</table></td></tr></table></body></html>`;
};

/**
 * Email al cliente per la decisione di Aldo (o la scadenza). Restituisce false se non è partita:
 * la scelta di Aldo resta valida, il pannello mostrerà "Email non inviata".
 */
export const sendReservationEmail = async (o: ReservationEmail, d: ReservationDecision, logoUrl?: string): Promise<boolean> => {
  const t = transport();
  if (!t) {
    if (import.meta.env.DEV) {
      console.info(`\n[prenotazione] SMTP non configurato, email "${d.kind}" per ${o.email}:\n` + reservationText(o, d) + '\n');
      return true;
    }
    return false;
  }
  try {
    await t.sendMail({
      from: env('ORDER_FROM') ?? env('SMTP_USER'),
      to: o.email.trim(),
      replyTo: site.email,
      subject: reservationSubject(o, d),
      text: reservationText(o, d),
      html: reservationHtml(o, d, logoUrl),
    });
    return true;
  } catch (err) {
    console.error(`[prenotazione] email "${d.kind}" al cliente non inviata (${o.when})`, err);
    return false;
  }
};
