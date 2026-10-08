"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Ctx = {
  override: string[] | null;
  setOverride: (items: string[] | null) => void;
};

const BreadcrumbContext = createContext<Ctx>({ override: null, setOverride: () => {} });

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<string[] | null>(null);
  return (
    <BreadcrumbContext.Provider value={{ override, setOverride }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export const useBreadcrumbOverride = () => useContext(BreadcrumbContext).override;

/** Define la ruta del header mientras la página está montada. */
export function useBreadcrumb(items: string[] | null) {
  const { setOverride } = useContext(BreadcrumbContext);
  const clave = items ? items.join("\u0000") : "";
  useEffect(() => {
    setOverride(clave ? clave.split("\u0000") : null);
    return () => setOverride(null);
  }, [clave, setOverride]);
}
