import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { exigirMoneda } from "@/lib/monedasServer";
import { armarVistas, parseDateStr, type Celda } from "@/lib/dashboard";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Las vistas del dashboard ya calculadas para un período y su período de comparación. */
export async function GET(request: Request) {
  try {
    const yo = await requireUser(request);
    const p = new URL(request.url).searchParams;
    const moneda = p.get("moneda") ?? "";
    const historico = p.get("historico") === "1";
    const [desde, hasta, prevDesde, prevHasta, serieHasta] = [
      "desde",
      "hasta",
      "prevDesde",
      "prevHasta",
      "serieHasta",
    ].map((k) => p.get(k) ?? "");
    exigirMoneda(yo, moneda, { global: true });
    if (![desde, hasta, prevDesde, prevHasta, serieHasta].every((d) => DIA.test(d)))
      throw new HttpError(400, "Período inválido.");

    const filtroMoneda = moneda === "GLOBAL" ? sql`` : sql`and moneda = ${moneda}`;
    const filtroFecha = historico
      ? sql``
      : sql`and fecha_reporte between least(${prevDesde}::date, ${desde}::date) and ${hasta}::date`;

    const celdas = (await sql`
      select fecha_reporte::text as fecha, operador, btrim(nivel) as nivel, cumple, exonerado,
             count(*)::int as n, sum(tiempo)::float8 as tiempo, sum(cantidad)::float8 as monto
      from retiros
      where true ${filtroMoneda} ${filtroFecha}
      group by fecha_reporte, operador, btrim(nivel), cumple, exonerado`) as unknown as Celda[];

    const curr = historico ? celdas : celdas.filter((c) => c.fecha >= desde && c.fecha <= hasta);
    const prev = historico ? [] : celdas.filter((c) => c.fecha >= prevDesde && c.fecha <= prevHasta);
    const inicioSerie =
      historico && curr.length
        ? curr.reduce((m, c) => (c.fecha < m ? c.fecha : m), curr[0].fecha)
        : desde;

    const vistas = armarVistas(curr, prev, parseDateStr(inicioSerie), parseDateStr(serieHasta));
    return NextResponse.json({ success: true, ...vistas });
  } catch (e) {
    return errorResponse(e);
  }
}
