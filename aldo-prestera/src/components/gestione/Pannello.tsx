import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { eur } from '../../lib/format';
import { MOTIVI_RIFIUTO } from '../../lib/motivi';
import type { Scheda } from '../../lib/gestione';

// Pannello di Aldo (/gestione): tre liste che si aggiornano ogni 10 secondi, suono finché ci sono
// ordini da accettare, azioni con un tocco e storico. Parla solo con /api/gestione/*.

type Card = Scheda & { email_non_inviata: boolean };
interface Lists {
  da_accettare: Card[];
  in_corso: Card[];
  chiusi_oggi: Card[];
}
type Tab = 'da' | 'corso' | 'chiusi';

interface Props {
  userName: string;
  logo: { src: string; srcset: string };
}

const POLL_MS = 10_000;
const BEEP_EVERY_MS = 4_000;
const UNDO_MS = 6_000;

/* ---------- Utilità ---------- */

async function api(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (res.status === 401) location.assign('/gestione/login'); // sessione scaduta
    return { ok: res.ok && data?.ok !== false, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

const hhmm = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
const cents = (n: number) => Math.round(n * 100);
const telHref = (p: string) => 'tel:' + p.replace(/[^\d+]/g, '');
const shortNum = (n: string) => n.replace(/^ORD-\d{4}-0*/, '#');
const deliverLabel = (o: Card) => (o.modalita === 'consegna' ? 'Consegnato' : 'Ritirato');

const statoLabel = (o: Card) => {
  if (o.stato === 'ricevuto') return 'Da accettare';
  if (o.stato === 'accettato') return 'Accettato';
  if (o.stato === 'consegnato') return deliverLabel(o);
  if (o.stato === 'rifiutato') return o.scaduto ? 'Scaduto' : 'Rifiutato';
  return 'Annullato';
};

/** Due note ripetute: si sente anche con il telefono in tasca */
function beep(ctx: AudioContext) {
  const t = ctx.currentTime;
  [
    [0, 880],
    [0.25, 1175],
  ].forEach(([at, freq]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq!;
    gain.gain.setValueAtTime(0.0001, t + at!);
    gain.gain.exponentialRampToValueAtTime(0.5, t + at! + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + at! + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + at!);
    osc.stop(t + at! + 0.25);
  });
}

/* ---------- Componenti ---------- */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} class="g-modal" onClose={onClose} onCancel={onClose} aria-labelledby="g-modal-title">
      <div class="g-modal__body">
        <h2 id="g-modal-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

function OrderCard(p: {
  o: Card;
  busy: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onDeliver?: () => void;
}) {
  const { o } = p;
  const isC = o.modalita === 'consegna';
  const decided = o.stato === 'accettato' || o.stato === 'rifiutato';
  return (
    <article class={`g-card g-card--${o.stato}`} aria-label={`Ordine ${o.numero_ordine}`}>
      <header class="g-card__head">
        <span class="g-card__time">{hhmm(o.orario_richiesto)}</span>
        <span class={`g-tag g-tag--${isC ? 'consegna' : 'ritiro'}`}>{isC ? 'Consegna' : 'Ritiro'}</span>
        <span class="g-card__num">{shortNum(o.numero_ordine)}</span>
        <span class={`g-status g-status--${o.stato}${o.scaduto ? ' is-scaduto' : ''}`}>{statoLabel(o)}</span>
      </header>

      <div class="g-card__who">
        <strong>{o.nome_cliente}</strong>
        <span>Paga in contanti</span>
      </div>
      {isC && (
        <p class="g-card__addr">
          {o.indirizzo ?? 'Indirizzo non indicato'}
          {o.citofono && <span> · citofono {o.citofono}</span>}
        </p>
      )}

      <ul class="g-card__items">
        {o.righe.map((r) => (
          <li key={r.id}>
            <b>{r.quantita}×</b> {r.nome_prodotto}
          </li>
        ))}
      </ul>
      {o.note && <p class="g-card__notes">Note: {o.note}</p>}

      <div class="g-card__total">
        <span>Totale{isC && o.costo_consegna > 0 ? ` (con consegna ${eur(o.costo_consegna)})` : ''}</span>
        <strong>{eur(o.totale)}</strong>
      </div>

      {o.stato === 'rifiutato' && o.motivo_stato && <p class="g-card__reason">Motivo: {o.motivo_stato}</p>}
      {o.email_non_inviata && decided && (
        <p class="g-card__mailfail" role="alert">
          Email non inviata: avvisa il cliente a voce.
        </p>
      )}

      <div class="g-card__actions">
        {o.stato === 'ricevuto' && (
          <>
            <button class="g-btn g-btn--primary" disabled={p.busy} onClick={p.onAccept}>
              Accetta
            </button>
            <button class="g-btn g-btn--danger" disabled={p.busy} onClick={p.onReject}>
              Rifiuta
            </button>
          </>
        )}
        {o.stato === 'accettato' && (
          <button class="g-btn g-btn--primary" disabled={p.busy} onClick={p.onDeliver}>
            {deliverLabel(o)}
          </button>
        )}
        <a class={`g-btn ${o.email_non_inviata && decided ? 'g-btn--call-alert' : 'g-btn--ghost'}`} href={telHref(o.telefono_cliente)}>
          Chiama
        </a>
      </div>
    </article>
  );
}

function RejectModal({ o, onCancel, onConfirm }: { o: Card; onCancel: () => void; onConfirm: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState('');
  return (
    <Modal title={`Rifiuta ${shortNum(o.numero_ordine)} · ${o.nome_cliente}`} onClose={onCancel}>
      <p class="g-modal__hint">Il cliente riceve il motivo per email e lo vede sulla pagina di attesa.</p>
      <fieldset class="g-reasons">
        <legend class="g-label">Motivo</legend>
        {MOTIVI_RIFIUTO.map((m) => (
          <label class="g-radio" key={m}>
            <input type="radio" name="motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} />
            <span>{m}</span>
          </label>
        ))}
      </fieldset>
      <div class="g-modal__actions">
        <button class="g-btn g-btn--ghost" onClick={onCancel}>
          Indietro
        </button>
        <button class="g-btn g-btn--danger" disabled={!motivo} onClick={() => onConfirm(motivo)}>
          Conferma rifiuto
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Storico ---------- */

function Storico({ busy, tick }: { busy: boolean; tick: number }) {
  const [q, setQ] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Card[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    setPage(1);
  }, [q, date]);

  useEffect(() => {
    let alive = true;
    setState('loading');
    const t = setTimeout(async () => {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (date) qs.set('data', date);
      qs.set('page', String(page));
      const res = await api(`/api/gestione/ordini/storico?${qs}`);
      if (!alive) return;
      if (!res.ok) return setState('error');
      setRows(res.data.ordini);
      setPages(res.data.pagination.pagine || 1);
      setTotal(res.data.pagination.totale);
      setState('ok');
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, date, page, tick]);

  return (
    <section class="g-history" aria-label="Storico ordini">
      <div class="g-search">
        <div>
          <label class="g-label" for="g-q">
            Cerca per numero, nome o telefono
          </label>
          <input id="g-q" class="g-input" type="search" inputMode="search" value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} />
        </div>
        <div>
          <label class="g-label" for="g-date">
            Data
          </label>
          <input id="g-date" class="g-input" type="date" value={date} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} />
        </div>
      </div>
      {state === 'error' && (
        <p class="g-error" role="alert">
          Non riusciamo a caricare lo storico.
        </p>
      )}
      {state === 'ok' && <p class="g-history__count">{total === 1 ? '1 ordine' : `${total} ordini`}</p>}
      <div class="g-history__list">
        {rows.map((o) => (
          <OrderCard key={o.id} o={o} busy={busy} />
        ))}
        {state === 'ok' && rows.length === 0 && <p class="g-empty">Nessun ordine trovato.</p>}
      </div>
      {pages > 1 && (
        <nav class="g-pager" aria-label="Pagine">
          <button class="g-btn g-btn--ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Precedente
          </button>
          <span>
            {page} / {pages}
          </span>
          <button class="g-btn g-btn--ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Successiva →
          </button>
        </nav>
      )}
    </section>
  );
}

/* ---------- Pannello ---------- */

export default function Pannello({ userName, logo }: Props) {
  const [started, setStarted] = useState(false);
  const [lists, setLists] = useState<Lists | null>(null);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<Tab>('da');
  const [view, setView] = useState<'oggi' | 'storico'>('oggi');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean; undo?: () => void } | null>(null);
  const [rejecting, setRejecting] = useState<Card | null>(null);
  /** si incrementa a ogni aggiornamento: lo storico si ricarica insieme alle liste */
  const [tick, setTick] = useState(0);

  const audio = useRef<AudioContext | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const toastTimer = useRef<number>(0);
  const [wakeOk, setWakeOk] = useState(true);

  const pending = lists?.da_accettare.length ?? 0;

  const reload = useCallback(async () => {
    const res = await api('/api/gestione/ordini');
    if (res.ok && res.data) {
      setLists({ da_accettare: res.data.da_accettare, in_corso: res.data.in_corso, chiusi_oggi: res.data.chiusi_oggi });
      setOffline(false);
      setTick((n) => n + 1);
    } else {
      setOffline(true); // avviso rosso finché non torna la connessione
    }
  }, []);

  // Aggiornamento ogni 10 secondi (e subito all'avvio)
  useEffect(() => {
    if (!started) return;
    reload();
    const t = setInterval(reload, POLL_MS);
    const onOnline = () => reload();
    const onOffline = () => setOffline(true);
    addEventListener('online', onOnline);
    addEventListener('offline', onOffline);
    return () => {
      clearInterval(t);
      removeEventListener('online', onOnline);
      removeEventListener('offline', onOffline);
    };
  }, [started, reload]);

  // Suono ripetuto finché ci sono ordini da accettare
  useEffect(() => {
    if (!started || pending === 0) return;
    const play = () => audio.current && audio.current.state === 'running' && beep(audio.current);
    play();
    const t = setInterval(play, BEEP_EVERY_MS);
    return () => clearInterval(t);
  }, [started, pending > 0]);

  // Titolo della scheda del browser con il numero di ordini da accettare
  useEffect(() => {
    document.title = pending > 0 ? `(${pending}) Da accettare · Gestione ordini` : 'Gestione ordini · Aldo Prestera Pizzeria';
  }, [pending]);

  // Schermo acceso (Wake Lock): si perde quando la scheda va in background, quindi si richiede di nuovo
  const requestWake = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
      if (!nav.wakeLock) return setWakeOk(false);
      wake.current = await nav.wakeLock.request('screen');
      setWakeOk(true);
    } catch {
      setWakeOk(false);
    }
  }, []);
  useEffect(() => {
    if (!started) return;
    const onVis = () => document.visibilityState === 'visible' && requestWake();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [started, requestWake]);

  const start = async () => {
    // Serve un tocco dell'utente: è così che il browser permette il suono
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audio.current = new AC();
      await audio.current.resume();
      beep(audio.current); // prova: se la senti, il suono funziona
    } catch {
      /* senza audio il pannello funziona comunque */
    }
    requestWake();
    setStarted(true);
  };

  const say = (text: string, opts: { error?: boolean; undo?: () => void } = {}) => {
    clearTimeout(toastTimer.current);
    setToast({ text, ...opts });
    toastTimer.current = window.setTimeout(() => setToast(null), opts.undo ? UNDO_MS : 5000);
  };

  const setStato = async (o: Card, stato: 'accettato' | 'rifiutato' | 'consegnato', motivo?: string) => {
    setBusyId(o.id);
    const res = await api(`/api/gestione/ordini/${o.id}/stato`, { stato, motivo });
    setBusyId(null);
    if (!res.ok) {
      say(res.data?.error ?? 'Operazione non riuscita: controlla la connessione.', { error: true });
    } else if (stato === 'consegnato') {
      // "Annulla" per qualche secondo: riporta l'ordine ad accettato (correzione)
      say(`${shortNum(o.numero_ordine)} ${deliverLabel(o).toLowerCase()}`, {
        undo: async () => {
          const back = await api(`/api/gestione/ordini/${o.id}/stato`, { stato: 'accettato' });
          say(back.ok ? 'Annullato: ordine di nuovo in corso.' : (back.data?.error ?? 'Impossibile annullare.'), { error: !back.ok });
          reload();
        },
      });
    } else if (res.data?.ordine?.email_non_inviata) {
      say('Fatto, ma l’email al cliente non è partita: chiamalo.', { error: true });
    }
    reload();
  };

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: 'da', label: 'Da accettare', n: lists?.da_accettare.length ?? 0 },
    { id: 'corso', label: 'In corso', n: lists?.in_corso.length ?? 0 },
    { id: 'chiusi', label: 'Chiusi oggi', n: lists?.chiusi_oggi.length ?? 0 },
  ];

  const column = (id: Tab, title: string, items: Card[] | undefined, empty: string) => (
    <section class={`g-col${tab === id ? ' is-active' : ''}`} aria-labelledby={`g-col-${id}`}>
      <h2 id={`g-col-${id}`} class="g-col__title">
        {title} <span class="g-col__n">{items?.length ?? 0}</span>
      </h2>
      {items?.map((o) => (
        <OrderCard
          key={o.id}
          o={o}
          busy={busyId === o.id}
          onAccept={() => setStato(o, 'accettato')}
          onReject={() => setRejecting(o)}
          onDeliver={() => setStato(o, 'consegnato')}
        />
      ))}
      {items && items.length === 0 && <p class="g-empty">{empty}</p>}
    </section>
  );

  /* ----- Schermata iniziale ----- */
  if (!started) {
    return (
      <main class="g-start">
        <img src={logo.src} srcset={logo.srcset} alt="Aldo Prestera Pizzeria" height={40} />
        <h1>Ciao {userName}</h1>
        <p>
          Premi il pulsante per iniziare il servizio: il pannello suonerà finché ci sono ordini da accettare e terrà acceso lo schermo.
          Alza il volume del telefono.
        </p>
        <button class="g-btn g-btn--primary g-start__btn" onClick={start}>
          Inizia servizio
        </button>
        <button type="button" class="g-link" onClick={logout}>
          Esci
        </button>
      </main>
    );
  }

  return (
    <div class="g-app">
      {offline && (
        <div class="g-offline" role="alert">
          <strong>Connessione persa.</strong> Gli ordini potrebbero non essere aggiornati: sto riprovando.
        </div>
      )}
      <header class="g-header">
        <img src={logo.src} srcset={logo.srcset} alt="Aldo Prestera Pizzeria" height={40} />
        <div class="g-seg" role="group" aria-label="Vista">
          <button aria-pressed={view === 'oggi'} onClick={() => setView('oggi')}>
            Oggi
          </button>
          <button aria-pressed={view === 'storico'} onClick={() => setView('storico')}>
            Storico
          </button>
        </div>
        <button class="g-link g-header__exit" onClick={logout} title={userName}>
          Esci
        </button>
      </header>
      {!wakeOk && <p class="g-note">Lo schermo potrebbe spegnersi: impostalo su “sempre acceso” o tieni il telefono in carica.</p>}

      {view === 'oggi' ? (
        <>
          <nav class="g-tabs" aria-label="Liste ordini">
            {tabs.map((t) => (
              <button key={t.id} class={tab === t.id ? 'is-active' : ''} aria-current={tab === t.id ? 'true' : undefined} onClick={() => setTab(t.id)}>
                {t.label}
                <span class={`g-badge${t.id === 'da' && t.n > 0 ? ' g-badge--alert' : ''}`}>{t.n}</span>
              </button>
            ))}
          </nav>
          {!lists ? (
            <p class="g-empty">Carico gli ordini…</p>
          ) : (
            <main class="g-cols">
              {column('da', 'Da accettare', lists.da_accettare, 'Nessun ordine in attesa.')}
              {column('corso', 'In corso', lists.in_corso, 'Nessun ordine in corso.')}
              {column('chiusi', 'Chiusi oggi', lists.chiusi_oggi, 'Ancora nessun ordine chiuso oggi.')}
            </main>
          )}
        </>
      ) : (
        <main class="g-cols g-cols--single">
          <Storico busy={false} tick={tick} />
        </main>
      )}

      {toast && (
        <div class={`g-toast${toast.error ? ' g-toast--error' : ''}`} role={toast.error ? 'alert' : 'status'}>
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              class="g-toast__undo"
              onClick={() => {
                const u = toast.undo!;
                setToast(null);
                u();
              }}
            >
              Annulla
            </button>
          )}
        </div>
      )}

      {rejecting && (
        <RejectModal
          o={rejecting}
          onCancel={() => setRejecting(null)}
          onConfirm={(m) => {
            const o = rejecting;
            setRejecting(null);
            setStato(o, 'rifiutato', m);
          }}
        />
      )}
    </div>
  );
}

async function logout() {
  await api('/api/gestione/logout', {});
  location.assign('/gestione/login');
}
