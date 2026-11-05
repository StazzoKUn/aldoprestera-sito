/** 9.5 → "€ 9,50" */
export const eur = (n: number) => '€ ' + n.toFixed(2).replace('.', ',');

/** 1 → "1 articolo", 3 → "3 articoli" */
export const countTxt = (n: number) => (n === 1 ? '1 articolo' : `${n} articoli`);
