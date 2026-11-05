import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { MenuCategory } from '../../data/menu';
import { eur, countTxt } from '../../lib/format';
import { delivery } from '../../data/site';
import {
  PAYS,
  computeTotals,
  minOrderTxt,
  validateOrder,
  type Cart,
  type Customer,
  type FieldErrors,
  type Mode,
  type OrderLine,
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

type Step = 'menu' | 'dati' | 'conferma';

interface Confirmation extends OrderResponse {
  mode: Mode;
  slot: string;
  pay: Pay;
  email: string;
}

const LS_CART = 'aldo:cart';
const LS_MODE = 'aldo:mode';
const SS_DONE = 'aldo:confirmation';

const emptyCustomer: Customer = {
  name: '',
  phone: '',
  email: '',
  zone: delivery.zones[0]?.id ?? '',
  street: '',
  number: '',
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
  const [pay, setPay] = useState<Pay>('Contanti');
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [privacy, setPrivacy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [done, setDone] = useState<Confirmation | null>(null);
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
    const savedDone = read<Confirmation>(sessionStorage, SS_DONE);
    const params = new URLSearchParams(location.search);
    if (params.get('passo') === 'conferma' && savedDone) {
      setDone(savedDone);
      setStepState('conferma');
    } else if (params.get('passo') === 'dati' && savedCart && Object.keys(savedCart).length) {
      setStepState('dati');
    }
    setHydrated(true);
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
      setStepState(p === 'dati' ? 'dati' : p === 'conferma' && done ? 'conferma' : 'menu');
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [done]);

  const totals = computeTotals(cart, mode, menu, customer.zone);
  const isC = mode === 'consegna';
  const feeLabel = isC ? 'Consegna' : 'Ritiro';
  const feeTxt = isC ? eur(totals.fee) : 'gratis';

  // Slot liberi chiesti al server (orari + capacità del forno), aggiornati ogni minuto
  useEffect(() => {
    if (step !== 'dati') return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/slot?mode=${mode}&pizze=${totals.pizzas}`);
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
  }, [step, mode, totals.pizzas, slotsReload]);
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
      const conf: Confirmation = { ...(data as OrderResponse), mode, slot, pay, email: customer.email.trim() };
      write(sessionStorage, SS_DONE, conf);
      setDone(conf);
      setCart({});
      setCustomer(emptyCustomer);
      setPrivacy(false);
      setStep('conferma', true);
    } catch (err) {
      setSendError(
        err instanceof Error && err.message !== 'Errore di invio' && err.message !== 'Failed to fetch'
          ? err.message
          : `Non siamo riusciti a inviare l'ordine. Riprova o chiamaci al ${phone}.`,
      );
    } finally {
      setSending(false);
    }
  };

  /* ---------- Passo 3 · Conferma ---------- */
  if (step === 'conferma' && done) {
    const confIsC = done.mode === 'consegna';
    return (
      <div class="o-confirm">
        <div class="o-confirm__body">
          <a href="/" aria-label="Torna al sito">
            <img src={logo.large} alt="Aldo Prestera Pizzeria" class="o-confirm__logo" width={220} />
          </a>
          <div class="o-confirm__check" aria-hidden="true">✓</div>
          <h1>Ordine ricevuto</h1>
          <p>
            Ti chiamiamo per confermare. {confIsC ? `Consegna alle ${done.slot}.` : `Pronta alle ${done.slot}.`}
            {done.customerEmailSent && done.email && (
              <>
                <br />
                Riepilogo inviato a {done.email}.
              </>
            )}
          </p>
          <div class="o-confirm__recap">
            <div class="o-confirm__meta">
              <span>Ordine n. {done.number}</span>
              <span>ore {done.slot}</span>
            </div>
            {done.lines.map((l) => (
              <QtyLine l={l} />
            ))}
            {done.fee > 0 && (
              <div class="o-qline">
                <span>Consegna</span>
                <span>{eur(done.fee)}</span>
              </div>
            )}
            <div class="o-confirm__total">
              <span>Totale · {done.pay === 'Contanti' ? 'contanti' : 'carta'}</span>
              <span>{eur(done.total)}</span>
            </div>
          </div>
        </div>
        <div class="o-confirm__actions">
          <a href={phoneHref} class="o-btn-outline">
            Chiama la pizzeria
          </a>
        </div>
      </div>
    );
  }

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
          <button type="button" class="o-cta" onClick={goToData} disabled={!canContinue}>
            Continua
          </button>
        ) : (
          <button type="submit" form="o-form" class="o-cta" disabled={sending}>
            {sending ? 'Invio in corso…' : 'Invia ordine'}
          </button>
        )}
        {step === 'dati' && sendError && (
          <p class="o-send-error" role="alert">
            {sendError}
          </p>
        )}
        <span class="o-cart__note">Paghi alla consegna · contanti o carta</span>
      </div>
    </aside>
  );

  /* ---------- Passo 2 · Dati e orario ---------- */
  if (step === 'dati') {
    return (
      <div class="o-page">
        {header}
        <div class="o-layout">
          <form id="o-form" class="o-form" onSubmit={submit} noValidate>
            <h1>I tuoi dati</h1>
            <Field label="Nome e cognome" error={errors.name} id="f-name">
              <input id="f-name" type="text" autocomplete="name" required {...field('name')} aria-invalid={!!errors.name} />
            </Field>
            <Field label="Telefono" error={errors.phone} id="f-phone">
              <input id="f-phone" type="tel" inputMode="tel" autocomplete="tel" required {...field('phone')} aria-invalid={!!errors.phone} />
            </Field>
            <Field label="Email" error={errors.email} id="f-email" hint="Ti mandiamo il riepilogo dell'ordine">
              <input id="f-email" type="email" inputMode="email" autocomplete="email" required {...field('email')} aria-invalid={!!errors.email} />
            </Field>
            {isC && (
              <>
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
                <Field label="Citofono / piano" id="f-intercom">
                  <input id="f-intercom" type="text" placeholder="Es. Rossi, 2° piano" {...field('intercom')} />
                </Field>
              </>
            )}
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
            <fieldset class="o-field">
              <legend class="o-label">Pagamento alla consegna</legend>
              <div class="o-chips o-chips--2">
                {PAYS.map((p) => (
                  <label class="o-chip" key={p}>
                    <input type="radio" name="pay" value={p} checked={pay === p} onChange={() => setPay(p)} />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div class="o-field">
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
      <div class="o-layout">
        <div class="o-menu">
          <div class="o-menu__top">
            <h1>Menù</h1>
            <div class="o-seg" role="radiogroup" aria-label="Consegna o ritiro">
              <ModeToggle mode={mode} setMode={setMode} />
            </div>
          </div>
          <CategoryPills menu={menu} />
          {menu.map((cat) =>
            cat.layout === 'cards' ? (
              <section class="o-cat" id={`cat-${cat.id}`} aria-label={cat.name} key={cat.id}>
                <div class="o-cards">
                  {cat.items.map((it) => {
                    const img = images[it.id];
                    const q = cart[it.id] ?? 0;
                    return (
                      <article class="o-card" key={it.id}>
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
                      <div class="o-row" key={it.id}>
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

function QtyLine({ l }: { l: OrderLine }) {
  return (
    <div class="o-qline">
      <span>
        <b>{l.qty}×</b> {l.name}
      </span>
      <span>{eur(l.total)}</span>
    </div>
  );
}

/** Pillole categorie: scorrono alla sezione e si evidenziano in base allo scroll */
function CategoryPills({ menu }: { menu: MenuCategory[] }) {
  const [active, setActive] = useState(menu[0]?.id);
  const lock = useRef(0);
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
    <nav class="o-pills" aria-label="Categorie">
      {menu.map((c) => (
        <button type="button" key={c.id} class={active === c.id ? 'is-active' : ''} aria-current={active === c.id ? 'true' : undefined} onClick={() => go(c.id)}>
          <span class="o-desk">{c.name}</span>
          <span class="o-mob">{c.short}</span>
        </button>
      ))}
    </nav>
  );
}
