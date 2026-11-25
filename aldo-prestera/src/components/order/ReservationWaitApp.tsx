import { useEffect, useState } from 'preact/hooks';
import { whenLabel } from '../../lib/prenotazione';

// Pagina di attesa della prenotazione: stesso stile di quella dell'ordine, con lo stato vivo.
// Chiede lo stato a /api/prenotazione/stato/<codice>; vede solo stato, motivo del rifiuto e riepilogo.
// Il cliente non annulla da qui: per annullare o modificare chiama il ristorante.

interface PublicReservation {
  stato: 'richiesta' | 'confermata' | 'rifiutata' | 'annullata';
  motivo_stato: string | null;
  persone: number;
  inizio: string;
  note: string | null;
}

interface Props {
  code: string;
  logo: string;
  phone: string;
  phoneHref: string;
}

const POLL_MS = 15_000;

export default function ReservationWaitApp({ code, logo, phone, phoneHref }: Props) {
  const [res, setRes] = useState<PublicReservation | null>(null);
  const [missing, setMissing] = useState(!code);
  const [offline, setOffline] = useState(false);

  const stato = res?.stato;
  // confermata resta controllata: Aldo può ancora annullarla o rifiutarla
  const active = !stato || stato === 'richiesta' || stato === 'confermata';

  useEffect(() => {
    if (!code || missing) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/prenotazione/stato/${encodeURIComponent(code)}`, { cache: 'no-store' });
        if (r.status === 404) {
          if (alive) setMissing(true);
          return;
        }
        const data = await r.json();
        if (!alive) return;
        if (!r.ok || !data?.ok) throw new Error();
        setRes(data.prenotazione);
        setOffline(false);
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
          <h1>Prenotazione non trovata</h1>
          <p>Il link non è valido o la prenotazione non esiste più. Se hai appena prenotato, chiamaci.</p>
        </div>
        <div class="o-confirm__actions">
          {callBtn}
          <a href="/prenota" class="o-btn-outline">
            Nuova prenotazione
          </a>
        </div>
      </div>
    );
  }

  if (!res) {
    return (
      <div class="o-confirm">
        <div class="o-confirm__body">
          {logoEl}
          <div class="o-wait__ring" aria-hidden="true" />
          <p role="status">{offline ? 'Non riusciamo a collegarci, riproviamo…' : 'Controllo lo stato della tua prenotazione…'}</p>
        </div>
        <div class="o-confirm__actions">{callBtn}</div>
      </div>
    );
  }

  const when = whenLabel(res.inizio);
  const view = {
    richiesta: {
      icon: null,
      title: 'In attesa di conferma dalla pizzeria',
      text: 'Appena la pizzeria risponde questa pagina si aggiorna da sola e ti scriviamo anche per email.',
    },
    confermata: { icon: '✓', title: 'Prenotazione confermata', text: 'Ti aspettiamo! Se non puoi più venire, avvisaci per telefono.' },
    rifiutata: { icon: '✕', title: 'Prenotazione non accettata', text: res.motivo_stato ?? 'La pizzeria non ha potuto accettare la prenotazione.' },
    annullata: { icon: '✕', title: 'Prenotazione annullata', text: 'Questa prenotazione è stata annullata dalla pizzeria. Per informazioni chiamaci.' },
  }[res.stato];

  return (
    <div class="o-confirm">
      <div class="o-confirm__body">
        {logoEl}
        {view.icon ? (
          <div class="o-confirm__check" aria-hidden="true" key={res.stato}>
            {view.icon}
          </div>
        ) : (
          <div class="o-wait__ring" aria-hidden="true" />
        )}
        <div class="o-wait__status" aria-live="polite" key={res.stato}>
          <h1 class={res.stato === 'richiesta' ? 'o-wait__title' : undefined}>{view.title}</h1>
          <p>{view.text}</p>
          {offline && <p class="o-wait__offline">Connessione assente: riproviamo ad aggiornare.</p>}
        </div>
        <div class="o-confirm__recap">
          <div class="o-confirm__meta">
            <span>{res.persone === 1 ? '1 persona' : `${res.persone} persone`}</span>
            <span>{when}</span>
          </div>
          {res.note && <p class="r-recap-note">Note: {res.note}</p>}
        </div>
        <p class="r-call-note">
          Per annullare o modificare la prenotazione chiama il ristorante al <a href={phoneHref}>{phone}</a>.
        </p>
      </div>
      <div class="o-confirm__actions">
        {callBtn}
        {(res.stato === 'rifiutata' || res.stato === 'annullata') && (
          <a href="/prenota" class="o-btn-outline">
            Prenota di nuovo
          </a>
        )}
      </div>
    </div>
  );
}
