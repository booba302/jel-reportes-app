// Aplica en orden los .sql de db/migraciones que aún no se aplicaron.
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const sql = postgres(process.env.DIRECT_URL!, { max: 1, onnotice: () => {} });
const dir = path.join(process.cwd(), "db", "migraciones");

await sql`create table if not exists _migraciones (nombre text primary key, aplicada_el timestamptz not null default now())`;
await sql`alter table _migraciones enable row level security`;
const hechas = new Set((await sql`select nombre from _migraciones`).map((r) => r.nombre as string));

for (const archivo of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (hechas.has(archivo)) continue;
  await sql.begin(async (tx) => {
    await tx.unsafe(fs.readFileSync(path.join(dir, archivo), "utf8"));
    await tx`insert into _migraciones (nombre) values (${archivo})`;
  });
  console.log("aplicada:", archivo);
}
console.log("Esquema al día.");
await sql.end();
