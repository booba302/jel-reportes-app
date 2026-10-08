"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { addMonths, getDaysInMonth } from "date-fns";
import { db } from "@/lib/firebase";
import { veGrupo, type Evaluacion } from "@/lib/evaluacion";
import type { ParsedRole } from "@/lib/roles";
import {
  vigenteDelMes,
  type CierreMensual,
  type MetricasMes,
  type RankingFila,
  type ResultadoCierre,
} from "@/lib/cierre";
import { parseMesStr, toMesStr } from "@/components/reportes/fechas";

export const MESES_TENDENCIA = 6;

/** id del documento de cierre: el admin cierra el global; los demás, su grupo. */
export const idCierre = (mes: string, rol: ParsedRole) =>
  rol.isAdmin ? mes : `${mes}_${rol.grupoUsuario}`;

const finDeMes = (mes: string) =>
  `${mes}-${String(getDaysInMonth(parseMesStr(mes))).padStart(2, "0")}T23:59:59.999Z`;

type Crudo = {
  key: string;
  diarias: Evaluacion[];
  /** Documento de cierre por mes, tal como viene de Firestore (o null). */
  raws: Record<string, Record<string, unknown> | null>;
};

export type VistaMes = {
  mes: string;
  /** Hay snapshot vigente (estado cerrado). */
  cerrado: boolean;
  ranking: RankingFila[];
  metrics: MetricasMes;
  /** Siempre en vivo (para el paso 2 y el resumen preliminar). */
  vivo: ResultadoCierre;
  /** Documento del cierre (también si está reabierto, para el historial). */
  documento: CierreMensual | null;
};

/** Datos del mes elegido y de los 5 anteriores (comparación, ▲▼ y tendencia). */
export function useCierreMes({
  mes,
  rol,
  excluidos,
  listo,
  version,
}: {
  mes: string;
  rol: ParsedRole;
  /** Nombres normalizados. */
  excluidos: Set<string>;
  listo: boolean;
  version: number;
}) {
  const [crudo, setCrudo] = useState<Crudo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = `${mes}|${rol.isAdmin}|${rol.grupoUsuario}|${version}`;

  useEffect(() => {
    if (!listo) return;
    let cancelado = false;
    const meses = Array.from({ length: MESES_TENDENCIA }, (_, i) =>
      toMesStr(addMonths(parseMesStr(mes), i - (MESES_TENDENCIA - 1))),
    );

    Promise.all([
      getDocs(
        query(
          collection(db, "evaluaciones_desempeno"),
          where("fecha", ">=", `${meses[0]}-01T00:00:00.000Z`),
          where("fecha", "<=", finDeMes(mes)),
        ),
      ),
      Promise.all(meses.map((m) => getDoc(doc(db, "evaluaciones_mensuales", idCierre(m, rol))))),
    ])
      .then(([snapEvals, snapsCierre]) => {
        const diarias: Evaluacion[] = [];
        snapEvals.forEach((d) => {
          const ev = d.data() as Evaluacion;
          if (veGrupo(rol, ev.grupoMoneda)) diarias.push(ev);
        });
        const raws: Crudo["raws"] = {};
        snapsCierre.forEach((s, i) => {
          raws[meses[i]] = s.exists() ? (s.data() as Record<string, unknown>) : null;
        });
        if (!cancelado) {
          setCrudo({ key, diarias, raws });
          setError(null);
        }
      })
      .catch((err) => {
        console.error("Error cargando el cierre mensual:", err);
        if (!cancelado) setError(key);
      });

    return () => {
      cancelado = true;
    };
  }, [key, listo, mes, rol]);

  const vistas = useMemo(() => {
    if (!crudo) return null;
    const meses = Object.keys(crudo.raws).sort();
    const porMes: Record<string, VistaMes> = {};
    let anterior: RankingFila[] | null = null;

    for (const m of meses) {
      const v = vigenteDelMes({
        diariasMes: crudo.diarias.filter((ev) => String(ev.fecha).startsWith(m)),
        excluidos,
        rankingAnterior: anterior,
        raw: crudo.raws[m],
      });
      porMes[m] = { mes: m, ...v };
      anterior = v.ranking;
    }
    return { meses, porMes };
  }, [crudo, excluidos]);

  const vigente = crudo?.key === key ? vistas : null;
  const actual = vigente?.porMes[mes] ?? null;
  const previo = vigente ? vigente.porMes[vigente.meses[vigente.meses.length - 2]] : null;

  return {
    cargando: !vigente && error !== key,
    error: error === key,
    actual,
    previo: previo && previo.ranking.length > 0 ? previo : null,
    tendencia: vigente ? vigente.meses.map((m) => vigente.porMes[m]) : [],
  };
}

/** Estado de cierre de cada mes del año (puntos del selector). */
export function useEstadoMeses(anio: number, rol: ParsedRole, listo: boolean, version: number) {
  const [estados, setEstados] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!listo) return;
    let cancelado = false;
    getDocs(
      query(
        collection(db, "evaluaciones_mensuales"),
        where("mes", ">=", `${anio}-01`),
        where("mes", "<=", `${anio}-12`),
      ),
    )
      .then((snap) => {
        const r: Record<string, boolean> = {};
        snap.forEach((d) => {
          const data = d.data();
          const mes = String(data.mes);
          if (d.id !== idCierre(mes, rol)) return; // otro grupo
          r[mes] = data.estado !== "reabierto";
        });
        if (!cancelado) setEstados((e) => ({ ...e, ...r }));
      })
      .catch((err) => console.error("Error leyendo estados de cierre:", err));
    return () => {
      cancelado = true;
    };
  }, [anio, rol, listo, version]);

  return estados;
}
