import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { MenuCategory } from '../../data/menu';
import { eur, countTxt } from '../../lib/format';
import { delivery } from '../../data/site';
import {
  computeTotals,
  minOrderTxt,
  validateOrder,
  type Cart,
  type Customer,
  type FieldErrors,
  type Mode,
  type OrderResponse,
  type Pay,
} from '../../lib/order';

export interface ItemImage {
  src: string;
  srcset: string;
  thumb: string;
}

interface Props {
  menu: MenuCategory[];
  images: Record<string, ItemImage>;
  logo: { src: string; srcset: string; large: string };
  phone: string;
  phoneHref: string;
}

type Step = 'menu' | 'dati';

/** Ordine in attesa ritrovato dal codice salvato nel browser */
interface Pending {
  code: string;
  number: string;
}

const LS_CART = 'aldo:cart';
const LS_MODE = 'aldo:mode';
const LS_WAIT = 'aldo:attesa'; // codice pubblico dell'ordine in attesa (vedi pagina /ordine/<codice>)

const emptyCustomer: Customer = {
  name: '',
  phone: '',
  email: '',
  zone: delivery.zones[0]?.id ?? '',
  street: '',
  number: '',
  cap: '',
  province: '',
  intercom: '',
  notes: '',
};

const read = <T,>(store: Storage, key: string): T | null => {
  try {
    const v = store.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const write = (store: Storage, key: string, v: unknown) => {
  try {
    if (v === null) store.removeItem(key);
    else store.setItem(key, JSON.stringify(v));
  } catch {
    /* storage non disponibile */
  }
};

export default function OrderApp({ menu, images, logo, phone, phoneHref }: Props) {
  const items = useMemo(() => menu.flatMap((c) => c.items), [menu]);
  const [cart, setCart] = useState<Cart>({});
  const [mode, setMode] = useState<Mode>('consegna');
  const [step, setStepState] = useState<Step>('menu');
  const [slot, setSlot] = useState('');
  const pay: Pay = 'Contanti'; // solo contanti: nessuna scelta
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [privacy, setPrivacy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [hydrated, setHydrated] = useState(false);
  /** null = in caricamento */
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsFailed, setSlotsFailed] = useState(false);
  const [slotsReload, setSlotsReload] = useState(0);

  // Ripristino carrello / modalità / conferma
  useEffect(() => {
    const savedCart = read<Cart>(localStorage, LS_CART);
    if (savedCart) {
      const valid = Object.fromEntries(
        Object.entries(savedCart).filter(([id, q]) => items.some((i) => i.id === id) && Number.isInteger(q) && q > 0),
      );
      setCart(valid);
    }
    const savedMode = read<Mode>(localStorage, LS_MODE);
    if (savedMode === 'consegna' || savedMode === 'asporto') setMode(savedMode);
    const params = new URLSearchParams(location.search);
    if (params.get('passo') === 'dati' && savedCart && Object.keys(savedCart).length) {
      setStepState('dati');
    }
    setHydrated(true);

    // Il cliente ritrova l'ordine in attesa riaprendo il sito
    const code = read<string>(localStorage, LS_WAIT);
    if (code) {
      fetch(`/api/ordine/stato/${encodeURIComponent(code)}`)
        .then(async (res) => {
          if (res.status === 404) return write(localStorage, LS_WAIT, null);
          const data = await res.json();
          if (data?.ok && (data.ordine.stato === 'ricevuto' || data.ordine.stato === 'accettato')) {
            setPending({ code, number: data.ordine.numero_ordine });
          } else if (data?.ok) {
            write(localStorage, LS_WAIT, null); // ordine concluso
          }
        })
        .catch(() => {
          /* niente rete: il banner non compare */
        });
    }
  }, []);

  useEffect(() => {
    if (hydrated) write(localStorage, LS_CART, cart);
  }, [cart, hydrated]);
  useEffect(() => {
    if (hydrated) write(localStorage, LS_MODE, mode);
  }, [mode, hydrated]);

  // Navigazione tra i passi con la cronologia del browser
  const setStep = (s: Step, replace = false) => {
    const url = s === 'menu' ? location.pathname : `${location.pathname}?passo=${s}`;
    history[replace ? 'replaceState' : 'pushState']({ step: s }, '', url);
    setStepState(s);
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(location.search).get('passo');
      setStepState(p === 'dati' ? 'dati' : 'menu');
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const totals = computeTotals(cart, mode, menu, customer.zone);
  const isC = mode === 'consegna';
  const feeLabel = isC ? 'Consegna' : 'Ritiro';
  const feeTxt = isC ? eur(totals.fee) : 'gratis';

  // Slot prenotabili chiesti al server (orari di apertura e anticipo), aggiornati ogni minuto
  useEffect(() => {
    if (step !== 'dati') return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/slot?mode=${mode}`);
        if (!res.ok) throw new Error();
        const data: { slots: string[] } = await res.json();
        if (!alive) return;
        setSlots(data.slots);
        setSlotsFailed(false);
      } catch {
        if (alive) setSlotsFailed(true);
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [step, mode, slotsReload]);
  useEffect(() => {
    if (slots && !slots.includes(slot)) setSlot(slots[0] ?? '');
  }, [slots]);

  const setQty = (id: string, d: number) =>
    setCart((c) => {
      const q = Math.max(0, (c[id] ?? 0) + d);
      const next = { ...c, [id]: q };
      if (q === 0) delete next[id];
      return next;
    });

  const canContinue = totals.count > 0 && !totals.belowMin;
  const goToData = () => {
    if (canContinue) setStep('dati');
  };

  const field = (k: keyof Customer) => ({
    value: customer[k],
    onInput: (e: Event) => {
      const v = (e.currentTarget as HTMLInputElement).value;
      setCustomer((c) => ({ ...c, [k]: v }));
      if (errors[k as keyof FieldErrors]) setErrors((er) => ({ ...er, [k]: undefined }));
    },
  });

  const submit = async (e?: Event) => {
    e?.preventDefault();
    if (sending) return;
    const errs = validateOrder({ customer, mode, slot, privacy }, totals);
    setErrors(errs);
    setSendError('');
    if (Object.keys(errs).length) {
      // dopo il render, porta il focus sul primo campo con errore
      setTimeout(() => {
        const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (first) first.focus();
        else if (errs.slot) document.getElementById('o-slots')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
      return;
    }
    setSending(true);
    let sent = false;
    try {
      const res = await fetch('/api/ordine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart, mode, slot, pay, customer, privacy }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        if (data?.fields) setErrors(data.fields);
        if (data?.fields?.slot) setSlotsReload((n) => n + 1);
        throw new Error(data?.error || 'Errore di invio');
      }
      const { code } = data as OrderResponse;
      write(localStorage, LS_WAIT, code);
      setCart({});
      write(localStorage, LS_CART, {});
      // Pagina di attesa: l'ordine è già salvato, la pizzeria deve solo rispondere
      sent = true; // il pulsante resta bloccato finché il browser cambia pagina: niente doppio invio
      location.assign(`/ordine/${encodeURIComponent(code)}`);
    } catch (err) {
      setSendError(
        err instanceof Error && err.message !== 'Errore di invio' && err.message !== 'Failed to fetch'
          ? err.message
          : `Non siamo riusciti a inviare l'ordine. Riprova o chiamaci al ${phone}.`,
      );
    } finally {
      if (!sent) setSending(false);
    }
  };

  const pendingBanner = pending && (
    <a class="o-pending" href={`/ordine/${encodeURIComponent(pending.code)}`}>
      <span>Hai un ordine in corso (n. {pending.number})</span>
      <span class="o-pending__go">Guarda lo stato →</span>
    </a>
  );

  const header = (
    <header class="o-header">
      {step === 'dati' ? (
        <>
          <button type="button" class="o-back o-mob" onClick={() => setStep('menu')}>
            ← Menù
          </button>
          <a href="/" class="o-logo o-desk" aria-label="Torna al sito">
            <img src={logo.src} srcset={logo.srcset} alt="Aldo Prestera Pizzeria" />
          </a>
        </>
      ) : (
        <a href="/" class="o-logo" aria-label="Torna al sito">
          <img src={logo.src} srcset={logo.srcset} alt="Aldo Prestera Pizzeria" />
        </a>
      )}
      <ol class="o-steps o-desk" aria-label="Passaggi dell'ordine">
        <li aria-current={step === 'menu' ? 'step' : undefined}>
          {step === 'dati' ? (
            <button type="button" onClick={() => setStep('menu')}>
              1 Menù
            </button>
          ) : (
            '1 Menù'
          )}
        </li>
        <li aria-hidden="true" class="o-steps__sep">
          —
        </li>
        <li aria-current={step === 'dati' ? 'step' : undefined}>2 Dati</li>
        <li aria-hidden="true" class="o-steps__sep">
          —
        </li>
        <li>3 Conferma</li>
      </ol>
      <span class="o-stepnum o-mob">Passo {step === 'menu' ? 1 : 2} di 2</span>
    </header>
  );

  /* ---------- Carrello (desktop) ---------- */
  const cartPanel = (
    <aside class="o-cart o-desk" aria-label="Il tuo ordine">
      <div class="o-cart__head">
        <h2>Il tuo ordine</h2>
        <span aria-live="polite">{countTxt(totals.count)}</span>
      </div>
      {step === 'dati' && (
        <button type="button" class="o-cart__edit" onClick={() => setStep('menu')}>
          ← Modifica ordine
        </button>
      )}
      <div class="o-cart__lines">
        {totals.lines.map((l) => {
          const img = images[l.id];
          return (
            <div class="o-cart__line" key={l.id}>
              {img ? (
                <img src={img.thumb} alt="" class="o-thumb" width={48} height={48} />
              ) : (
                <span class="o-thumb o-thumb--initial" aria-hidden="true">
                  {l.name[0]}
                </span>
              )}
              <div class="o-cart__name">
                <span>{l.name}</span>
                <span>Quantità {l.qty}</span>
              </div>
              <span>{eur(l.total)}</span>
            </div>
          );
        })}
        {totals.count === 0 && <span class="o-cart__empty">Il carrello è vuoto.</span>}
      </div>
      <div class="o-cart__sums">
        <div>
          <span>Subtotale</span>
          <span>{eur(totals.subtotal)}</span>
        </div>
        <div>
          <span>{feeLabel}</span>
          <span>{feeTxt}</span>
        </div>
        <div class="o-cart__total">
          <span>Totale</span>
          <span>{eur(totals.total)}</span>
        </div>
        {totals.belowMin && <p class="o-cart__min">{minOrderTxt()}</p>}
      </div>
      <div class="o-cart__foot">
        {step === 'menu' ? (
          <button key="continua" type="button" class="o-cta" onClick={goToData} disabled={!canContinue}>
            Continua
          </button>
        ) : (
          <button key="invia" type="submit" form="o-form" class="o-cta" disabled={sending}>
            {sending ? 'Invio in corso…' : 'Invia ordine'}
          </button>
        )}
        {step === 'dati' && sendError && (
          <p class="o-send-error" role="alert">
            {sendError}
          </p>
        )}
        <span class="o-cart__note">Paghi in contanti alla consegna</span>
      </div>
    </aside>
  );

  /* ---------- Passo 2 · Dati e orario ---------- */
  if (step === 'dati') {
    return (
      <div class="o-page">
        {header}
        {pendingBanner}
        <div class="o-layout">
          <form id="o-form" class="o-form" onSubmit={submit} noValidate>
            <h1>I tuoi dati</h1>
            <div class="o-recap">
              <div class="o-recap__txt">
                <span class="o-recap__label">{isC ? 'Consegna a domicilio' : 'Ritiro in pizzeria'}</span>
                <span>
                  {countTxt(totals.count)} · {eur(totals.total)}
                </span>
              </div>
              <button type="button" class="o-recap__edit" onClick={() => setStep('menu')}>
                ← Modifica ordine
              </button>
            </div>

            <section class="o-sec" aria-labelledby="s-contatti">
              <h2 class="o-sec__title" id="s-contatti">
                <span>1</span> I tuoi contatti
              </h2>
              <div class="o-grid2">
                <Field label="Nome e cognome" error={errors.name} id="f-name">
                  <input id="f-name" type="text" autocomplete="name" required {...field('name')} aria-invalid={!!errors.name} />
                </Field>
                <Field label="Telefono" error={errors.phone} id="f-phone">
                  <input id="f-phone" type="tel" inputMode="tel" autocomplete="tel" required {...field('phone')} aria-invalid={!!errors.phone} />
                </Field>
              </div>
              <Field label="Email" error={errors.email} id="f-email" hint="Ti scriviamo qui quando la pizzeria risponde">
                <input id="f-email" type="email" inputMode="email" autocomplete="email" required {...field('email')} aria-invalid={!!errors.email} />
              </Field>
            </section>

            {isC && (
              <section class="o-sec" aria-labelledby="s-indirizzo">
                <h2 class="o-sec__title" id="s-indirizzo">
                  <span>2</span> Dove consegniamo
                </h2>
                {delivery.zones.length > 1 && (
                  <Field label="Comune" error={errors.zone} id="f-zone">
                    <select id="f-zone" required {...field('zone')} aria-invalid={!!errors.zone}>
                      {delivery.zones.map((z) => (
                        <option value={z.id} key={z.id}>
                          {z.name} · consegna {eur(z.fee)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <div class="o-row-addr">
                  <Field label="Indirizzo" error={errors.street} id="f-street">
                    <input id="f-street" type="text" autocomplete="address-line1" required {...field('street')} aria-invalid={!!errors.street} />
                  </Field>
                  <Field label="N°" error={errors.number} id="f-number">
                    <input id="f-number" type="text" required {...field('number')} aria-invalid={!!errors.number} />
                  </Field>
                </div>
                <div class="o-row-cap">
                  <Field label="CAP" error={errors.cap} id="f-cap">
                    <input id="f-cap" type="text" inputMode="numeric" autocomplete="postal-code" maxLength={5} required {...field('cap')} aria-invalid={!!errors.cap} />
                  </Field>
                  <Field label="Provincia" error={errors.province} id="f-province">
                    <input id="f-province" type="text" autocomplete="address-level1" maxLength={2} placeholder="CE" required {...field('province')} aria-invalid={!!errors.province} />
                  </Field>
                </div>
                <Field label="Citofono / piano" id="f-intercom">
                  <input id="f-intercom" type="text" placeholder="Es. Rossi, 2° piano" {...field('intercom')} />
                </Field>
              </section>
            )}
            <section class="o-sec" aria-labelledby="s-orario">
            <h2 class="o-sec__title" id="s-orario">
              <span>{isC ? 3 : 2}</span> Quando lo vuoi
            </h2>
            <fieldset class="o-field" id="o-slots">
              <legend class="o-label">{isC ? 'Orario di consegna' : 'Orario di ritiro'}</legend>
              {slotsFailed && !slots ? (
                <p class="o-closed">
                  Non riusciamo a caricare gli orari.{' '}
                  <button type="button" class="o-link" onClick={() => setSlotsReload((n) => n + 1)}>
                    Riprova
                  </button>{' '}
                  o chiamaci al <a href={phoneHref}>{phone}</a>.
                </p>
              ) : slots === null ? (
                <p class="o-closed">Carico gli orari disponibili…</p>
              ) : slots.length > 0 ? (
                <div class="o-chips o-chips--4">
                  {slots.map((t) => (
                    <label class="o-chip" key={t}>
                      <input type="radio" name="slot" value={t} checked={slot === t} onChange={() => { setSlot(t); setErrors((er) => ({ ...er, slot: undefined })); }} />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p class="o-closed">
                  Per oggi non ci sono più orari disponibili per gli ordini online. Chiamaci al{' '}
                  <a href={phoneHref}>{phone}</a>.
                </p>
              )}
              {errors.slot && !!slots?.length && <span class="o-error">{errors.slot}</span>}
            </fieldset>
            <Field label="Note per la pizzeria" id="f-notes">
              <textarea id="f-notes" rows={2} placeholder="Es. una margherita senza basilico" {...field('notes')} />
            </Field>
            </section>
            <div class="o-field o-privacy">
              <label class="o-check">
                <input
                  type="checkbox"
                  id="f-privacy"
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
            {errors.cart && <p class="o-error">{errors.cart}</p>}
          </form>
          {cartPanel}
        </div>

        <div class="o-bar-data o-mob">
          {sendError && (
            <p class="o-send-error" role="alert">
              {sendError}
            </p>
          )}
          <div class="o-bar-data__sum">
            <span>
              {countTxt(totals.count)} · {feeLabel} {feeTxt}
            </span>
            <span>{eur(totals.total)}</span>
          </div>
          <button type="submit" form="o-form" class="o-cta" disabled={sending || !slots?.length}>
            {sending ? 'Invio in corso…' : 'Invia ordine'}
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Passo 1 · Menù ---------- */
  const thumbs = totals.lines.filter((l) => images[l.id]).slice(0, 3);
  return (
    <div class="o-page">
      {header}
      {pendingBanner}
      <div class="o-layout">
        <div class="o-menu">
          <div class="o-menu__top">
            <h1>Menù</h1>
            <div class="o-seg" role="radiogroup" aria-label="Consegna o ritiro">
              <ModeToggle mode={mode} setMode={setMode} />
            </div>
          </div>
          <MenuSearch menu={menu} />
          <CategoryPills menu={menu} />
          {menu.map((cat) =>
            cat.layout === 'cards' ? (
              <section class="o-cat" id={`cat-${cat.id}`} aria-label={cat.name} key={cat.id}>
                <div class="o-cards">
                  {cat.items.map((it) => {
                    const img = images[it.id];
                    const q = cart[it.id] ?? 0;
                    return (
                      <article class="o-card" id={`item-${it.id}`} key={it.id}>
                        <div class="o-card__media">
                          {img && (
                            <img
                              src={img.src}
                              srcset={img.srcset}
                              sizes="(max-width: 959px) 100vw, 40vw"
                              alt={`Pizza ${it.name}`}
                              loading="lazy"
                              width={800}
                              height={640}
                            />
                          )}
                          <span class="o-card__price">{eur(it.price)}</span>
                          <div class="o-card__action">
                            {q === 0 ? (
                              <button type="button" class="o-add" onClick={() => setQty(it.id, 1)} aria-label={`Aggiungi ${it.name}`}>
                                <span class="o-add__plus" aria-hidden="true">+</span>
                                <span class="o-desk">Aggiungi</span>
                              </button>
                            ) : (
                              <Stepper name={it.name} qty={q} onSub={() => setQty(it.id, -1)} onAdd={() => setQty(it.id, 1)} big />
                            )}
                          </div>
                        </div>
                        <div class="o-card__body">
                          <h3>{it.name}</h3>
                          <p>{it.desc}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section class="o-cat o-cat--rows" id={`cat-${cat.id}`} aria-labelledby={`h-${cat.id}`} key={cat.id}>
                <h2 class="o-cat__title" id={`h-${cat.id}`}>
                  {cat.name}
                </h2>
                <div class="o-rows">
                  {cat.items.map((it) => {
                    const q = cart[it.id] ?? 0;
                    return (
                      <div class="o-row" id={`item-${it.id}`} key={it.id}>
                        <div class="o-row__text">
                          <h3>{it.name}</h3>
                          <span>
                            {it.desc}
                            <span class="o-mob"> · {eur(it.price)}</span>
                          </span>
                        </div>
                        <span class="o-row__price o-desk">{eur(it.price)}</span>
                        {q === 0 ? (
                          <button type="button" class="o-plus" onClick={() => setQty(it.id, 1)} aria-label={`Aggiungi ${it.name}`}>
                            +
                          </button>
                        ) : (
                          <Stepper name={it.name} qty={q} onSub={() => setQty(it.id, -1)} onAdd={() => setQty(it.id, 1)} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ),
          )}
        </div>
        {cartPanel}
      </div>

      <div class="o-bar o-mob">
        <div class="o-bar__thumbs" aria-hidden="true">
          {thumbs.map((t) => (
            <img src={images[t.id].thumb} alt="" key={t.id} />
          ))}
        </div>
        <div class="o-bar__sum" aria-live="polite">
          <span>{totals.count === 0 ? 'Il carrello è vuoto.' : totals.belowMin ? minOrderTxt() : countTxt(totals.count)}</span>
          <span>{eur(totals.total)}</span>
        </div>
        <button type="button" class="o-cta o-cta--pill" onClick={goToData} disabled={!canContinue}>
          Continua
        </button>
      </div>
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <>
      <button type="button" role="radio" aria-checked={mode === 'consegna'} onClick={() => setMode('consegna')}>
        Consegna
      </button>
      <button type="button" role="radio" aria-checked={mode === 'asporto'} onClick={() => setMode('asporto')}>
        Ritiro
      </button>
    </>
  );
}

function Stepper(p: { name: string; qty: number; onSub: () => void; onAdd: () => void; big?: boolean }) {
  return (
    <div class={`o-stepper${p.big ? ' o-stepper--big' : ''}`}>
      <button type="button" onClick={p.onSub} aria-label={`Togli: ${p.name}`}>
        −
      </button>
      <span aria-live="polite" aria-label={`${p.name}: ${p.qty} nel carrello`}>
        {p.qty}
      </span>
      <button type="button" onClick={p.onAdd} aria-label={`Aggiungi: ${p.name}`} class="o-stepper__add">
        +
      </button>
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

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Ricerca piatto: suggerisce mentre si scrive e porta alla voce scelta */
function MenuSearch({ menu }: { menu: MenuCategory[] }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const all = useMemo(() => menu.flatMap((c) => c.items.map((it) => ({ it, cat: c }))), [menu]);
  const term = norm(q.trim());
  const results = useMemo(() => {
    if (term.length < 2) return [];
    const words = term.split(/\s+/);
    const score = (n: string, d: string) => {
      if (n.startsWith(term)) return 0;
      if (words.every((w) => n.includes(w))) return 1;
      if (words.every((w) => (n + ' ' + d).includes(w))) return 2;
      return 9;
    };
    return all
      .map((r) => ({ r, s: score(norm(r.it.name), norm(r.it.desc)) }))
      .filter((x) => x.s < 9)
      .sort((a, b) => a.s - b.s)
      .slice(0, 6)
      .map((x) => x.r);
  }, [term, all]);

  const pick = (id: string) => {
    setOpen(false);
    setQ('');
    const el = document.getElementById(`item-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('is-found');
    void el.offsetWidth; // riavvia l'animazione
    el.classList.add('is-found');
    setTimeout(() => el.classList.remove('is-found'), 2200);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && results[hi]) {
      e.preventDefault();
      pick(results[hi].it.id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && term.length >= 2;
  return (
    <div class="o-search" role="search">
      <svg class="o-search__ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        class="o-search__input"
        placeholder="Cerca una pizza, una bevanda…"
        aria-label="Cerca nel menù"
        role="combobox"
        aria-expanded={showList}
        aria-controls="o-search-list"
        autocomplete="off"
        value={q}
        onInput={(e) => {
          setQ((e.currentTarget as HTMLInputElement).value);
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
      />
      {q && (
        <button type="button" class="o-search__clear" aria-label="Cancella ricerca" onClick={() => setQ('')}>
          ×
        </button>
      )}
      {showList && (
        <ul class="o-search__list" id="o-search-list" role="listbox">
          {results.length === 0 ? (
            <li class="o-search__none">Nessun risultato per «{q.trim()}»</li>
          ) : (
            results.map((r, i) => (
              <li key={r.it.id} role="option" aria-selected={i === hi}>
                <button type="button" class={i === hi ? 'is-hi' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r.it.id)}>
                  <span class="o-search__name">{r.it.name}</span>
                  <span class="o-search__meta">
                    {r.cat.name} · {eur(r.it.price)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/** Pillole categorie: scorrono alla sezione e si evidenziano in base allo scroll */
function CategoryPills({ menu }: { menu: MenuCategory[] }) {
  const [active, setActive] = useState(menu[0]?.id);
  const lock = useRef(0);
  const rail = useRef<HTMLElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });

  const measure = () => {
    const el = rail.current;
    if (el) setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    addEventListener('resize', measure);
    return () => removeEventListener('resize', measure);
  }, [menu]);
  // la pillola attiva resta visibile nella barra
  useEffect(() => {
    const el = rail.current;
    const btn = el?.querySelector<HTMLElement>('.is-active');
    if (el && btn) el.scrollTo({ left: btn.offsetLeft - el.clientWidth / 2 + btn.offsetWidth / 2, behavior: 'smooth' });
  }, [active]);
  const nudge = (dir: number) => rail.current?.scrollBy({ left: dir * rail.current.clientWidth * 0.7, behavior: 'smooth' });
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        if (Date.now() < lock.current) return;
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id.replace('cat-', ''));
      },
      { rootMargin: '-90px 0px -55% 0px' },
    );
    menu.forEach((c) => {
      const el = document.getElementById(`cat-${c.id}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [menu]);

  const go = (id: string) => {
    setActive(id);
    lock.current = Date.now() + 1200;
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div class="o-pills-wrap">
      {edge.l && (
        <button type="button" class="o-pills-arrow o-pills-arrow--l o-desk" aria-label="Categorie precedenti" onClick={() => nudge(-1)}>
          ‹
        </button>
      )}
      <nav class="o-pills" aria-label="Categorie" ref={rail} onScroll={measure} onWheel={(e) => {
        // rotella del mouse: scorre in orizzontale anche senza trackpad
        const el = e.currentTarget as HTMLElement;
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
          el.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      }}>
        {menu.map((c) => (
          <button type="button" key={c.id} class={active === c.id ? 'is-active' : ''} aria-current={active === c.id ? 'true' : undefined} onClick={() => go(c.id)}>
            <span class="o-desk">{c.name}</span>
            <span class="o-mob">{c.short}</span>
          </button>
        ))}
      </nav>
      {edge.r && (
        <button type="button" class="o-pills-arrow o-pills-arrow--r o-desk" aria-label="Altre categorie" onClick={() => nudge(1)}>
          ›
        </button>
      )}
    </div>
  );
}
