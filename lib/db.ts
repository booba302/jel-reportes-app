import postgres from "postgres";

// Una sola conexión por proceso. En desarrollo Next recarga módulos, por eso se guarda en globalThis.
const g = globalThis as unknown as { sql?: postgres.Sql };

export const sql =
  g.sql ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false, // obligatorio con el transaction pooler de Supabase (puerto 6543)
    max: 5,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") g.sql = sql;
