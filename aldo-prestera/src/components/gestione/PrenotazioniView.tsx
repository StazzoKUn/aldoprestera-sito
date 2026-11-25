import { useEffect, useState } from 'preact/hooks';
import { MOTIVI_RIFIUTO_PRENOTAZIONE } from '../../lib/motivi';
import type { SchedaPrenotazione } from '../../lib/gestione';
import { Modal } from './Modal';

// Sezione "Prenotazioni" del pannello di Aldo: le richieste da confermare, le confermate e le chiuse.
// Nessuna gestione dei tavoli: Aldo ha solo un promemoria libero ("T3+T4 uniti") per ogni prenotazione.

export type PrenCard = SchedaPrenotazione & { email_non_inviata: boolean };
export type PrenAction = 'confermata' | 'rifiutata' | 'annullata';
type Col = 'da' | 'corso' | 'chiusi';

const telHref = (p: string) => 'tel:' + p.replace(/[^\d+]/g, '');
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hourCycle: 'h23', ...o }).format(new Date(iso));
const hhmm = (iso: string) => fmt(iso, { hour: '2-digit', minute: '2-digit' });
const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d);

/** "Oggi", "Domani" o "sab 28 nov" */
export function dayName(iso: string): string {
  const day = ymd(new Date(iso));
  const today = ymd(new Date());
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  if (day === today) return 'Oggi';
  if (day === tomorrow) return 'Domani';
  return fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
}

const peopleTxt = (n: number) => (n === 1 ? '1 persona' : `${n} persone`);
const statoLabel = (p: PrenCard) =>
  p.stato === 'richiesta' ? 'Da confermare' : p.stato === 'confermata' ? 'Confermata' : p.stato === 'annullata' ? 'Annullata' : p.scaduta ? 'Scaduta' : 'Rifiutata';

// Gli stili delle schede degli ordini valgono anche qui: richiesta = ricevuto, confermata = accettato, ecc.
const CSS_STATE = { richiesta: 'ricevuto', confermata: 'accettato', rifiutata: 'rifiutato', annullata: 'annullato' } as const;

function ReservationCard(p: {
  o: PrenCard;
  i: number;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onCancel: () => void;
  onTable: (nota: string | null) => void;
}) {
  const { o } = p;
  const closed = o.stato === 'rifiutata' || o.stato === 'annullata';
  const [open, setOpen] = useState(false);
  const folded = closed && !open;
  const [table, setTable] = useState(o.tavolo_note ?? '');
  // Se la nota cambia dal server (altro dispositivo) la mostriamo
  useEffect(() => setTable(o.tavolo_note ?? ''), [o.tavolo_note]);
  const saveTable = () => {
    const v = table.trim();
    if (v !== (o.tavolo_note ?? '')) p.onTable(v || null);
  };
  const css = CSS_STATE[o.stato];

  return (
    <article class={`g-card g-card--${css}`} style={{ '--i': Math.min(p.i, 8) }} aria-label={`Prenotazione di ${o.nome_cliente}`}>
      <header class="g-card__head">
        <span class="g-card__time">{hhmm(o.inizio)}</span>
        <span class="g-tag g-tag--consegna">{dayName(o.inizio)}</span>
        <span class="g-card__num">{peopleTxt(o.persone)}</span>
        <span class={`g-status g-status--${css}${o.scaduta ? ' is-scaduto' : ''}`}>{statoLabel(o)}</span>
      </header>

      {closed && (
        <button type="button" class="g-card__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span class="g-card__toggle-name">{o.nome_cliente}</span>
          <span />
          <span class="g-card__chev" aria-hidden="true" />
          <span class="g-sr">{open ? 'Chiudi dettagli' : 'Mostra dettagli'}</span>
        </button>
      )}
      <div class={`g-card__fold${closed ? ' is-foldable' : ''}${folded ? '' : ' is-open'}`}>
        <div class="g-card__foldin">
          <div class="g-card__who">{!closed && <strong>{o.nome_cliente}</strong>}</div>
          {o.note && <p class="g-card__notes">Note: {o.note}</p>}
          {o.stato === 'rifiutata' && o.motivo_stato && <p class="g-card__reason">Motivo: {o.motivo_stato}</p>}
          {o.email_non_inviata && o.stato !== 'richiesta' && (
            <p class="g-card__mailfail" role="alert">
              Email non inviata: avvisa il cliente a voce.
            </p>
          )}

          {!closed && (
            <div class="g-table">
              <label class="g-label" for={`tav-${o.id}`}>
                Tavolo (promemoria)
              </label>
              <input
                id={`tav-${o.id}`}
                class="g-input"
                type="text"
                maxLength={100}
                placeholder="Es. T3+T4 uniti"
                value={table}
                onInput={(e) => setTable((e.currentTarget as HTMLInputElement).value)}
                onBlur={saveTable}
                onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
              />
            </div>
          )}
          {closed && o.tavolo_note && <p class="g-card__notes">Tavolo: {o.tavolo_note}</p>}

          <div class="g-card__actions">
            {o.stato === 'richiesta' && (
              <>
                <button class="g-btn g-btn--primary" disabled={p.busy} onClick={p.onConfirm}>
                  Conferma
                </button>
                <button class="g-btn g-btn--danger" disabled={p.busy} onClick={p.onReject}>
                  Rifiuta
                </button>
              </>
            )}
            {o.stato === 'confermata' && (
              <>
                <button class="g-btn g-btn--danger" disabled={p.busy} onClick={p.onReject}>
                  Rifiuta
                </button>
                <button class="g-btn g-btn--ghost" disabled={p.busy} onClick={p.onCancel}>
                  Annulla
                </button>
              </>
            )}
            {o.telefono_cliente && (
              <a class={`g-btn ${o.email_non_inviata && o.stato !== 'richiesta' ? 'g-btn--call-alert' : 'g-btn--ghost'}`} href={telHref(o.telefono_cliente)}>
                Chiama
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Rifiuto con motivo (lista fissa): vale sia per una richiesta sia per una prenotazione già confermata */
export function RejectReservationModal(p: { o: PrenCard; onCancel: () => void; onConfirm: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState('');
  return (
    <Modal title={`Rifiuta · ${p.o.nome_cliente}`} onClose={p.onCancel}>
      <p class="g-modal__hint">
        {p.o.stato === 'confermata'
          ? 'La prenotazione era già confermata: il cliente riceve un’email con il motivo.'
          : 'Il cliente riceve il motivo per email e lo vede sulla pagina di attesa.'}
      </p>
      <fieldset class="g-reasons">
        <legend class="g-label">Motivo</legend>
        {MOTIVI_RIFIUTO_PRENOTAZIONE.map((m) => (
          <label class="g-radio" key={m}>
            <input type="radio" name="motivo-pren" value={m} checked={motivo === m} onChange={() => setMotivo(m)} />
            <span>{m}</span>
          </label>
        ))}
      </fieldset>
      <div class="g-modal__actions">
        <button class="g-btn g-btn--ghost" onClick={p.onCancel}>
          Indietro
        </button>
        <button class="g-btn g-btn--danger" disabled={!motivo} onClick={() => p.onConfirm(motivo)}>
          Conferma rifiuto
        </button>
      </div>
    </Modal>
  );
}

/** Annullo di una prenotazione confermata: chiede conferma perché il cliente riceve un'email */
export function CancelReservationModal(p: { o: PrenCard; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal title={`Annulla · ${p.o.nome_cliente}`} onClose={p.onCancel}>
      <p class="g-modal__hint">
        Annullare la prenotazione di {dayName(p.o.inizio).toLowerCase()} alle {hhmm(p.o.inizio)} per {peopleTxt(p.o.persone)}? Il cliente riceve un’email.
      </p>
      <div class="g-modal__actions">
        <button class="g-btn g-btn--ghost" onClick={p.onCancel}>
          Indietro
        </button>
        <button class="g-btn g-btn--danger" onClick={p.onConfirm}>
          Annulla prenotazione
        </button>
      </div>
    </Modal>
  );
}

export interface Lists {
  da_confermare: PrenCard[];
  confermate: PrenCard[];
  chiuse: PrenCard[];
}

/** Le tre colonne (su telefono una per volta, scelta dalle schede in alto, come per gli ordini) */
export function PrenotazioniColumns(p: {
  lists: Lists;
  tab: Col;
  busyId: string | null;
  onAction: (o: PrenCard, action: PrenAction) => void;
  onAskReject: (o: PrenCard) => void;
  onAskCancel: (o: PrenCard) => void;
  onTable: (o: PrenCard, nota: string | null) => void;
}) {
  const col = (id: Col, title: string, items: PrenCard[], empty: string) => (
    <section class={`g-col g-col--${id}${p.tab === id ? ' is-active' : ''}`} aria-labelledby={`g-pcol-${id}`}>
      <h2 id={`g-pcol-${id}`} class="g-col__title">
        {title} <span class="g-col__n">{items.length}</span>
      </h2>
      {items.map((o, i) => (
        <ReservationCard
          key={o.id}
          o={o}
          i={i}
          busy={p.busyId === o.id}
          onConfirm={() => p.onAction(o, 'confermata')}
          onReject={() => p.onAskReject(o)}
          onCancel={() => p.onAskCancel(o)}
          onTable={(nota) => p.onTable(o, nota)}
        />
      ))}
      {items.length === 0 && <p class="g-empty">{empty}</p>}
    </section>
  );
  return (
    <main class="g-cols">
      {col('da', 'Da confermare', p.lists.da_confermare, 'Nessuna richiesta in attesa.')}
      {col('corso', 'Confermate', p.lists.confermate, 'Nessuna prenotazione confermata.')}
      {col('chiusi', 'Chiuse', p.lists.chiuse, 'Nessuna prenotazione chiusa.')}
    </main>
  );
}
