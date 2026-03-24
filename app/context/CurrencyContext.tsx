// src/context/CurrencyContext.tsx
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type Currency = 'CLP' | 'PEN' | 'USD' | 'MXN';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('CLP'); // CLP por defecto

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency debe usarse dentro de un CurrencyProvider');
  }
  return context;
}