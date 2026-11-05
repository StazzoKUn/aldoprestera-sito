// Calcoli sugli importi con Prisma.Decimal (decimal.js): niente errori dei float
// come 0.1 + 0.2 = 0.30000000000000004. Arrotondamento a 2 decimali "commerciale"
// (ROUND_HALF_UP: 0.005 -> 0.01).
import { Prisma } from "../generated/prisma/client.js";

export const IMPORTO_MASSIMO = new Prisma.Decimal("99999999.99"); // limite di DECIMAL(10,2)

export function arrotonda(valore: Prisma.Decimal): Prisma.Decimal {
  return valore.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function somma(valori: Prisma.Decimal[]): Prisma.Decimal {
  return arrotonda(valori.reduce((acc, v) => acc.add(v), new Prisma.Decimal(0)));
}
