import { useEffect, useState } from 'preact/hooks';
import { eur } from '../../lib/format';

// Pagina di attesa dell'ordine: stesso stile della conferma del mockup (1f), ma con lo stato vivo.
// Chiede lo stato ogni 10 secondi a /api/ordine/stato/<codice>; la pagina non vede mai altro che
// stato, motivo del rifiuto e riepilogo.

interface PublicOrder {
  numero_ordine: string;
  stato: 'bozza' | 'ricevuto' | 'accettato' | 'consegnato' | 'rifiutato' | 'annullato';
  motivo_stato: string | null;
  modalita: 'consegna' | 'asporto';
  orario_richiesto: string;
  metodo_pagamento: string;
  attesa_secondi: number;
  costo_consegna: number;
  totale: number;
  righe: { nome_prodotto: string; quantita: number; totale_riga: number }[];
}

interface Props {
  code: string;
  logo: string;
  phone: string;
  phoneHref: string;
}

const POLL_MS = 10_000;
const SLOW_AFTER_S = 5 * 60; // "Ci stiamo mettendo più del solito"
const LS_WAIT = 'aldo:attesa';

const store = (code: string | null) => {
  try {
    if (code) localStorage.setItem(LS_WAIT, JSON.stringify(code));
    else localStorage.removeItem(LS_WAIT);
  } catch {
    /* localStorage non disponibile */
  }
};

const hhmm = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

export default function WaitApp({ code, logo, phone, phoneHref }: Props) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  /** secondi di attesa secondo il server al momento dell'ultima risposta, e quando l'abbiamo ricevuta */
  const [base, setBase] = useState<{ s: number; at: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [missing, setMissing] = useState(!code);
  const [offline, setOffline] = useState(false);

  const stato = order?.stato;
  const active = !stato || stato === 'ricevuto' || stato === 'accettato';

  // Polling dello stato finché l'ordine non è concluso
  useEffect(() => {
    if (!code || missing) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/ordine/stato/${encodeURIComponent(code)}`, { cache: 'no-store' });
        if (res.status === 404) {
          if (alive) {
            setMissing(true);
            store(null);
          }
          return;
        }
        const data = await res.json();
        if (!alive) return;
        if (!res.ok || !data?.ok) throw new Error();
        setOrder(data.ordine);
        setBase({ s: data.ordine.attesa_secondi, at: Date.now() });
        setOffline(false);
        // Il codice resta nel browser solo finché l'ordine è aperto
        store(data.ordine.stato === 'ricevuto' || data.ordine.stato === 'accettato' ? code : null);
      } catch {
        if (alive) setOffline(true);
      }
    };
    load();
    if (!active) return () => (alive = false);
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [code, missing, active]);

  // Orologio per il messaggio dei 5 minuti
  useEffect(() => {
    if (stato !== 'ricevuto') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stato]);

  const waited = base ? base.s + (now - base.at) / 1000 : 0;
  const slow = stato === 'ricevuto' && waited >= SLOW_AFTER_S;

  const logoEl = (
    <a href="/" aria-label="Torna al sito">
      <img src={logo} alt="Aldo Prestera Pizzeria" class="o-confirm__logo" width={220} />
    </a>
  );
  const callBtn = (
    <a href={phoneHref} class="o-btn-outline">
      Chiama la pizzeria
    </a>
  );

  if (missing) {
    return (
      <div class="o-confirm">
        <div class="o-confirm__body">
          {logoEl}
          <h1>Ordine non trovato</h1>
          <p>Il link non è valido o l'ordine non esiste più. Se hai appena ordinato, chiamaci.</p>
        </div>
        <div class="o-confirm__actions">
          {callBtn}
          <a href="/ordina" class="o-btn-outline">
            Torna al menù
          </a>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div class="o-confirm">
        <div class="o-confirm__body">
          {logoEl}
          <div class="o-wait__ring" aria-hidden="true" />
          <p role="status">{offline ? 'Non riusciamo a collegarci, riproviamo…' : 'Controllo lo stato del tuo ordine…'}</p>
        </div>
        <div class="o-confirm__actions">{callBtn}</div>
      </div>
    );
  }

  const isC = order.modalita === 'consegna';
  const slot = hhmm(order.orario_richiesto);
  const view = {
    ricevuto: { icon: null, title: 'In attesa di conferma dalla pizzeria', text: 'Appena la pizzeria risponde questa pagina si aggiorna da sola: non serve ricaricarla.' },
    accettato: { icon: '✓', title: 'Ordine accettato', text: isC ? `La pizzeria ha confermato. Consegna alle ${slot}.` : `La pizzeria ha confermato. Pronta per il ritiro alle ${slot}.` },
    consegnato: { icon: '✓', title: isC ? 'Ordine consegnato' : 'Ordine ritirato', text: 'Buon appetito!' },
    rifiutato: { icon: '✕', title: 'Ordine non accettato', text: order.motivo_stato ?? 'La pizzeria non ha potuto accettare l’ordine.' },
    annullato: { icon: '✕', title: 'Ordine non disponibile', text: 'Questo ordine non è più attivo. Per informazioni chiamaci.' },
    bozza: { icon: null, title: 'Ordine in preparazione', text: 'Stiamo completando l’invio dell’ordine.' },
  }[order.stato];

  return (
    <div class="o-confirm">
      <div class="o-confirm__body">
        {logoEl}
        {view.icon ? (
          <div class="o-confirm__check" aria-hidden="true">
            {view.icon}
          </div>
        ) : (
          <div class="o-wait__ring" aria-hidden="true" />
        )}
        <div class="o-wait__status" aria-live="polite">
          <h1 class={order.stato === 'ricevuto' ? 'o-wait__title' : undefined}>{view.title}</h1>
          <p>{view.text}</p>
          {slow && (
            <p class="o-wait__slow">
              Ci stiamo mettendo più del solito. Se hai fretta chiamaci al <a href={phoneHref}>{phone}</a>.
            </p>
          )}
          {offline && <p class="o-wait__offline">Connessione assente: riproviamo ad aggiornare.</p>}
        </div>
        <div class="o-confirm__recap">
          <div class="o-confirm__meta">
            <span>Ordine n. {order.numero_ordine}</span>
            <span>ore {slot}</span>
          </div>
          {order.righe.map((l) => (
            <div class="o-qline">
              <span>
                <b>{l.quantita}×</b> {l.nome_prodotto}
              </span>
              <span>{eur(l.totale_riga)}</span>
            </div>
          ))}
          {order.costo_consegna > 0 && (
            <div class="o-qline">
              <span>Consegna</span>
              <span>{eur(order.costo_consegna)}</span>
            </div>
          )}
          <div class="o-confirm__total">
            <span>Totale · contanti</span>
            <span>{eur(order.totale)}</span>
          </div>
        </div>
      </div>
      <div class="o-confirm__actions">
        {callBtn}
        {(order.stato === 'rifiutato' || order.stato === 'consegnato') && (
          <a href="/ordina" class="o-btn-outline">
            {order.stato === 'rifiutato' ? 'Prova a ordinare di nuovo' : 'Fai un altro ordine'}
          </a>
        )}
      </div>
    </div>
  );
}
