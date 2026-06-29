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
