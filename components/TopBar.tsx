// src/components/TopBar.tsx
'use client';

import { useCurrency } from '@/app/context/CurrencyContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Activity } from 'lucide-react';

export function TopBar() {
  const { currency, setCurrency } = useCurrency();

  return (
    <header className="w-full border-b bg-white p-4 shadow-sm flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <div className="bg-primary p-2 rounded-md">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <h1 className="font-bold text-xl text-slate-800">Métricas Operativas</h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 font-medium">Moneda Activa:</span>
        <Select 
          value={currency} 
          onValueChange={(value) => setCurrency(value as 'CLP' | 'PEN' | 'USD' | 'MXN')}
          justify-end
        >
          <SelectTrigger className="w-[120px] font-bold">
            <SelectValue placeholder="Moneda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CLP">CLP (Chile)</SelectItem>
            <SelectItem value="PEN">PEN (Perú)</SelectItem>
            <SelectItem value="USD">USD (Dólar)</SelectItem>
            <SelectItem value="MXN">MXN (México)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}