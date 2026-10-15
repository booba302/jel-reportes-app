"use client";

import { AlertTriangle, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardClass } from "@/components/dashboard/CardHeading";
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
  type Puesto,
  type Turno,
} from "@/lib/horario";

export const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
/** 0 = lunes … 6 = domingo */
export const diaSemana = (fecha: string) => (new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7;

export type Casilla = { fecha: string; turno: Turno; puesto: Puesto; colaborador: string };
/** Casilla abierta para editar; `todasLasMonedas` si es el único puesto del turno (día especial). */
export type CasillaEditable = Casilla & { todasLasMonedas?: boolean };

/** Calendario del mes con el formato del Excel: cada día con Mañana y Tarde, PEN/USD/MXN y CLP. */
export function CalendarioMes({
  mes,
  turnos,
  especiales = [],
  conflictos,
  onEditar,
}: {
  mes: string;
  turnos: (Casilla & { editadoManual?: boolean })[];
  especiales?: DiaEspecial[];
  conflictos?: Map<string, string>;
  onEditar?: (c: CasillaEditable) => void;
}) {
  const porClave = new Map(turnos.map((t) => [claveTurno(t.fecha, t.turno, t.puesto), t]));
  const especialDe = new Map(especiales.map((e) => [e.fecha, e]));
  const dias = diasDelMes(mes);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {DIAS.map((d) => (
        <div key={d} className="hidden px-1 text-xs font-medium text-muted-foreground lg:block">
          {d}
        </div>
      ))}
      {Array.from({ length: diaSemana(dias[0]) }, (_, i) => (
        <div key={`vacio-${i}`} className="hidden lg:block" />
      ))}
      {dias.map((fecha) => {
        const esp = especialDe.get(fecha);
        return (
          <div
            key={fecha}
            className={cn("rounded-lg border bg-card p-2 text-xs", esp ? "border-warning/60" : "border-border")}
          >
            <div className="mb-1.5 flex items-baseline gap-1.5 font-semibold">
              {DIAS[diaSemana(fecha)]} {Number(fecha.slice(8))}
              {esp?.nota && <span className="truncate text-[10px] font-medium text-warning-text">{esp.nota}</span>}
            </div>
            {TURNOS.map((turno) => {
              const personas = personasTurno(esp, turno);
              const horario = turno === "manana" ? esp?.horarioManana : esp?.horarioTarde;
              return (
                <div key={turno} className="mb-1 last:mb-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {ETIQUETA_TURNO[turno]}
                    {horario && <span className="normal-case tracking-normal"> · {horario}</span>}
                  </div>
                  {personas === 0 && (
                    <div className="rounded bg-muted/60 px-1 py-0.5 text-muted-foreground">Cerrado</div>
                  )}
                  {PUESTOS.slice(0, personas).map((puesto) => {
                    const clave = claveTurno(fecha, turno, puesto);
                    const t = porClave.get(clave);
                    const aviso = conflictos?.get(clave);
                    const clase = cn(
                      "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left",
                      puesto === "clp" ? "bg-muted/60" : "bg-primary/10",
                      aviso && "ring-1 ring-warning-text",
                    );
                    const contenido = (
                      <>
                        <span className="truncate">{t ? nombreCorto(t.colaborador) : "—"}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                          {personas === 1 ? TODAS_LAS_MONEDAS : ETIQUETA_PUESTO[puesto]}
                        </span>
                        {t?.editadoManual && (
                          <Pencil className="size-3 shrink-0 text-muted-foreground" aria-label="Editado a mano" />
                        )}
                        {aviso && <AlertTriangle className="size-3 shrink-0 text-warning-text" aria-label={aviso} />}
                      </>
                    );
                    return onEditar && t ? (
                      <button
                        key={puesto}
                        type="button"
                        title={aviso}
                        className={cn(clase, "hover:bg-accent")}
                        onClick={() =>
                          onEditar({ fecha, turno, puesto, colaborador: t.colaborador, todasLasMonedas: personas === 1 })
                        }
                      >
                        {contenido}
                      </button>
                    ) : (
                      <div key={puesto} title={aviso} className={clase}>
                        {contenido}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Pie del calendario: horario de cada turno, días especiales y ausencias del mes, como en el Excel. */
export function PieHorario({
  ausencias,
  especiales = [],
}: {
  ausencias: { colaborador: string; tipo: string; inicio: string; retorno: string }[];
  especiales?: DiaEspecial[];
}) {
  return (
    <div className={cn(cardClass, "grid gap-4 text-sm sm:grid-cols-2", especiales.length > 0 && "lg:grid-cols-3")}>
      <div>
        <div className="mb-1 font-semibold">Horario</div>
        {TURNOS.map((t) => (
          <div key={t}>
            {ETIQUETA_TURNO[t]}: {HORA_TURNO[t]}
          </div>
        ))}
      </div>
      {especiales.length > 0 && (
        <div>
          <div className="mb-1 font-semibold">Días especiales</div>
          {especiales.map((e) => (
            <div key={e.fecha}>
              {fechaCorta(e.fecha)}
              {e.nota && ` · ${e.nota}`} — Mañana: {describirTurnoEspecial(e, "manana")} · Tarde:{" "}
              {describirTurnoEspecial(e, "tarde")}
            </div>
          ))}
        </div>
      )}
      <div>
        <div className="mb-1 font-semibold">Ausencias del mes</div>
        {ausencias.length === 0 && <div className="text-muted-foreground">Ninguna</div>}
        {ausencias.map((a, i) => (
          <div key={`${a.colaborador}-${a.inicio}-${i}`}>
            {nombreCorto(a.colaborador)} · {a.tipo} · del {fechaCorta(a.inicio)}, vuelve el {fechaCorta(a.retorno)}
          </div>
        ))}
      </div>
    </div>
  );
}
