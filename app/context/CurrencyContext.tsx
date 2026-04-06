// src/app/context/CurrencyContext.tsx
"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

// Agregamos VES a los tipos permitidos
type Currency = "CLP" | "PEN" | "USD" | "MXN" | "VES";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined,
);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  // El valor por defecto inicial, luego el TopBar lo ajusta si es necesario
  const [currency, setCurrency] = useState<Currency>("CLP");

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency debe usarse dentro de un CurrencyProvider");
  }
  return context;
}
