// Compara Firestore vs Postgres: cantidad de retiros por mes, y en todo el histórico
// la suma de Tiempo, los que cumplen y los que tienen comentario de brecha.
// Solo usa consultas que Firestore resuelve sin índices compuestos.
import postgres from "postgres";
import { AggregateField } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

const db = postgres(process.env.DIRECT_URL!, { max: 1 });
const col = adminDb.collection("operaciones_retiros");
let fallas = 0;
const comparar = (titulo: string, fs: number, pg: number, tolerancia = 0) => {
  const ok = Math.abs(fs - pg) <= tolerancia;
  if (!ok) fallas++;
  console.log(`${titulo.padEnd(28)} firestore ${String(fs).padStart(12)}  postgres ${String(pg).padStart(12)}  ${ok ? "OK" : "DIFERENCIA"}`);
};

const meses = (await db`
  select to_char(fecha_reporte, 'YYYY-MM') as mes, count(*)::int as n
  from retiros group by 1 order by 1`) as unknown as { mes: string; n: number }[];
for (const m of meses) {
  const [y, mm] = m.mes.split("-").map(Number);
  const siguiente = new Date(Date.UTC(y, mm, 1)).toISOString().slice(0, 7);
  const n = (
    await col
      .where("Fecha del reporte", ">=", `${m.mes}-01T00:00:00.000Z`)
      .where("Fecha del reporte", "<", `${siguiente}-01T00:00:00.000Z`)
      .count()
      .get()
  ).data().count;
  comparar(`retiros ${m.mes}`, n, m.n);
}

const [pg] = await db`
  select count(*)::int as n, sum(tiempo)::float8 as tiempo,
         count(*) filter (where cumple)::int as cumplen,
         count(*) filter (where comentario_brecha <> '')::int as con_comentario
  from retiros`;
const total = (await col.aggregate({ n: AggregateField.count(), tiempo: AggregateField.sum("Tiempo") }).get()).data();
const cumplen = (await col.where("Cumple", "==", true).count().get()).data().count;
const conComentario = (await col.where("comentarioBrecha", ">", "").count().get()).data().count;
comparar("retiros (total)", total.n, pg.n);
comparar("suma de Tiempo (min)", Math.round(total.tiempo ?? 0), Math.round(pg.tiempo), Math.max(1, pg.n * 0.001));
comparar("cumplen", cumplen, pg.cumplen);
comparar("con comentario de brecha", conComentario, pg.con_comentario);

const [h] = await db`select count(*)::int as n from historial_reportes`;
const [o] = await db`select count(*)::int as n from observaciones_diarias`;
comparar("historial_reportes", (await adminDb.collection("historial_reportes").count().get()).data().count, h.n);
comparar("observaciones_diarias", (await adminDb.collection("observaciones_diarias").count().get()).data().count, o.n);

console.log(fallas ? `${fallas} diferencias` : "Todo coincide.");
await db.end();
process.exit(fallas ? 1 : 0);
