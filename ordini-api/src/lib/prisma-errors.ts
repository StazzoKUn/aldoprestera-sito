// Riconosce un errore noto di Prisma tramite il suo codice (P2002, P2003, P2025...).
// Serve ai service per trasformarlo in un messaggio specifico; gli errori non
// intercettati vengono comunque tradotti in modo generico da error-handler.ts.
import { Prisma } from "../generated/prisma/client.js";

export function isPrismaError(err: unknown, code: string): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}
