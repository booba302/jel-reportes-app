"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { parseUserRole } from "@/lib/roles";
import { veGrupo } from "@/lib/evaluacion";
import { construirExpediente, type ResultadoExpediente } from "@/lib/expediente";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreadcrumb } from "@/components/BreadcrumbContext";
import { toMesStr } from "@/components/reportes/fechas";
import { idCierre } from "@/components/cierre/useCierreMes";
import { cargadorCliente } from "@/components/expediente/cargadorCliente";
import {
  AvisoExpediente,
  Expediente,
  nombreMesCap,
} from "@/components/expediente/Expediente";

function ExpedienteSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-[72px] rounded-xl" />
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[118px] rounded-xl" />
        ))}
      </div>
      <div className="flex flex-wrap gap-3.5">
        <Skeleton className="h-[330px] min-w-0 flex-[1.3_1_460px] rounded-xl" />
        <Skeleton className="h-[330px] min-w-0 flex-[1_1_340px] rounded-xl" />
      </div>
      <Skeleton className="h-[260px] rounded-xl" />
    </div>
  );
}

function ExpedienteContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { userData } = useAuth();
  const rol = useMemo(() => parseUserRole(userData?.rol), [userData?.rol]);

  const operador = decodeURIComponent(String(params.operador ?? ""));
  const [mesActual] = useState(() => toMesStr(new Date()));
  const mesParam = searchParams.get("mes");
  const mes =
    mesParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam) && mesParam <= mesActual
      ? mesParam
      : mesActual;

  useBreadcrumb(["Cierre mensual", nombreMesCap(mes), operador]);

  const key = `${operador}|${mes}|${rol.isAdmin}|${rol.grupoUsuario}`;
  const [resultado, setResultado] = useState<
    { key: string; data: ResultadoExpediente } | { key: string; error: true } | null
  >(null);

  useEffect(() => {
    if (!userData || !operador) return;
    let cancelado = false;
    construirExpediente(cargadorCliente, {
      operador,
      mes,
      alcance: {
        modo: "interno",
        idCierre: (m) => idCierre(m, rol),
        incluye: (g) => veGrupo(rol, g),
      },
    })
      .then((data) => !cancelado && setResultado({ key, data }))
      .catch((err) => {
        console.error("Error cargando el expediente:", err);
        if (!cancelado) setResultado({ key, error: true });
      });
    return () => {
      cancelado = true;
    };
  }, [key, userData, operador, mes, rol]);

  const vigente = resultado?.key === key ? resultado : null;
  let contenido: React.ReactNode = <ExpedienteSkeleton />;
  if (vigente && "error" in vigente) {
    contenido = (
      <AvisoExpediente
        titulo="No se pudo cargar el expediente"
        texto="Hubo un problema al consultar los datos. Inténtalo de nuevo."
      />
    );
  } else if (vigente) {
    const r = vigente.data;
    contenido =
      r.estado === "ok" ? (
        <Expediente modo="interno" data={r} usuario={userData?.nombre} />
      ) : r.estado === "excluido" ? (
        <AvisoExpediente
          titulo="Operador excluido"
          texto={`${operador} está excluido de la evaluación; su expediente no se genera.`}
        />
      ) : (
        <AvisoExpediente
          titulo="Sin evaluaciones"
          texto={`${operador} no tiene evaluaciones diarias en ${nombreMesCap(mes).toLowerCase()}.`}
        />
      );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-9 pt-5 md:px-7">
      {contenido}
    </div>
  );
}

export default function ExpedienteOperadorPage() {
  return (
    <Suspense>
      <ExpedienteContent />
    </Suspense>
  );
}
