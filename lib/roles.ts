export interface ParsedRole {
  isAdmin: boolean;
  isInter: boolean;
  esNacional: boolean;
  grupoUsuario: "inter" | "nacional";
}

export function parseUserRole(rawRole?: string): ParsedRole {
  const userRole = rawRole?.toLowerCase().trim() || "";
  const isAdmin = userRole.includes("admin") || userRole.includes("administrador");
  // Evaluate "internacional"/"inter" before "nacional" to avoid false positives
  const isInter = userRole.includes("internacional") || userRole.includes("inter");
  const esNacional = !isInter && userRole.includes("nacional");
  const grupoUsuario: "inter" | "nacional" = isInter ? "inter" : "nacional";
  return { isAdmin, isInter, esNacional, grupoUsuario };
}

export function getMonedasByRol(rawRole?: string): string[] {
  const { isInter, esNacional } = parseUserRole(rawRole);
  if (isInter) return ["CLP", "PEN", "USD", "MXN"];
  if (esNacional) return ["VES"];
  return ["CLP", "PEN", "USD", "MXN", "VES"];
}

/** Catálogo único de roles para la UI y la API (§22.3). */
export const ROLES = {
  admin: {
    label: "Administrador",
    monedas: "Todas las vistas",
    desc: "Acceso total: monitor regional, gestión de usuarios, cierre de cualquier grupo.",
  },
  agente_retiros_internacional: {
    label: "Agente internacional",
    monedas: "CLP · PEN · MXN · USD",
    desc: "Reportes, evaluación, auditoría y cierre del grupo internacional.",
  },
  agente_retiros_nacional: {
    label: "Agente nacional",
    monedas: "VES",
    desc: "Reportes, evaluación, auditoría y cierre del grupo nacional.",
  },
} as const;

export type Rol = keyof typeof ROLES;

export const esRolValido = (r: unknown): r is Rol =>
  typeof r === "string" && Object.prototype.hasOwnProperty.call(ROLES, r);

/** Etiqueta del rol; si el documento trae un rol viejo o desconocido, se muestra tal cual. */
export const etiquetaRol = (r: string) => (esRolValido(r) ? ROLES[r].label : r || "Sin rol");
