import { format } from "date-fns";
import {
  ETIQUETA_PUESTO,
  ETIQUETA_TURNO,
  HORA_TURNO,
  PUESTOS,
  TODAS_LAS_MONEDAS,
  TURNOS,
  claveTurno,
  describirTurnoEspecial,
  diasDelMes,
  fechaCorta,
  nombreCorto,
  personasTurno,
  type DiaEspecial,
  type FilaTurno,
} from "@/lib/horario";
import type { Celda, DocumentoPdf } from "@/components/pdf/documento";
import { nombreMesAnio } from "@/components/reportes/fechas";
import { DIAS, diaSemana } from "./CalendarioMes";

/** Texto de un día del calendario: número, nota y quién cubre cada puesto. */
function textoDia(fecha: string, porClave: Map<string, FilaTurno>, esp: DiaEspecial | undefined) {
  const lineas = [`${Number(fecha.slice(8))}${esp?.nota ? ` · ${esp.nota}` : ""}`];
  for (const turno of TURNOS) {
    const personas = personasTurno(esp, turno);
    const horario = turno === "manana" ? esp?.horarioManana : esp?.horarioTarde;
    lineas.push(`${ETIQUETA_TURNO[turno]}${horario ? ` (${horario})` : ""}`);
    if (personas === 0) lineas.push("Cerrado");
    for (const puesto of PUESTOS.slice(0, personas)) {
      const t = porClave.get(claveTurno(fecha, turno, puesto));
      const etiqueta = personas === 1 ? TODAS_LAS_MONEDAS : ETIQUETA_PUESTO[puesto];
      lineas.push(`${etiqueta}: ${t ? nombreCorto(t.colaborador) : "—"}`);
    }
  }
  return lineas.join("\n");
}

/** Documento PDF del horario del mes (A4 horizontal), con el formato del calendario. */
export function documentoHorario({
  mes,
  turnos,
  ausencias,
  especiales,
  usuario,
}: {
  mes: string;
  turnos: FilaTurno[];
  ausencias: { colaborador: string; tipo: string; inicio: string; retorno: string }[];
  especiales: DiaEspecial[];
  usuario: string;
}): DocumentoPdf {
  const porClave = new Map(turnos.map((t) => [claveTurno(t.fecha, t.turno, t.puesto), t]));
  const especialDe = new Map(especiales.map((e) => [e.fecha, e]));

  // Semanas de lunes a domingo; los días fuera del mes quedan en blanco.
  const semanas: Celda[][] = [];
  let semana: Celda[] = Array.from({ length: diaSemana(`${mes}-01`) }, () => "");
  for (const fecha of diasDelMes(mes)) {
    const esp = especialDe.get(fecha);
    semana.push({ texto: textoDia(fecha, porClave, esp), fondo: esp ? "revisar" : "vacio" });
    if (semana.length === 7) {
      semanas.push(semana);
      semana = [];
    }
  }
  if (semana.length) semanas.push([...semana, ...Array.from({ length: 7 - semana.length }, () => "")]);

  return {
    nombreArchivo: `Horario_${mes}.pdf`,
    orientacion: "horizontal",
    titulo: `Horario de turnos · ${nombreMesAnio(mes)}`,
    subtitulo: "Retiros internacionales",
    bloques: [
      { tipo: "tabla", cabecera: DIAS, filas: semanas, compacta: true },
      {
        tipo: "notas",
        titulo: "Horario",
        items: TURNOS.map((t) => ({ etiqueta: ETIQUETA_TURNO[t], texto: HORA_TURNO[t] })),
        vacio: "",
      },
      ...(especiales.length
        ? [
            {
              tipo: "notas" as const,
              titulo: "Días especiales",
              items: especiales.map((e) => ({
                etiqueta: `${fechaCorta(e.fecha)}${e.nota ? ` · ${e.nota}` : ""}`,
                texto: `Mañana: ${describirTurnoEspecial(e, "manana")} · Tarde: ${describirTurnoEspecial(e, "tarde")}`,
              })),
              vacio: "",
            },
          ]
        : []),
      {
        tipo: "notas",
        titulo: "Ausencias del mes",
        items: ausencias.map((a) => ({
          etiqueta: nombreCorto(a.colaborador),
          texto: `${a.tipo} · del ${fechaCorta(a.inicio)}, vuelve el ${fechaCorta(a.retorno)}`,
        })),
        vacio: "Ninguna",
      },
    ],
    pie: [`Generado por ${usuario} · ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
  };
}
