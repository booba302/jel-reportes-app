# Dashboard: Rango de fechas personalizado

## Contexto

El dashboard inicial (`app/(dashboard)/page.tsx`) tiene un `Select` con 4 rangos
fijos: Mes Actual, Mes Anterior, Últimos 3 Meses, Histórico Completo. Se
necesita poder elegir un rango de fechas arbitrario (por ejemplo, una semana
específica) para analizar métricas fuera de esos rangos predefinidos.

## Objetivo

Agregar una 5ª opción "Rango Personalizado" al selector existente. Al
elegirla, el usuario escoge una fecha de inicio y una de fin mediante un
calendario (modo rango), y el dashboard recalcula KPIs, gráficos y tabla de
agentes para ese rango, comparándolo contra el período inmediatamente
anterior de igual duración (igual criterio que las demás opciones).

## Diseño

### Estado

- Se agrega al componente `DashboardPage`:
  ```ts
  const [customRange, setCustomRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  ```
- `dateFilter` admite un nuevo valor: `"custom"`.

### UI — Cabecera de filtros

- El `Select` existente gana un `SelectItem` adicional:
  ```tsx
  <SelectItem value="custom">Rango Personalizado</SelectItem>
  ```
- Cuando `dateFilter === "custom"`, se renderiza junto al `Select` un botón
  con `Popover` + `Calendar` (mismo patrón ya usado en
  `app/(dashboard)/evaluacion-diaria/page.tsx`):
  - Ícono `CalendarIcon` (lucide-react) + texto.
  - Texto del botón:
    - Sin selección completa: `"Selecciona un rango"`.
    - Con `from` y `to` definidos: `"{from: dd MMM} – {to: dd MMM yyyy}"`
      (usando `date-fns` `format` con `locale: es`, igual que el resto del
      proyecto).
  - `PopoverContent` contiene `<Calendar mode="range" selected={customRange}
    onSelect={setCustomRange} locale={es} numberOfMonths={2} />`.
  - `numberOfMonths={2}` para facilitar elegir rangos que crucen el límite de
    mes (p. ej. una semana a caballo entre dos meses) sin tener que navegar.

### Lógica de fechas (`useEffect` de carga de datos)

En el bloque "1. Lógica de Fechas" de `fetchDashboardData`, se agrega una
rama nueva junto a las tres existentes (`current_month`, `last_month`,
`last_3_months`):

```ts
} else if (dateFilter === "custom" && customRange.from && customRange.to) {
  currStart = customRange.from;
  currEnd = new Date(
    customRange.to.getFullYear(),
    customRange.to.getMonth(),
    customRange.to.getDate(),
    23, 59, 59
  );
  const durationMs = currEnd.getTime() - currStart.getTime();
  prevEnd = new Date(currStart.getTime() - 1000); // 1s antes del inicio actual
  prevStart = new Date(prevEnd.getTime() - durationMs);
}
```

- Si `dateFilter === "custom"` pero `customRange.from`/`to` no están ambos
  definidos, el resto del fetch se omite (early return dentro del `try`,
  antes de la consulta a Firestore) y se limpia el estado (`setMetrics(null)`,
  `setIsLoading(false)`), de modo que se muestre el mismo estado vacío que
  ya existe para "sin datos en el rango".
- El resto del pipeline (consulta a `operaciones_retiros`, agregación en
  memoria, cálculo de métricas/tendencias, datasets para gráficos) no
  cambia: ya opera genéricamente sobre `currStart/currEnd/prevStart/prevEnd`
  y `currStartStr/currEndStr/prevStartStr/prevEndStr`.

### Dependencias del `useEffect`

Se agrega `customRange.from` y `customRange.to` al arreglo de dependencias
(junto a `currency` y `dateFilter`), para que el dashboard recalcule en
cuanto el usuario completa la selección del rango.

### Tendencias (`renderTrend`)

Sin cambios en la función: ya retorna `null` solo cuando
`dateFilter === "all_time"`. Para `"custom"` se mostrará la píldora de
tendencia comparando contra el período anterior equivalente, como se definió
arriba.

### Fuera de alcance

- No se valida ni limita la duración máxima del rango elegido.
- No se deshabilitan fechas futuras en el calendario (igual que el resto de
  selectores de fecha del proyecto, que tampoco lo hacen).
- No hay cambios en endpoints de API ni en reglas de Firestore: todo el
  filtrado ocurre en memoria sobre el snapshot ya cargado de
  `operaciones_retiros`, igual que las demás opciones del selector.
