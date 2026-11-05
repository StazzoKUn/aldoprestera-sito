import nodemailer from 'nodemailer';
import { fullAddress, site } from '../data/site';
import { eur } from './format';
import { zoneById, type Mode, type OrderLine, type OrderRequest } from './order';

export interface PlacedOrder extends OrderRequest {
  number: string;
  lines: OrderLine[];
  fee: number;
  total: number;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const modeTxt = (m: Mode) => (m === 'consegna' ? 'Consegna' : 'Ritiro');
const payTxt = (o: PlacedOrder) => (o.pay === 'Contanti' ? 'contanti' : 'carta');
const telHref = (phone: string) => 'tel:' + phone.replace(/[^\d+]/g, '');
const addressLine = (o: PlacedOrder) => `${o.customer.street.trim()} ${o.customer.number.trim()}`;
const zoneName = (o: PlacedOrder) => zoneById(o.customer.zone).name;
const intercom = (o: PlacedOrder) => (o.customer.intercom.trim() ? ` · citofono ${o.customer.intercom.trim()}` : '');
const mapHref = (o: PlacedOrder) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${addressLine(o)}, ${zoneName(o)}`)}`;

/* ---------- Comanda per la pizzeria ---------- */

export const subject = (o: PlacedOrder) => `Nuovo ordine #${o.number} — ${modeTxt(o.mode)} ore ${o.slot}`;

/** Testo semplice: alternativa all'HTML e log di sviluppo */
export const orderText = (o: PlacedOrder) => {
  const c = o.customer;
  return [
    subject(o),
    '',
    c.name.trim(),
    c.phone.trim(),
    c.email.trim(),
    o.mode === 'consegna' ? `${addressLine(o)}, ${zoneName(o)}${intercom(o)}` : null,
    '',
    ...o.lines.map((l) => `${l.qty}× ${l.name}  ${eur(l.total)}`),
    o.fee > 0 ? `Consegna  ${eur(o.fee)}` : null,
    `Totale (${payTxt(o)})  ${eur(o.total)}`,
    c.notes.trim() ? `\nNote: ${c.notes.trim()}` : null,
    '',
    `Chiama cliente: ${telHref(c.phone)}`,
    o.mode === 'consegna' ? `Apri su mappa: ${mapHref(o)}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n');
};

/** Messaggio WhatsApp (formattazione *grassetto* di WhatsApp) */
export const orderWhatsApp = (o: PlacedOrder) => {
  const c = o.customer;
  return [
    `*Nuovo ordine #${o.number}*`,
    `*${modeTxt(o.mode)} ore ${o.slot}*`,
    '',
    c.name.trim(),
    c.phone.trim(),
    o.mode === 'consegna' ? `${addressLine(o)}, ${zoneName(o)}${intercom(o)}` : null,
    '',
    ...o.lines.map((l) => `${l.qty}× ${l.name} — ${eur(l.total)}`),
    o.fee > 0 ? `Consegna — ${eur(o.fee)}` : null,
    `*Totale ${eur(o.total)}* (${payTxt(o)})`,
    c.notes.trim() ? `\nNote: ${c.notes.trim()}` : null,
    o.mode === 'consegna' ? `\nMappa: ${mapHref(o)}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n');
};

/** Email come nel mockup 1g */
export const orderHtml = (o: PlacedOrder) => {
  const c = o.customer;
  const row = (l: string, r: string, bold = false) =>
    `<tr><td style="padding:4px 0;${bold ? 'font-weight:600' : ''}">${l}</td><td style="padding:4px 0;text-align:right;${bold ? 'font-weight:600' : ''}">${r}</td></tr>`;
  const btn = (href: string, label: string, dark: boolean) =>
    `<a href="${esc(href)}" style="display:block;padding:13px;text-align:center;font-size:13px;font-weight:500;text-decoration:none;${
      dark ? 'background:#1a1817;color:#fff;' : 'border:1px solid #1a1817;color:#1a1817;'
    }">${label}</a>`;
  return `<!doctype html><html lang="it"><body style="margin:0;background:#f2efe9;font-family:Helvetica,Arial,sans-serif;color:#1a1817">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff">
<tr><td style="padding:18px 22px;border-bottom:1px solid #eee">
  <div style="font-size:17px;font-weight:600">${esc(subject(o))}</div>
</td></tr>
<tr><td style="padding:22px;font-size:15px">
  <div style="font-weight:600">${esc(c.name.trim())}</div>
  <div><a href="${telHref(c.phone)}" style="color:#c23a3a;text-decoration:none">${esc(c.phone.trim())}</a> · ${esc(c.email.trim())}</div>
  ${o.mode === 'consegna' ? `<div style="color:#5f5a54">${esc(`${addressLine(o)}, ${zoneName(o)}${intercom(o)}`)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#f6f4f0;padding:10px 16px">
    ${o.lines.map((l) => row(`<b>${l.qty}×</b> ${esc(l.name)}`, eur(l.total))).join('')}
    ${o.fee > 0 ? row('Consegna', eur(o.fee)) : ''}
    <tr><td colspan="2" style="border-top:1px solid #e2ded7;padding-top:4px"></td></tr>
    ${row(`Totale (${payTxt(o)})`, eur(o.total), true)}
  </table>
  ${c.notes.trim() ? `<div style="margin-top:16px;font-size:14px;color:#5f5a54"><b style="color:#1a1817">Note:</b> ${esc(c.notes.trim())}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>
    <td width="50%" style="padding-right:4px">${btn(telHref(c.phone), 'Chiama cliente', true)}</td>
    <td width="50%" style="padding-left:4px">${o.mode === 'consegna' ? btn(mapHref(o), 'Apri su mappa', false) : ''}</td>
  </tr></table>
</td></tr></table>
</td></tr></table></body></html>`;
};

/* ---------- Riepilogo per il cliente ---------- */

export const customerSubject = (o: PlacedOrder) => `Il tuo ordine #${o.number} — ${modeTxt(o.mode)} ore ${o.slot}`;

const whenTxt = (o: PlacedOrder) => (o.mode === 'consegna' ? `Consegna alle ${o.slot}.` : `Pronta alle ${o.slot}.`);
const whereTxt = (o: PlacedOrder) =>
  o.mode === 'consegna' ? `${addressLine(o)}, ${zoneName(o)}${intercom(o)}` : `Ritiro in pizzeria: ${fullAddress}`;

export const customerText = (o: PlacedOrder) =>
  [
    `Ciao ${o.customer.name.trim()},`,
    '',
    `abbiamo ricevuto il tuo ordine n. ${o.number}. Ti chiamiamo per confermare. ${whenTxt(o)}`,
    '',
    whereTxt(o),
    '',
    ...o.lines.map((l) => `${l.qty}× ${l.name}  ${eur(l.total)}`),
    o.fee > 0 ? `Consegna  ${eur(o.fee)}` : null,
    `Totale  ${eur(o.total)} · si paga alla consegna (${payTxt(o)})`,
    o.customer.notes.trim() ? `\nNote: ${o.customer.notes.trim()}` : null,
    '',
    `Per modifiche o per annullare chiamaci al ${site.phone}.`,
    site.name,
  ]
    .filter((l) => l !== null)
    .join('\n');

/** Stesso stile della conferma 1f: sfondo scuro, serif corsivo */
export const customerHtml = (o: PlacedOrder, logoUrl?: string) => {
  const serif = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
  const line = (l: string, r: string, style = '') =>
    `<tr><td style="padding:5px 0;font-size:15px;${style}">${l}</td><td style="padding:5px 0;font-size:15px;text-align:right;${style}">${r}</td></tr>`;
  return `<!doctype html><html lang="it"><body style="margin:0;background:#141312;font-family:Helvetica,Arial,sans-serif;color:#f2efe9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#141312"><tr><td align="center" style="padding:40px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px">
<tr><td align="center">
  ${
    logoUrl
      ? `<img src="${esc(logoUrl)}" alt="${esc(site.name)}" width="180" style="display:block;width:180px;height:auto;border:0">`
      : `<div style="font-family:${serif};font-style:italic;font-size:30px">${esc(site.name)}</div>`
  }
  <div style="width:52px;height:52px;line-height:52px;border:1px solid #d0443f;border-radius:50%;color:#d0443f;font-size:22px;margin:28px auto 18px;text-align:center">&#10003;</div>
  <div style="font-family:${serif};font-style:italic;font-size:38px;line-height:1.05">Ordine ricevuto</div>
  <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#bdb8b0">Ciao ${esc(o.customer.name.trim())}, ti chiamiamo per confermare. ${whenTxt(o)}</p>
</td></tr>
<tr><td style="padding-top:26px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #33302c;border-bottom:1px solid #33302c">
    <tr><td style="padding:16px 0 8px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#8e8983">Ordine n. ${o.number}</td>
        <td style="padding:16px 0 8px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#8e8983;text-align:right">ore ${o.slot}</td></tr>
    <tr><td colspan="2" style="padding:0 0 10px;font-size:14px;color:#bdb8b0">${esc(whereTxt(o))}</td></tr>
    ${o.lines.map((l) => line(`<b style="color:#d0443f;font-weight:600">${l.qty}×</b> ${esc(l.name)}`, eur(l.total))).join('')}
    ${o.fee > 0 ? line('Consegna', eur(o.fee)) : ''}
    ${line(`Totale · ${payTxt(o)}`, eur(o.total), 'font-size:18px;font-weight:600;padding:10px 0 16px')}
  </table>
  ${o.customer.notes.trim() ? `<p style="margin:16px 0 0;font-size:14px;color:#bdb8b0"><b style="color:#f2efe9">Note:</b> ${esc(o.customer.notes.trim())}</p>` : ''}
  <p style="margin:16px 0 0;font-size:14px;color:#bdb8b0">Si paga alla consegna, in contanti o con carta.</p>
</td></tr>
<tr><td style="padding-top:26px">
  <a href="${site.phoneHref}" style="display:block;border:1px solid #5a5650;padding:15px;text-align:center;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#f2efe9;text-decoration:none">Chiama la pizzeria · ${esc(site.phone)}</a>
  <p style="margin:14px 0 0;font-size:12px;color:#6e6963;text-align:center">Per modifiche o per annullare l'ordine chiamaci.<br>${esc(site.name)} · ${esc(fullAddress)}</p>
</td></tr>
</table></td></tr></table></body></html>`;
};

/* ---------- Invio ---------- */

const env = (k: string): string | undefined => process.env[k] ?? import.meta.env[k];

const transport = () => {
  const host = env('SMTP_HOST');
  if (!host) return null;
  const port = Number(env('SMTP_PORT') ?? 587);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: env('SMTP_USER') ? { user: env('SMTP_USER')!, pass: env('SMTP_PASS') ?? '' } : undefined,
  });
};

/**
 * Comanda ad Aldo via email: è il canale principale, se fallisce l'ordine non è valido.
 * Senza SMTP: in sviluppo stampa in console, in produzione fallisce.
 */
export const sendOrderEmail = async (o: PlacedOrder) => {
  const t = transport();
  const to = env('ORDER_TO');
  if (!t || !to) {
    if (import.meta.env.DEV) return void console.info('\n[ordine] SMTP non configurato, comanda:\n' + orderText(o) + '\n');
    throw new Error('SMTP non configurato');
  }
  await t.sendMail({ from: env('ORDER_FROM') ?? env('SMTP_USER'), to, subject: subject(o), text: orderText(o), html: orderHtml(o) });
};

/** Riepilogo al cliente. Restituisce false se non è partito (non blocca l'ordine). */
export const sendCustomerEmail = async (o: PlacedOrder, logoUrl?: string): Promise<boolean> => {
  const t = transport();
  if (!t) {
    if (import.meta.env.DEV) {
      console.info(`\n[ordine] SMTP non configurato, riepilogo per ${o.customer.email}:\n` + customerText(o) + '\n');
      return true;
    }
    return false;
  }
  try {
    await t.sendMail({
      from: env('ORDER_FROM') ?? env('SMTP_USER'),
      to: o.customer.email.trim(),
      replyTo: site.email,
      subject: customerSubject(o),
      text: customerText(o),
      html: customerHtml(o, logoUrl),
    });
    return true;
  } catch (err) {
    console.error(`[ordine] riepilogo al cliente non inviato (#${o.number})`, err);
    return false;
  }
};
