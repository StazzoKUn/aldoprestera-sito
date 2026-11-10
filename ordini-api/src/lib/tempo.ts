// Giornata della pizzeria nel fuso Europe/Rome (il DB è in UTC).
const TZ = "Europe/Rome";

// Offset di Roma rispetto a UTC in quell'istante, in millisecondi (3.600.000 d'inverno, 7.200.000 d'estate)
function offsetRoma(istante: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(istante)
      .map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!) - istante.getTime();
}

/** Data (YYYY-MM-DD) di oggi a Roma */
export const oggiRoma = (adesso = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(adesso);

const mezzanotte = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - offsetRoma(new Date(guess)));
};

/** Dalla mezzanotte (inclusa) alla mezzanotte successiva (esclusa) del giorno indicato, a Roma; senza argomenti: oggi */
export function giornoRoma(ymd = oggiRoma()) {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const domani = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { da: mezzanotte(ymd), a: mezzanotte(domani) };
}
