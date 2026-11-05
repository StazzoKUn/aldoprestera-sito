// Legge e valida le variabili d'ambiente una sola volta, all'avvio.
// Se manca qualcosa l'app si ferma subito con un messaggio chiaro.
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .regex(/^(mysql|mariadb):\/\//, "deve iniziare con mysql:// o mariadb://"),
  // Facoltativa: forza il log SQL (true/false). Se assente, è attivo solo in development.
  LOG_QUERIES: z.enum(["true", "false"]).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variabili d'ambiente non valide:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isDev = env.NODE_ENV === "development";
export const logQueries = env.LOG_QUERIES ? env.LOG_QUERIES === "true" : isDev;
