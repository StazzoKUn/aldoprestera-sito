# Handoff: Aldo Prestera Pizzeria — one-page site (Astro) + local ordering system

## ⚠ Read first — scope and order of work

1. **Phase 1 (build now): the one-page website**, built in **Astro**, matching the mockup 1:1 (landing sections + the online-order flow as shown in the mockup).
2. **Phase 2 (LAST — do NOT start it now): the order-tracking "menu" system.** It is a **Glovo-style, pizzeria-local variant** that lives inside the site. **Do not start designing or building Phase 2 until Phase 1 is finished and the user explicitly says to proceed.** Until then, only set up the task (see "Phase 2 — placeholder task" below): a short `docs/TODO-ordering-system.md` and, at most, empty/stubbed routes. No data model, no UI design, no backend decisions.
3. Always follow the mockup as the reference for features and behavior. Don't invent features beyond it. The only extra context: the ordering system will behave like Glovo (order status, ETA), nothing more is specified yet.

## About the design files
Files in `reference/` are **design references made in HTML** (a Design Component with live mock interactions) — prototypes of look and behavior, **not production code to copy**. Recreate them in Astro using its idioms (`.astro` components, static-first, small islands for interactivity). Open `reference/Mockup Pizzeria Aldo Prestera.dc.html` in a browser to view it (needs `support.js` beside it; assets in `reference/assets/`). All the designs are on one pannable canvas, labelled by id.

## Fidelity
**High-fidelity.** Final colors, type, spacing, copy. Recreate pixel-faithfully. Placeholder content to replace later with real data: phone `000 000 0000`, address `Via Esempio 12, 00000 Città (XX)`, P.IVA `00000000000`, hours, prices/menu items, social links, map.

## Mockup map (canvas ids)
- **1a** Landing desktop (1280) · **1b** Landing mobile (390) → **the one-page site**
- **2a** Order page desktop (current version) · **2b** Order mobile (current) → **ordering UI** (supersedes 1c/1d)
- **1e** Order step 2 (data + time) mobile · **1f** Customer confirmation · **1g** Order notification to Aldo (email/WhatsApp)
- **2c** Logo on light / dark / red

(1c, 1d are superseded by 2a, 2b — ignore them.)

## Suggested architecture
- Astro, single page `src/pages/index.astro` with anchor sections: hero, "Le nostre pizze" (featured), "Come funziona", "Dove siamo", footer. Nav anchors: Menù, La pizzeria, Orari, Contatti + "Ordina ora" CTA.
- Ordering flow (menu → data → confirmation) as an interactive island (React/Preact/Svelte, your pick) mounted from the page, either as a section/overlay or `/ordina` route. Keep desktop two-column (menu + sticky cart) and mobile single-column with bottom cart bar, as in 2a/2b.
- Menu data in one typed file (`src/data/menu.ts`) — same shape as the mockup (categories → items `{id,name,desc,price,img?}`) so Phase 2 can later swap it for an API.
- Responsive: desktop frame 1280, mobile frame 390; fluid between. Min tap target 44px.

## Design tokens
Colors
- Ink dark `#141312` (site bg / cart / header) · radial hero bg `#1f1d1b → #141312`
- Paper `#f2efe9` (light sections, order page bg) · white `#fff` (cards)
- Text on light `#1a1817`; muted `#6b665f`, `#5f5a54`; borders `#dcd7cf`, `#cfc9c0`, `#d6d1c9`; segmented bg `#e4e0d9`
- Text on dark `#f2efe9`; muted `#bdb8b0`, `#a39e97`, `#8e8983`, `#6e6963`
- Brand red `#b8262d` (buttons, price accents on light); red on dark `#d0443f` (eyebrows, numerals); hover link `#e05252`
Typography (Google Fonts)
- **Cormorant Garamond** 500/600, italic 500/600 — headings, dish names (hero h1 88px/0.98 italic 500; section h2 60px italic; dish name 32px 600 desktop / 26px mobile; mobile h1 48px)
- **Jost** 300/400/500/600 — body 15–18px weight 300; UI labels 12–14px uppercase, letter-spacing .14–.42em, weight 500
Shape & shadow: buttons on landing radius 2px; order page pills radius 40px; dish cards square, shadow `0 1px 2px rgba(26,24,23,.06)`; floating add button shadow `0 6px 18px rgba(0,0,0,.25)`; mobile cart bar radius 40px, shadow `0 10px 30px rgba(0,0,0,.3)`.
Spacing: page gutter 56px desktop / 20–24px mobile; section padding 88px desktop; grid gaps 28–40px.

## Screens

### One-page site (1a/1b)
- **Header**: logo-chiaro (h 56px desktop, 44 mobile), nav, red "Ordina ora" button. Mobile: hamburger (3 thin lines).
- **Hero**: 2 columns. Left: eyebrow "Pizzeria · Asporto e consegna", h1 "Ordina la pizza online.", copy "Scegli dal menù e l'orario. Te la portiamo a casa o passi a ritirarla. Paghi alla consegna.", CTAs "Ordina online" (red) + "Guarda il menù" (outline), hours + phone line. Right: `hero-aldo.png` cover, position center 30%. Mobile: image square on top, then text; CTAs "Ordina online" + "Chiama …".
- **Le nostre pizze**: 3 featured (first 3 specials) in 3-col grid (4:3 images), name + red price + description; link "Menù completo". Mobile: list rows with 72px thumbnails.
- **Come funziona**: 3 numbered steps (01 Scegli le pizze · 02 Ritiro o consegna · 03 Paghi alla consegna) with red top border.
- **Dove siamo**: address / orari / telefono / seguici + map block with pin and "Indicazioni" button. Mockup map is a stylised placeholder → use a real map embed or static map.
- **Footer**: © 2026 Aldo Prestera Pizzeria · P.IVA …, Privacy · Cookie.

### Order flow (2a/2b → 1e → 1f)
- **Step 1 Menù** (2a desktop / 2b mobile): step indicator (1 Menù — 2 Dati — 3 Conferma). Title "Menù" italic. Segmented toggle **Consegna / Ritiro**. Category pills (Le speciali, Le classiche, Bevande) — in the mockup they are static, make them scroll/filter. Specials: 2-col cards with photo (5:4), black price tag top-left, red pill "+ Aggiungi" bottom-right that becomes a −/qty/+ stepper. Classiche & Bevande: compact rows with outline "+" circle → stepper. **Cart** (sticky right, 380px): "Il tuo ordine", item count, lines with 48px round thumb (initial letter fallback when no photo), subtotal, fee line, total, red "Continua", note "Paghi alla consegna · contanti o carta". Mobile: bottom floating bar with thumb stack, count, total, "Continua".
- **Step 2 Dati e orario** (1e): name, phone; if Consegna: address, n°, citofono/piano; time-slot chips (19:30–21:15, 15-min; label "Orario di consegna"/"Orario di ritiro"); notes; payment on delivery chips (Contanti / Carta / POS); footer with count, fee, total, "Invia ordine". Slots should come from opening hours + prep capacity (real logic later).
- **Step 3 Conferma** (1f): "Ordine ricevuto", "Ti chiamiamo per confermare. Consegna alle HH:MM." / "Pronta alle HH:MM.", order n°, slot, lines, total + pay method, "Chiama la pizzeria".
- **Order notification to Aldo** (1g): email and/or WhatsApp with order #, mode + time, customer, address, lines, total (pay method), notes, "Chiama cliente", "Apri su mappa". For Phase 1: a simple server endpoint (Astro endpoint / serverless) sending the email; no accounts.

## Interactions & state (Phase 1)
- `cart: {itemId: qty}` (min 0), `mode: 'consegna' | 'asporto'`, `slot`, `pay`.
- Derived: line totals, subtotal, count ("1 articolo"/"N articoli"), delivery fee **€ 2,00 only if mode=consegna and cart non-empty**, Ritiro fee "gratis". Prices formatted `€ 9,50`.
- Empty cart: "Il carrello è vuoto."
- Persist cart in localStorage. Validate required fields (name, phone, address when delivery, slot). Show error/loading states on submit.

## Menu data in mockup (placeholder, replace with real)
Speciali: Crudo e rucola 9,50 · Salsiccia e friarielli 9,00 · Patate e porchetta 10,00 · Würstel e patatine 8,00 (each with photo). Classiche: Margherita 6,00 · Marinara 5,00 · Diavola 7,50 · Capricciosa 8,50. Bevande: Acqua 50 cl 1,50 · Birra 33 cl 3,50 · Coca-Cola 33 cl 2,50. Descriptions are in the reference file's `menu` array.

## Phase 2 — placeholder task (DO NOT START NOW)
Create only `docs/TODO-ordering-system.md` with this brief, then stop:

> **Local order-tracking system, "Glovo-style" but owned by the pizzeria and embedded in the site.** After sending an order, the customer sees a live status page: *order received → accepted by the pizzeria → being prepared → ready / out for delivery → completed*, plus estimated time until pickup/delivery and updates when Aldo changes status. Aldo needs a simple back-office view to accept/refuse orders, set prep time, and advance status. To be specified and built **last**, after the one-page site is complete and approved. Follow the mockup's visual language and keep scope close to it. Open questions for later: realtime transport (SSE/WebSocket/polling), storage, auth for the back-office, notifications (WhatsApp/SMS/email).

## Assets (`reference/assets/`)
- `logo-chiaro.png` (light logo, for dark bg), `logo-scuro.png` (dark logo, for light bg), `logo-aldo-prestera.png` (original)
- `hero-aldo.png` — B/W portrait, flour cloud
- `pizza-crudo-rucola.png`, `pizza-salsiccia-friarielli.png`, `pizza-patate-porchetta.png`, `pizza-wurstel-patatine.png` — client photos (cropped square). Optimize with Astro `<Image>`; keep alt text.

## Files
- `reference/Mockup Pizzeria Aldo Prestera.dc.html` — all designs + mock interactions (state logic at the bottom `<script>`)
- `reference/support.js` — runtime needed only to view the mockup
- `reference/assets/*` — images
