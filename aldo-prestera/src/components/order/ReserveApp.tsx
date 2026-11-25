import { useEffect, useState } from 'preact/hooks';
import {
  MAX_PEOPLE,
  validateReservation,
  type ReservationFieldErrors,
  type ReservationRequest,
  type ReservationResponse,
} from '../../lib/prenotazione';
import type { ReservationDay } from '../../lib/prenotazioni-slots';

// Modulo di prenotazione tavolo: giorno e orario di arrivo, persone, contatti.
// Gli orari li decide il server (/api/prenotazione-slot); nessun limite di coperti: è la pizzeria a confermare.

interface Props {
  logo: { src: string; srcset: string };
  phone: string;
  phoneHref: string;
}

const hhmm = (t: string) => Number(t.slice(0, 2));

/** Arrivi divisi in Pranzo (prima delle 17) e Sera; senza gruppi se ce n'è uno solo */
const groups = (slots: string[]): { label: string; times: string[] }[] => {
  const lunch = slots.filter((t) => hhmm(t) < 17);
  const evening = slots.filter((t) => hhmm(t) >= 17);
  if (!lunch.length || !evening.length) return [{ label: '', times: slots }];
  return [
    { label: 'Pranzo', times: lunch },
    { label: 'Sera', times: evening },
  ];
};

/** "Oggi", "Domani" o "sabato 28 novembre" (la data AAAA-MM-GG è già nel fuso della pizzeria) */
const dayName = (date: string) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  if (date === today) return 'Oggi';
  if (date === tomorrow) return 'Domani';
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00Z`));
};

export default function ReserveApp({ logo, phone, phoneHref }: Props) {
  /** null = in caricamento */
  const [days, setDays] = useState<ReservationDay[] | null>(null);
  const [daysFailed, setDaysFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [people, setPeople] = useState('2');
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', notes: '' });
  const [privacy, setPrivacy] = useState(false);
  const [errors, setErrors] = useState<ReservationFieldErrors>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Giorni e orari prenotabili chiesti al server, aggiornati ogni minuto
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/prenotazione-slot', { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const data: { days: ReservationDay[] } = await res.json();
        if (!alive) return;
        setDays(data.days);
        setDaysFailed(false);
      } catch {
        if (alive) setDaysFailed(true);
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [reload]);

  // Il giorno scelto deve esistere ancora; l'orario deve essere ancora disponibile in quel giorno
  useEffect(() => {
    if (!days) return;
    const day = days.find((d) => d.date === date) ?? days[0];
    if (day && day.date !== date) setDate(day.date);
    if (day && !day.slots.includes(slot)) setSlot('');
  }, [days]);

  const day = days?.find((d) => d.date === date);

  const field = (k: keyof typeof customer) => ({
    value: customer[k],
    onInput: (e: Event) => {
      const v = (e.currentTarget as HTMLInputElement).value;
      setCustomer((c) => ({ ...c, [k]: v }));
      if (errors[k as keyof ReservationFieldErrors]) setErrors((er) => ({ ...er, [k]: undefined }));
    },
  });

  const submit = async (e?: Event) => {
    e?.preventDefault();
    if (sending) return;
    const body: ReservationRequest = { date, slot, people: Number(people), customer, privacy };
    const errs = validateReservation(body);
    setErrors(errs);
    setSendError('');
    if (Object.keys(errs).length) {
      setTimeout(() => {
        const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (first) first.focus();
        else if (errs.slot) document.getElementById('r-slots')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
      return;
    }
    setSending(true);
    let sent = false;
    try {
      const res = await fetch('/api/prenotazione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        if (data?.fields) setErrors(data.fields);
        if (data?.fields?.slot) setReload((n) => n + 1);
        throw new Error(data?.error || 'Errore di invio');
      }
      const { code } = data as ReservationResponse;
      sent = true; // il pulsante resta bloccato finché il browser cambia pagina: niente doppio invio
      location.assign(`/prenotazione/${encodeURIComponent(code)}`);
    } catch (err) {
      setSendError(
        err instanceof Error && err.message !== 'Errore di invio' && err.message !== 'Failed to fetch'
          ? err.message
          : `Non siamo riusciti a inviare la richiesta. Riprova o chiamaci al ${phone}.`,
      );
    } finally {
      if (!sent) setSending(false);
    }
  };

  return (
    <div class="o-page">
      <header class="o-header">
        <a href="/" class="o-logo" aria-label="Torna al sito">
          <img src={logo.src} srcset={logo.srcset} alt="Aldo Prestera Pizzeria" />
        </a>
      </header>

      <div class="r-wrap">
        <form class="o-form" onSubmit={submit} noValidate>
          <h1>Prenota un tavolo</h1>
          <p class="r-notice">
            Questa è una richiesta: il tavolo è tuo quando la pizzeria la conferma, e ti scriviamo per email. Per annullare o modificare la
            prenotazione chiama il ristorante al <a href={phoneHref}>{phone}</a>.
          </p>

          <section class="o-sec" aria-labelledby="r-quando">
            <h2 class="o-sec__title" id="r-quando">
              <span>1</span> Quando e quanti siete
            </h2>
            <div class="o-field" id="r-slots">
              {daysFailed && !days ? (
                <p class="o-closed">
                  Non riusciamo a caricare gli orari.{' '}
                  <button type="button" class="o-link" onClick={() => setReload((n) => n + 1)}>
                    Riprova
                  </button>{' '}
                  o chiamaci al <a href={phoneHref}>{phone}</a>.
                </p>
              ) : days === null ? (
                <p class="o-closed">Carico gli orari disponibili…</p>
              ) : days.length === 0 ? (
                <p class="o-closed">
                  Al momento non ci sono orari prenotabili online. Chiamaci al <a href={phoneHref}>{phone}</a>.
                </p>
              ) : (
                <>
                  <label class="o-label" for="r-date">
                    Giorno
                  </label>
                  <select
                    id="r-date"
                    value={date}
                    aria-invalid={!!errors.date}
                    onChange={(e) => {
                      setDate((e.currentTarget as HTMLSelectElement).value);
                      setSlot('');
                      setErrors((er) => ({ ...er, date: undefined, slot: undefined }));
                    }}
                  >
                    {days.map((d) => (
                      <option value={d.date} key={d.date}>
                        {dayName(d.date)}
                      </option>
                    ))}
                  </select>
                  {errors.date && <span class="o-error">{errors.date}</span>}

                  <span class="o-label r-label-gap" id="r-slot-label">
                    Orario di arrivo
                  </span>
                  <div role="group" aria-labelledby="r-slot-label">
                    {day &&
                      groups(day.slots).map((g) => (
                        <section key={g.label || 'tutti'}>
                          {g.label && <h3 class="o-modal__group">{g.label}</h3>}
                          <div class="o-times">
                            {g.times.map((t) => (
                              <button
                                type="button"
                                key={t}
                                class={`o-time${slot === t ? ' is-on' : ''}`}
                                aria-pressed={slot === t}
                                onClick={() => {
                                  setSlot(t);
                                  setErrors((er) => ({ ...er, slot: undefined }));
                                }}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </section>
                      ))}
                  </div>
                  {errors.slot && <span class="o-error">{errors.slot}</span>}
                </>
              )}
            </div>
            <div class="o-field">
              <label class="o-label" for="r-people">
                Quante persone
              </label>
              <input
                id="r-people"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_PEOPLE}
                required
                value={people}
                aria-invalid={!!errors.people}
                onInput={(e) => {
                  setPeople((e.currentTarget as HTMLInputElement).value);
                  if (errors.people) setErrors((er) => ({ ...er, people: undefined }));
                }}
              />
              {errors.people ? (
                <span class="o-error">{errors.people}</span>
              ) : (
                <span class="o-hint">
                  Per gruppi numerosi puoi anche telefonarci: <a href={phoneHref}>{phone}</a>
                </span>
              )}
            </div>
          </section>

          <section class="o-sec" aria-labelledby="r-contatti">
            <h2 class="o-sec__title" id="r-contatti">
              <span>2</span> I tuoi contatti
            </h2>
            <div class="o-grid2">
              <Field label="Nome e cognome" error={errors.name} id="r-name">
                <input id="r-name" type="text" autocomplete="name" required {...field('name')} aria-invalid={!!errors.name} />
              </Field>
              <Field label="Telefono" error={errors.phone} id="r-phone">
                <input id="r-phone" type="tel" inputMode="tel" autocomplete="tel" required {...field('phone')} aria-invalid={!!errors.phone} />
              </Field>
            </div>
            <Field label="Email" error={errors.email} id="r-email" hint="Ti scriviamo qui quando la pizzeria risponde">
              <input id="r-email" type="email" inputMode="email" autocomplete="email" required {...field('email')} aria-invalid={!!errors.email} />
            </Field>
            <Field label="Note per la pizzeria" id="r-notes">
              <textarea id="r-notes" rows={2} placeholder="Es. un seggiolone, un tavolo vicino all'ingresso" {...field('notes')} />
            </Field>
          </section>

          <div class="o-field o-privacy">
            <label class="o-check">
              <input
                type="checkbox"
                id="r-privacy"
                checked={privacy}
                aria-invalid={!!errors.privacy}
                onChange={(e) => {
                  setPrivacy((e.currentTarget as HTMLInputElement).checked);
                  setErrors((er) => ({ ...er, privacy: undefined }));
                }}
              />
              <span>
                Ho letto l'
                <a href="/privacy" target="_blank" rel="noopener">
                  informativa privacy
                </a>
              </span>
            </label>
            {errors.privacy && <span class="o-error">{errors.privacy}</span>}
          </div>

          {sendError && (
            <p class="o-error" role="alert">
              {sendError}
            </p>
          )}
          <button type="submit" class="o-cta" disabled={sending || !days?.length}>
            {sending ? 'Invio in corso…' : 'Invia richiesta'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field(p: { label: string; id: string; error?: string; hint?: string; children: preact.ComponentChildren }) {
  return (
    <div class="o-field">
      <label class="o-label" for={p.id}>
        {p.label}
      </label>
      {p.children}
      {p.hint && !p.error && <span class="o-hint">{p.hint}</span>}
      {p.error && <span class="o-error">{p.error}</span>}
    </div>
  );
}
