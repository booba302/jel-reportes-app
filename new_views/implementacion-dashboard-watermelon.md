# Implementación: Layout, Dashboard "Visión de rendimiento", Login, Reportes, Auditoría, Evaluación diaria, Cierre mensual, Expediente del operador, Monitor regional y Gestión de usuarios (estilo Watermelon / Capitalio)

> **Repositorio:** `booba302/jel-reportes-app` (Next.js 16.2 · React 19 · Tailwind v4 · shadcn `radix-nova` · Recharts 3 · Firebase)
> **Referencia visual:** canvas "PayoutMetrics — Rediseño Watermelon" (artboard *Layout + Dashboard*).
> **Alcance:** `components/MainLayout.tsx`, `components/Sidebar.tsx`, `app/(dashboard)/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/context/CurrencyContext.tsx`, `app/(auth)/login/page.tsx`, `app/(dashboard)/reportes/page.tsx`, `app/(dashboard)/auditoria-diaria/page.tsx`, `app/(dashboard)/evaluacion-diaria/page.tsx`, `app/(dashboard)/cierre-mensual/page.tsx`, `app/(dashboard)/expediente/[operador]/page.tsx`, `app/evaluacion-operador/[id]/page.tsx`, `app/(dashboard)/monitor-regional/page.tsx`, `lib/monitor.ts`, `app/(dashboard)/gestor-usuarios/page.tsx`, `app/cambiar-credenciales/page.tsx`, `app/api/usuarios/*`, `lib/authServer.ts`, `lib/apiFetch.ts`, `firestore.rules`, `lib/evaluacion.ts`, `lib/cierre.ts`, `next.config.ts` y componentes nuevos en `components/dashboard/`, `components/login/`, `components/reportes/`, `components/auditoria/`, `components/evaluacion/`, `components/cierre/`, `components/expediente/`, `components/monitor/` y `components/usuarios/`.

Este documento describe todo lo necesario para llevar el mockup aprobado al código: dependencias, tokens de color (modo oscuro y claro), fuentes, estructura de componentes, cálculos con los datos de Firestore, estados de carga y comportamiento de cada control.

---

## Decisiones tomadas

| # | Tema | Decisión |
|---|---|---|
| 1 | Watermelon | **No** se instala el dashboard completo (ni nada de su registro). Solo es referencia visual; todo se construye con shadcn + Recharts 3. |
| 2 | Solo VIP | Filtra **toda** la vista: KPIs, tendencias, gráfico, tabla y distribución. Con el switch encendido no aparece Estándar en ningún bloque. |
| 3 | Formato numérico | **`es-CL`** (el actual): `4.412`, `18,4`, `$412,8M`, `94,2%`, `+1,8 pts`. |
| 4 | Metas | SLA **90%**. Tiempo promedio **25 min** para todos, también con Solo VIP. |
| 5 | Tema | Sigue al **sistema operativo** por defecto; el botón sol/luna lo cambia y se recuerda. |
| 6 | Login | Opción **C — Producto de fondo**, con variantes clara, oscura y móvil (ver §15). |
| 7 | Reportes | "Cargar reportes" y "Gestor de reportes" se unen en **una sola vista con calendario** (`/reportes`, ver §16). Sin campo "Origen"; el SLA del día se muestra **sin Autopago ni exonerados**. |
| 8 | SLA y tiempo | En **todas** las vistas, el SLA y el tiempo promedio excluyen **Autopago** y **exonerados** (regla de la auditoría actual). |
| 9 | Auditoría | Una sola tabla con pestañas y panel de filtros; **se mantiene el modal de exoneración actual** (4 motivos con switches) con el nuevo estilo (ver §17). |
| 10 | Evaluación | Lista + ficha por operador; **cualquier usuario puede reabrir**; **excluidos editables a mano** (sin necesidad de usuario en el sistema); evolución 7/30 días, aviso de pendientes y PDF (ver §18). |
| 11 | Cierre mensual | Ranking y métricas visibles antes de cerrar (preliminar); SLA y tiempo **exactos**; excluidos desde la lista editable; **reabrir solo admin o quien cerró**, con motivo e historial (ver §19). |
| 12 | Expediente | 5 KPIs contra mes anterior y equipo; desglose que suma exacto la nota; SLA por moneda; nota diaria; observaciones. **Dos modos:** `interno` (dentro del sistema) y `publico` (el enlace que recibe el operador: solo datos, sin sidebar ni header, **sin puesto, flechas, Copiar enlace ni columna Auditoría**) (ver §20). |
| 13 | Monitor regional | SLA y tiempo **sin Autopago** (hoy lo incluye); estado por moneda con SLA **y** tiempo; tarjeta por moneda, mapa de calor diario, brechas por hora con franja crítica, días críticos y tabla comparativa; mes en curso comparado contra los mismos días (ver §21). |
| 14 | Usuarios y seguridad | **Todas las rutas `/api/*` validan token y rol en el servidor** (hoy no validan nada); contraseña temporal generada en el servidor y con vencimiento de 72 h; revocar sesiones al desactivar o restablecer; editar nombre y rol; nunca desactivarse a uno mismo ni dejar el sistema sin admin; registro de cambios; primer ingreso con el estilo del login (ver §22). |

---

## Índice

1. [Resumen de cambios](#1-resumen-de-cambios)
2. [Dependencias y componentes shadcn](#2-dependencias-y-componentes-shadcn)
3. [Fuentes](#3-fuentes)
4. [Tema oscuro / claro y tokens de color](#4-tema-oscuro--claro-y-tokens-de-color)
5. [Layout: Sidebar y Header](#5-layout-sidebar-y-header)
6. [Estructura de la página del Dashboard](#6-estructura-de-la-página-del-dashboard)
7. [Modelo de datos y cálculos](#7-modelo-de-datos-y-cálculos)
8. [Componentes del Dashboard (detalle visual + código)](#8-componentes-del-dashboard)
9. [Selector de período y rango personalizado](#9-selector-de-período-y-rango-personalizado)
10. [Estados: sin período, cargando, sin datos](#10-estados-sin-período-cargando-sin-datos)
11. [Formato de números y textos](#11-formato-de-números-y-textos)
12. [Responsive y accesibilidad](#12-responsive-y-accesibilidad)
13. [Constantes y metas](#13-constantes-y-metas)
14. [Checklist de verificación](#14-checklist-de-verificación)
15. [Login (opción C)](#15-login-opción-c-producto-de-fondo)
16. [Reportes (cargar + gestor)](#16-reportes-une-cargar-reportes-y-gestor-de-reportes)
17. [Auditoría diaria](#17-auditoría-diaria)
18. [Evaluación diaria](#18-evaluación-diaria)
19. [Cierre mensual](#19-cierre-mensual)
20. [Expediente del operador](#20-expediente-del-operador)
21. [Monitor regional](#21-monitor-regional)
22. [Gestión de usuarios y primer ingreso](#22-gestión-de-usuarios-y-primer-ingreso)

---

## 1. Resumen de cambios

| Área | Hoy | Nuevo |
|---|---|---|
| Tema | Solo claro, sidebar `slate-900` fijo | Oscuro por defecto + claro, alternables con un botón (sol/luna) en el header |
| Fuente | Inter | **Geist** (texto) + **Geist Mono** (ejes, monedas, cifras de tablas) |
| Sidebar | Oscuro, grupos colapsables, íconos de colores, logo en recuadro | Fondo `--sidebar`, ítem **Inicio** nuevo, etiquetas de grupo simples, íconos monocromo, badge "Admin", logo sin recuadro y sin subtítulo |
| Header | Selector de moneda tipo `<Select>` | Breadcrumb + **segmented control** de monedas + botón de tema |
| Filtros | `<Select>` + switch "Solo VIP" casero | `<Select>` shadcn con ícono + botón de rango con `<Calendar>` de 2 meses + `<Switch>` "Solo VIP" |
| KPIs | 4 cards iguales | **Card grande de SLA** (anillo + cumplidos/incumplidos/exonerados) a la izquierda y **3 cards** (Tiempo, Monto, Automatización) a la derecha |
| Gráficos | Área de volumen + dona de niveles | **Gráfico combinado**: barras de retiros por día + línea de SLA diario con zona bajo meta en rojo |
| Niveles VIP | Dona "Distribución por Nivel VIP" | **"Distribución por usuarios VIP"**: barra apilada + lista |
| Tabla equipo | Agente / Retiros / SLA | Operador / Retiros / **Brechas** / **Tiempo prom.** / SLA (barra + badge), **ordenada por brechas** |
| Estados | Caja punteada con texto / spinner | **Skeleton** con la forma real de la página + pastilla de mensaje |
| Exportar | — | No se incluye |

---

## 2. Dependencias y componentes shadcn

### 2.1 Ya instalados (no tocar)

`next-themes@^0.4.6`, `recharts@^3.8.1`, `react-day-picker@^9`, `date-fns@^4`, `lucide-react`, `radix-ui`, `class-variance-authority`, `tw-animate-css`.

Componentes existentes en `components/ui/`: `button`, `card`, `select`, `popover`, `calendar`, `table`, `alert-dialog`, `label`, `input`, `sonner`.

### 2.2 Agregar con el CLI de shadcn

```bash
npx shadcn@latest add skeleton switch toggle-group badge separator tooltip
```

| Componente | Uso |
|---|---|
| `skeleton` | Estados sin período / cargando |
| `switch` | "Solo VIP" (reemplaza el switch hecho a mano con `peer`) |
| `toggle-group` | Selector de moneda segmentado |
| `badge` | Etiqueta "Admin" del sidebar y badges de SLA |
| `separator` | Divisiones en card SLA y sidebar |
| `tooltip` | Tooltips de puntos rojos en el gráfico e íconos |

### 2.3 Sobre Watermelon UI

El estilo se tomó del dashboard **Capitalio** de Watermelon (`https://registry.watermelon.sh/r/capitalio-dashboard.json`): superficies `bg-foreground/5`, ícono dentro de un cuadrito de 32px, filas de tabla en grid con la fila de títulos redondeada, colores de gráficos por variables CSS.

> ⚠️ **No instalar el dashboard completo de Watermelon en este repo.** Su registro declara `recharts@2.15.4` y `@base-ui/react`. El repo usa `recharts@^3.8.1` y `radix-ui`, y `shadcn add` podría bajar Recharts a la versión 2 y romper los gráficos de otras vistas. **Decisión tomada:** Watermelon se usa solo como **referencia visual**; no se instala nada desde su registro. Todo lo de este documento se construye con shadcn + Recharts 3.

---

## 3. Fuentes

Reemplazar Inter por Geist en `app/layout.tsx`:

```tsx
// app/layout.tsx
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./context/AuthContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { AutoLogoutGuard } from "@/components/AutoLogoutGuard";
import { Toaster } from "sonner";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = {
  title: "PayoutMetrics",
  description: "Plataforma corporativa de auditoría",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <CurrencyProvider>{children}</CurrencyProvider>
          </AuthProvider>
          <Toaster position="bottom-right" richColors />
          <AutoLogoutGuard />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

> Revisa la guía de fuentes en `node_modules/next/dist/docs/` como pide `AGENTS.md`; la API `next/font/google` con `variable` se mantiene en Next 16.

En `globals.css`, dentro de `@theme inline`:

```css
--font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
--font-mono: var(--font-geist-mono), ui-monospace, monospace;
--font-heading: var(--font-sans);
```

**Dónde va cada fuente**

| Elemento | Fuente | Peso / tamaño |
|---|---|---|
| Título de página | Geist | 700 · 26px · `tracking-tight` (-0.02em) |
| Subtítulo | Geist | 400 · 14px · `text-muted-foreground` |
| Título de card ("Tiempo promedio") | Geist | 500 · 14px |
| Valor grande de KPI | Geist | 700 · 28px (SLA: 38px) · `leading-none tracking-tight` |
| Pastilla de tendencia | Geist | 600 · 12px |
| Títulos de sección ("SLA y volumen diario") | Geist | 600 · 15px |
| Ejes, ticks, monedas del segmented, cifras de tabla, rangos de fechas | **Geist Mono** | 400–600 · 11–13px |

---

## 4. Tema oscuro / claro y tokens de color

### 4.1 Funcionamiento

- `next-themes` con `attribute="class"` pone `class="dark"` en `<html>`. `globals.css` ya tiene `@custom-variant dark (&:is(.dark *));`.
- Sin preferencia guardada, la app **sigue el tema del sistema operativo** (`defaultTheme="system"`) y cambia en vivo si el usuario cambia el tema del SO. El diseño de referencia es el oscuro.
- Si el usuario usa el botón sol/luna, esa elección se guarda en `localStorage` (`theme`) y pasa a tener prioridad sobre el SO.
- El botón del header alterna con `setTheme(resolvedTheme === "dark" ? "light" : "dark")`.
- **Nunca usar colores fijos** (`bg-slate-50`, `text-slate-800`, `#3b82f6`…) en los componentes nuevos: todo sale de tokens, para que los dos temas funcionen.

### 4.2 Reemplazar los bloques `:root` y `.dark` de `app/globals.css`

```css
:root {
  --radius: 0.75rem;              /* cards 12px; inputs/botones usan radius-md ≈ 8px */

  --background: #FAFAFA;
  --foreground: #171717;
  --card: #FFFFFF;
  --card-foreground: #171717;
  --popover: #FFFFFF;
  --popover-foreground: #171717;
  --primary: #171717;
  --primary-foreground: #FAFAFA;
  --secondary: #F2F2F2;
  --secondary-foreground: #171717;
  --muted: #F2F2F2;
  --muted-foreground: #666666;
  --accent: #F2F2F2;
  --accent-foreground: #171717;
  --destructive: #E11D48;
  --border: #E7E7E7;
  --input: #E2E2E2;
  --ring: #A3A3A3;

  --sidebar: #F5F5F5;
  --sidebar-foreground: #171717;
  --sidebar-primary: #171717;
  --sidebar-primary-foreground: #FAFAFA;
  --sidebar-accent: #FFFFFF;          /* fondo del ítem activo */
  --sidebar-accent-foreground: #171717;
  --sidebar-border: #E7E7E7;
  --sidebar-ring: #A3A3A3;

  /* --- tokens propios del dashboard --- */
  --brand: #0B4FC7;                   /* azul del logo */
  --brand-soft: #E8EEFB;
  --success: #16A34A;  --success-text: #15803D;  --success-soft: #E7F6EE;
  --warning: #D97706;  --warning-text: #8A4B00;  --warning-soft: #FDF3E1;
  --danger:  #E11D48;  --danger-text:  #BE123C;  --danger-soft:  #FCE9E6;
  --track: #EDEDED;                   /* fondo de anillo y barras de progreso */
  --chart-zone: rgba(225, 29, 72, 0.07);
  --chart-bar: rgba(23, 23, 23, 0.10);
  --chart-grid: rgba(23, 23, 23, 0.06);
  --segment-active: #FFFFFF;
  --skeleton: #ECECEC;
  --level-0: #D4D4D4;  /* Estándar */
  --level-1: #8DB4FF;  /* VIP 2 */
  --level-2: #2F6FE0;  /* VIP 3 */
  --level-3: #0B3E9C;  /* VIP 4 */
  --icon-green: #0E8A4C;  --icon-amber: #9A5B00;  --icon-blue: #0B4FC7;  --icon-violet: #5B3FC4;
}

.dark {
  --background: #09090B;
  --foreground: #EDEDEF;
  --card: #141416;
  --card-foreground: #EDEDEF;
  --popover: #141416;
  --popover-foreground: #EDEDEF;
  --primary: #EDEDEF;
  --primary-foreground: #09090B;
  --secondary: rgba(255, 255, 255, 0.05);
  --secondary-foreground: #EDEDEF;
  --muted: rgba(255, 255, 255, 0.05);
  --muted-foreground: #9B9BA3;
  --accent: rgba(255, 255, 255, 0.07);
  --accent-foreground: #EDEDEF;
  --destructive: #F43F5E;
  --border: rgba(255, 255, 255, 0.08);
  --input: rgba(255, 255, 255, 0.13);
  --ring: rgba(255, 255, 255, 0.25);

  --sidebar: #0F0F11;
  --sidebar-foreground: #EDEDEF;
  --sidebar-primary: #EDEDEF;
  --sidebar-primary-foreground: #09090B;
  --sidebar-accent: rgba(255, 255, 255, 0.07);
  --sidebar-accent-foreground: #EDEDEF;
  --sidebar-border: rgba(255, 255, 255, 0.08);
  --sidebar-ring: rgba(255, 255, 255, 0.25);

  --brand: #5B8DEF;
  --brand-soft: rgba(91, 141, 239, 0.16);
  --success: #22C55E;  --success-text: #4ADE80;  --success-soft: rgba(34, 197, 94, 0.14);
  --warning: #F59E0B;  --warning-text: #FBBF24;  --warning-soft: rgba(245, 158, 11, 0.14);
  --danger:  #F43F5E;  --danger-text:  #FB7185;  --danger-soft:  rgba(244, 63, 94, 0.14);
  --track: rgba(255, 255, 255, 0.08);
  --chart-zone: rgba(244, 63, 94, 0.10);
  --chart-bar: rgba(255, 255, 255, 0.13);
  --chart-grid: rgba(255, 255, 255, 0.06);
  --segment-active: #27272A;
  --skeleton: rgba(255, 255, 255, 0.07);
  --level-0: #55555C;
  --level-1: #9CBDFF;
  --level-2: #5B8DEF;
  --level-3: #2A5FD0;
  --icon-green: #4ADE80;  --icon-amber: #FBBF24;  --icon-blue: #7AA5F5;  --icon-violet: #A78BFA;
}
```

Y exponerlos a Tailwind dentro de `@theme inline` (además de los que ya existen):

```css
--color-brand: var(--brand);
--color-brand-soft: var(--brand-soft);
--color-success: var(--success);
--color-success-text: var(--success-text);
--color-success-soft: var(--success-soft);
--color-warning: var(--warning);
--color-warning-text: var(--warning-text);
--color-warning-soft: var(--warning-soft);
--color-danger: var(--danger);
--color-danger-text: var(--danger-text);
--color-danger-soft: var(--danger-soft);
--color-track: var(--track);
--color-chart-zone: var(--chart-zone);
--color-chart-bar: var(--chart-bar);
--color-chart-grid: var(--chart-grid);
--color-segment-active: var(--segment-active);
--color-skeleton: var(--skeleton);
--color-level-0: var(--level-0);
--color-level-1: var(--level-1);
--color-level-2: var(--level-2);
--color-level-3: var(--level-3);
--color-icon-green: var(--icon-green);
--color-icon-amber: var(--icon-amber);
--color-icon-blue: var(--icon-blue);
--color-icon-violet: var(--icon-violet);
```

Así se puede escribir `bg-success-soft text-success-text`, `bg-level-2`, `text-icon-amber`, etc.

Y para que el Select y el Calendar nativos usen controles oscuros:

```css
@layer base {
  :root { color-scheme: light; }
  .dark { color-scheme: dark; }
}
```

### 4.3 Componente `ThemeToggle`

```tsx
// components/ThemeToggle.tsx
"use client";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = !mounted || resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="flex size-[38px] items-center justify-center rounded-[9px] border border-border bg-muted text-foreground transition-colors hover:bg-accent"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
```

---

## 5. Layout: Sidebar y Header

> `app/(dashboard)/layout.tsx` usa `MainLayout`. `components/DashboardLayout.tsx` no se usa en ninguna ruta: se puede eliminar o dejar, pero **no** se modifica.

### 5.1 Contenedor (`MainLayout.tsx`)

```tsx
<div className="min-h-screen bg-background text-foreground">
  <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />
  <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
    <AppHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />
    <main className="flex flex-1 flex-col">
      <div className="flex-1">{children}</div>
      <footer className="py-4 text-center text-xs text-muted-foreground print:hidden">
        Desarrollado para JuegaEnLinea · v1.0 © 2026
      </footer>
    </main>
  </div>
</div>
```

### 5.2 Sidebar (`Sidebar.tsx`)

**Medidas:** ancho `248px` (`w-[248px]`), `fixed inset-y-0 left-0`, `bg-sidebar border-r border-sidebar-border`, `px-3 py-4`, `flex flex-col gap-5`. En móvil se mantiene el comportamiento actual (translate + overlay `bg-black/50 backdrop-blur-sm`).

**Logo** (sin recuadro ni subtítulo):

```tsx
<Link href="/" className="flex items-center gap-2.5 px-2 py-1.5">
  <img src="/logo.png" alt="" className="h-auto w-8" />
  <span className="text-base font-bold tracking-tight">PayoutMetrics</span>
</Link>
```

- Sin `bg-*`: el PNG es transparente y toma el fondo del sidebar en los dos temas.
- Se quita el texto "Retiros Internacionales" porque el sistema también lo usan los equipos nacionales.

**Navegación.** Se agrega **Inicio** (`/`) arriba de todo, sin grupo. Los grupos ya no se colapsan: solo llevan una etiqueta.

```ts
const menuGroups = [
  { id: "inicio", title: null, items: [{ label: "Inicio", icon: Home, href: "/" }] },
  { id: "operaciones", title: "Gestión operativa", items: [
      { label: "Reportes", icon: CalendarCheck, href: "/reportes" },        // une cargar + gestor (§16)
      { label: "Evaluación diaria", icon: SquareCheck, href: "/evaluacion-diaria" },
  ]},
  { id: "analitica", title: "Analítica y desempeño", items: [
      { label: "Auditoría diaria", icon: Activity, href: "/auditoria-diaria" },
      { label: "Monitor regional", icon: Globe, href: "/monitor-regional", requireAdmin: true },
      { label: "Cierre mensual", icon: Trophy, href: "/cierre-mensual" },
  ]},
  { id: "admin", title: "Administración", items: [
      { label: "Gestión de usuarios", icon: Users, href: "/gestor-usuarios", requireAdmin: true },
  ]},
];
```

Mantener intacta la lógica `hasAccess` (roles / `requireAdmin`).

| Elemento | Clases |
|---|---|
| Etiqueta de grupo | `px-2.5 pb-1.5 text-xs font-medium text-muted-foreground` |
| Ítem | `flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground` |
| Ítem activo | `bg-sidebar-accent text-foreground font-semibold shadow-[0_0_0_1px_var(--border)]` + `aria-current="page"` |
| Ícono | `size-4`, **monocromo** (hereda `currentColor`; se quitan `text-blue-400`, etc.) |
| Badge Admin (en ítems `requireAdmin`) | `ml-auto rounded-md border border-input px-1.5 text-[11px] font-medium text-muted-foreground` → texto "Admin" |
| Separación entre grupos | `gap-[18px]` en el `<nav>` |

**Tarjeta de usuario (abajo):**

```tsx
<div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-card p-2.5">
  <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand">
    {iniciales(userData?.nombre)}
  </span>
  <span className="flex min-w-0 flex-1 flex-col leading-tight">
    <span className="truncate text-[13px] font-semibold">{userData?.nombre ?? "Cargando..."}</span>
    <span className="truncate text-xs text-muted-foreground capitalize">{userData?.rol ?? "Usuario"}</span>
  </span>
  {/* Botón de cerrar sesión: mantener el AlertDialog actual, con este trigger */}
  <button aria-label="Cerrar sesión" className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-danger-text">
    <LogOut className="size-4" />
  </button>
</div>
```

`iniciales("Franklin Rivas") → "FR"` (primeras letras de las dos primeras palabras, en mayúsculas).

### 5.3 Header (`AppHeader`, dentro de `MainLayout.tsx`)

```
[☰ móvil]  Analítica / Visión de rendimiento            [PEN|CLP|MXN|USD|VES|GLOBAL]  [☀/☾]
```

- Contenedor: `sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-sidebar px-4 py-3 md:px-7 print:hidden`.
- **Breadcrumb:** `text-[13px] text-muted-foreground`; el último tramo va en `text-foreground font-medium`. Para el dashboard: "Analítica / Visión de rendimiento". Cada página puede pasar su propio breadcrumb (prop o un mapa por `pathname`).
- **Selector de moneda:** `ToggleGroup` de shadcn (`type="single"`) con las monedas que ya calcula `CurrencySelector` (`monedasPermitidas`, sin cambiar esa lógica):

```tsx
<ToggleGroup
  type="single"
  value={currency}
  onValueChange={(v) => v && setCurrency(v as Currency)}
  aria-label="Moneda"
  className="rounded-[9px] border border-border bg-muted p-[3px] gap-0.5"
>
  {monedasPermitidas.map((m) => (
    <ToggleGroupItem
      key={m}
      value={m}
      className="h-[30px] min-w-12 rounded-[7px] px-2.5 font-mono text-xs font-semibold text-muted-foreground
                 hover:text-foreground data-[state=on]:bg-segment-active data-[state=on]:text-foreground
                 data-[state=on]:shadow-[0_1px_2px_rgba(0,0,0,.18),0_0_0_1px_var(--input)]"
    >
      {m}
    </ToggleGroupItem>
  ))}
</ToggleGroup>
```

- **Botón de tema:** `<ThemeToggle />` a la derecha del selector.

### 5.4 `CurrencyContext`: agregar `GLOBAL` al tipo

Hoy el código hace `(currency as string) === "GLOBAL"`. Conviene tiparlo bien:

```ts
export type Currency = "CLP" | "PEN" | "USD" | "MXN" | "VES" | "GLOBAL";
```

---

## 6. Estructura de la página del Dashboard

```
app/(dashboard)/page.tsx                    ← orquesta estado, filtros y layout
components/dashboard/
  useDashboardData.ts                       ← fetch + todos los cálculos (sección 7)
  PeriodFilter.tsx                          ← Select de período + botón/calendario de rango
  SlaCard.tsx                               ← card grande con anillo
  KpiCard.tsx                               ← card chica reutilizable (Tiempo / Monto / Automatización)
  TrendPill.tsx                             ← pastilla de variación
  DailySlaVolumeChart.tsx                   ← gráfico combinado
  TeamPerformanceTable.tsx                  ← tabla del equipo
  VipDistributionCard.tsx                   ← distribución por usuarios VIP
  DashboardSkeleton.tsx                     ← skeleton + pastilla de mensaje
lib/format.ts                               ← formateadores (sección 11)
```

**Layout de la página:**

```tsx
<div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
  {/* Encabezado */}
  <div className="flex flex-wrap items-end justify-between gap-3.5">
    <div className="flex flex-col gap-0.5">
      <h1 className="text-[26px] font-bold leading-tight tracking-tight">{titulo}</h1>
      <p className="text-muted-foreground">{subtitulo}</p>
    </div>
    <div className="flex flex-wrap items-center gap-2.5">
      <PeriodFilter … />
      <VipSwitch … />
    </div>
  </div>

  {estado === "listo" ? (
    <>
      {/* Fila 1 */}
      <div className="flex flex-wrap items-stretch gap-3.5">
        <SlaCard className="flex-[1_1_300px]" … />
        <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-3.5">
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
            <KpiCard tipo="tiempo" … />
            <KpiCard tipo="monto" … />
            <KpiCard tipo="automatizacion" … />
          </div>
          <DailySlaVolumeChart className="flex-1" … />
        </div>
      </div>
      {/* Fila 2 */}
      <div className="flex flex-wrap items-stretch gap-3.5">
        <TeamPerformanceTable className="min-w-0 flex-[2_1_560px]" … />
        <VipDistributionCard className="min-w-0 flex-[1_1_300px]" … />
      </div>
    </>
  ) : (
    <DashboardSkeleton estado={estado} mensaje={mensaje} />
  )}
</div>
```

- **Título:** "Visión de rendimiento" (o "Visión global" cuando la moneda es `GLOBAL`).
- **Subtítulo:** `{etiquetaPeriodo} · moneda {CLP}` (o `· todas las monedas`), y se agrega `· solo VIP` si el switch está activo. Sin período: `Sin período seleccionado · moneda CLP`.
  - `current_month` → "Octubre 2026" (mes real con `format(date, "LLLL yyyy", { locale: es })`, primera letra en mayúscula)
  - `last_month` → "Septiembre 2026"
  - `last_3_months` → "Agosto – Octubre 2026"
  - `all_time` → "Histórico completo"
  - `custom` → "06 oct – 15 oct 2026"

**Estilo base de toda card:** `rounded-xl border border-border bg-card p-[18px]` (12px de radio, sin sombra). Usa el `Card` de shadcn con estas clases o un `div` simple.

---

## 7. Modelo de datos y cálculos

### 7.1 Fuente

Colección Firestore **`operaciones_retiros`**. La consulta actual se mantiene (por `Moneda`, o toda la colección si es `GLOBAL`). Campos que se usan:

| Campo | Tipo | Uso |
|---|---|---|
| `Fecha del reporte` | string ISO | Día del retiro → `split("T")[0]` (YYYY-MM-DD) |
| `Moneda` | string | Filtro |
| `Cumple` | boolean | `true` = resuelto bajo 25 min (cumple SLA) |
| `Tiempo` | number (min) | Tiempo de resolución |
| `Cantidad` | number (centavos) | Monto → `/ 100` |
| `Operador` | string | `"Autopago"` = automático; otro = operador humano |
| `Nivel` | string | `"Nivel 2" \| "Nivel 3" \| "Nivel 4"` = VIP; otro o vacío = Estándar |
| `comentarioBrecha` | string | Si no está vacío, el retiro está **exonerado** (`isExonerated` en `lib/utils.ts`) |

### 7.2 Definiciones (todas sobre el período filtrado)

Sea `R` el conjunto de retiros del período (si "Solo VIP" está activo, `R` = solo retiros VIP; ver 7.5).

| Concepto | Fórmula |
|---|---|
| `total` | `|R|` |
| `manuales` | retiros con `Operador !== "Autopago"` |
| `exonerados` | manuales con `isExonerated(comentarioBrecha)` |
| `evaluables` | `manuales − exonerados` → **sin Autopago y sin exonerados** |
| `cumplidos` | evaluables con `Cumple === true` |
| `incumplidos` (= **brechas**) | evaluables con `Cumple !== true` |
| **SLA %** | `cumplidos / evaluables × 100` (0 si no hay evaluables) |
| **Tiempo promedio** | `Σ Tiempo (evaluables) / evaluables` → **sin Autopago y sin exonerados** |
| **Monto** | `Σ Cantidad / 100` (todos, incluidos exonerados) |
| `autopago` | retiros con `Operador === "Autopago"` |
| **Automatización %** | `autopago / total × 100` |
| `vipTotal` | retiros con `Nivel ∈ {Nivel 2, Nivel 3, Nivel 4}` |

> **Regla única de SLA (decisión 8):** el SLA **nunca cuenta los retiros de Autopago** ni los exonerados, en ninguna vista (dashboard, Reportes y Auditoría). Es la regla que ya usa la auditoría diaria actual.
>
> Comprobación con los números del mockup: total 5.048 · Autopago 3.094 → manuales 1.954 · exonerados 141 → evaluables 1.813 · cumplidos 1.708 → 1.708 / 1.813 = **94,2%** · incumplidos 105.
>
> **El tiempo promedio sigue la misma regla:** solo retiros manuales no exonerados, en todas las vistas. Cambia respecto del dashboard actual, que hoy incluye Autopago en el tiempo.

### 7.3 Período anterior y tendencias

Se mantiene la lógica de fechas actual (`currStart/currEnd/prevStart/prevEnd`, comparación por string `YYYY-MM-DD`).

| KPI | Variación | Bueno si… |
|---|---|---|
| SLA | `curr.sla − prev.sla` → **puntos** (`+1,8 pts`) | ≥ 0 |
| Tiempo promedio | `(curr − prev) / prev × 100` → **%** | ≤ 0 (bajar el tiempo es bueno) |
| Monto | `(curr − prev) / prev × 100` → **%** | ≥ 0 |
| Automatización | `curr.auto − prev.auto` → **puntos** | ≥ 0 |

- `calcTrend(c, p)`: si `p === 0` → `c > 0 ? 100 : 0` (igual que hoy).
- Con `all_time` **no** se muestra la tendencia (no hay período anterior): se oculta la pastilla y el texto "vs …".
- Texto de comparación en la card SLA: `"+1,8 pts vs " + nombrePeriodoAnterior`:
  - `current_month` → nombre del mes anterior en minúscula ("vs septiembre")
  - `last_month` → mes anterior a ese ("vs agosto")
  - `last_3_months` → "vs trimestre anterior"
  - `custom` → "vs período anterior"
- Con un valor entre −0.1 y +0.1, la pastilla va en neutro (`bg-muted text-muted-foreground`) y sin signo.

### 7.4 Series y agrupaciones

**Serie diaria** (gráfico): por cada día `YYYY-MM-DD` del período:

```ts
{ fecha: "2026-10-04", dia: "04", volumen: total_dia, sla: cumplidos_dia / evaluables_dia * 100 | null }   // evaluables = sin Autopago ni exonerados
```

- **Rellenar los días sin datos** desde `currStart` hasta `min(currEnd, hoy)` con `volumen: 0, sla: null`, para que el eje X sea continuo y la línea se corte (`connectNulls={false}`).
- SLA con **1 decimal**, sin redondear a entero como hoy.
- Para `all_time` o rangos de más de 62 días, agrupar por **semana** (`startOfWeek(d, { weekStartsOn: 1 })`) y rotular "sem 14 oct". Si se prefiere simplificar, agrupar por mes cuando el rango supera 120 días.

**Niveles** (distribución VIP): normalizar `Nivel` → `"Estándar" | "Nivel 2" | "Nivel 3" | "Nivel 4"` (todo lo que no sea 2/3/4 cuenta como Estándar). **Orden fijo:** Estándar, VIP 2, VIP 3, VIP 4. Etiqueta visible: `"Nivel 2" → "VIP 2"`.

**Operadores** (tabla): solo `Operador !== "Autopago"`. Por operador:

```ts
{
  nombre,
  retiros: total,                                   // todos sus retiros
  brechas: incumplidos,                             // evaluables con Cumple false
  tiempo: Σ Tiempo evaluables / evaluables,         // min, 1 decimal
  sla: cumplidos / evaluables * 100,                // 1 decimal
}
```

**Orden:** por `brechas` ascendente; si empatan, por `sla` descendente y luego por `retiros` descendente.

### 7.5 Efecto de "Solo VIP"

**Decisión tomada:** el switch **filtra toda la vista**, no solo los KPIs (el spec del 13-07 lo limitaba a la card de tiempo; esto lo reemplaza). Con el switch encendido, **ningún bloque muestra retiros Estándar**, incluida la distribución por usuarios VIP:

| Bloque | Solo VIP = off | Solo VIP = on |
|---|---|---|
| Card SLA, KPIs, tendencias | todos los retiros | solo VIP (curr y prev) |
| Gráfico diario | todos | solo VIP |
| Tabla equipo | todos (sin Autopago) | solo VIP (sin Autopago) |
| Distribución VIP | 4 niveles (Estándar, VIP 2, 3, 4), header = % VIP del total | **sin Estándar**: solo VIP 2/3/4 (renormalizado a 100%), header = nº de retiros VIP |
| Meta de tiempo | 25 min | 25 min (la misma meta) |

**Implementación recomendada:** calcular todo con **una sola función pura** que reciba el dataset ya filtrado, y llamarla dos veces (todos / VIP) para no repetir el fetch:

```ts
// components/dashboard/useDashboardData.ts (resumen)
const VIP_LEVELS = ["Nivel 2", "Nivel 3", "Nivel 4"] as const;
const isVip = (d: Retiro) => VIP_LEVELS.includes(String(d.Nivel ?? "").trim() as any);

type Resumen = {
  total: number; exonerados: number; evaluables: number;
  cumplidos: number; incumplidos: number;
  sla: number; tiempo: number; monto: number;
  autopago: number; automatizacion: number; vipTotal: number;
};

function resumir(rows: Retiro[]): Resumen {
  let total = 0, exo = 0, cum = 0, inc = 0, t = 0, monto = 0, auto = 0, vip = 0;
  for (const d of rows) {
    total++;
    monto += (Number(d.Cantidad) || 0) / 100;
    if (isVip(d)) vip++;
    if (d.Operador === "Autopago") { auto++; continue; }     // Autopago no cuenta para SLA ni tiempo
    if (isExonerated(d.comentarioBrecha)) { exo++; continue; }
    t += Number(d.Tiempo) || 0;
    d.Cumple === true ? cum++ : inc++;
  }
  const ev = cum + inc;                                      // manuales no exonerados
  return {
    total, exonerados: exo, evaluables: ev, cumplidos: cum, incumplidos: inc,
    sla: ev ? (cum / ev) * 100 : 0,
    tiempo: ev ? t / ev : 0,
    monto, autopago: auto,
    automatizacion: total ? (auto / total) * 100 : 0,
    vipTotal: vip,
  };
}

function serieDiaria(rows: Retiro[], desde: Date, hasta: Date) { /* agrupa + rellena días */ }
function porNivel(rows: Retiro[]) { /* Estándar, Nivel 2, 3, 4 en orden fijo */ }
function porOperador(rows: Retiro[]) { /* excluye Autopago, ordena por brechas asc */ }

// Dentro del hook, tras leer el snapshot:
const curr = currentRows, prev = prevRows;
const vista = (vip: boolean) => {
  const c = vip ? curr.filter(isVip) : curr;
  const p = vip ? prev.filter(isVip) : prev;
  return {
    actual: resumir(c),
    anterior: resumir(p),
    diaria: serieDiaria(c, currStart, currEnd),
    niveles: porNivel(curr),            // siempre sobre el total; la card decide qué mostrar
    operadores: porOperador(c),
  };
};
return { todos: vista(false), vip: vista(true), periodo, estado };
```

La página elige `data[showVipOnly ? "vip" : "todos"]`: cambiar el switch no vuelve a consultar Firestore.

> **Rendimiento:** hoy se descarga **toda** la colección de la moneda y se filtra en memoria. Funciona, pero crece con el tiempo. Mejora futura (no bloquea este rediseño): filtrar en Firestore con `where("Fecha del reporte", ">=", prevStartStr)` y `"<=", currEndStr` (requiere índice compuesto `Moneda + Fecha del reporte`).

---

## 8. Componentes del Dashboard

### 8.1 `TrendPill`

```tsx
type Props = { value: number; unit: "pts" | "%"; goodWhen: "up" | "down"; hidden?: boolean };

export function TrendPill({ value, unit, goodWhen, hidden }: Props) {
  if (hidden) return null;
  const neutral = Math.abs(value) < 0.1;
  const good = goodWhen === "up" ? value >= 0 : value <= 0;
  const tone = neutral
    ? "bg-muted text-muted-foreground"
    : good ? "bg-success-soft text-success-text" : "bg-danger-soft text-danger-text";
  const sign = neutral ? "" : value > 0 ? "+" : "-";
  return (
    <span className={`shrink-0 rounded-full px-2 py-[3px] text-xs font-semibold ${tone}`}>
      {sign}{formatDecimal(Math.abs(value))}{unit === "pts" ? " pts" : "%"}
    </span>
  );
}
```

### 8.2 Encabezado de card (ícono + título)

```tsx
<div className="flex items-center gap-2.5">
  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-icon-green">
    <CircleCheck className="size-4" />
  </span>
  <span className="font-medium">SLA de cumplimiento</span>
</div>
```

| Card | Ícono lucide | Color del ícono |
|---|---|---|
| SLA de cumplimiento | `CircleCheck` | `text-icon-green` |
| Tiempo promedio | `Clock` | `text-icon-amber` |
| Monto procesado | `Banknote` | `text-icon-blue` |
| Automatización | `Bot` | `text-icon-violet` |

### 8.3 `SlaCard` (izquierda, alto completo de la fila)

```
┌──────────────────────────────────────┐
│ [✓] SLA de cumplimiento              │
│                                      │
│  ◯ anillo    94,2%                   │
│  (128px)     [+1,8 pts vs septiembre]│
│              Meta 90% · bajo 25 min · sin Autopago
│ ──────────────────────────────────── │
│ ● Cumplidos                   4.412  │
│ ● Incumplidos                   272  │
│ ● Exonerados                    364  │
└──────────────────────────────────────┘
```

- Card: `flex flex-col gap-5`; el bloque de conteos lleva `mt-auto border-t border-border pt-4 flex flex-col gap-3` para quedar pegado abajo.
- Valor: `text-[38px] font-bold leading-none tracking-tight`.
- Puntos de la lista: `size-2 rounded-full` → `bg-success`, `bg-danger`, `bg-level-0`. Cifras en `font-semibold`.
- **Anillo** (SVG, sin dependencias):

```tsx
function SlaRing({ value }: { value: number }) {
  const r = 56, c = 2 * Math.PI * r;
  const len = (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <svg width={128} height={128} viewBox="0 0 140 140" className="-rotate-90 shrink-0"
         role="img" aria-label={`SLA de cumplimiento ${formatPct(value)}`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--track)" strokeWidth={14} />
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--success)" strokeWidth={14}
              strokeLinecap="round" strokeDasharray={`${len} ${c}`} />
    </svg>
  );
}
```

  Opcional: si el SLA está bajo la meta, pintar el arco con `var(--danger)`; entre la meta y meta+3, con `var(--warning)`.

### 8.4 `KpiCard` (las 3 de la derecha)

Estructura común: `flex flex-col gap-4 rounded-xl border bg-card p-[18px]`

```
[ícono] Título
VALOR unidad                     [pastilla]
texto secundario (muted, 12px)
```

| Card | Valor | Unidad | Pastilla | Texto secundario |
|---|---|---|---|---|
| Tiempo promedio | `formatDecimal(tiempo)` → `18,4` | `min` (15px, muted, 500) | `%`, buena si baja | `Meta 25 min · solo gestión manual` (igual con Solo VIP) |
| Monto procesado | `formatMontoCompacto(monto, moneda)` → `$412,8M` | — | `%`, buena si sube | `5.048 retiros` (VIP: `retiros VIP`) |
| Automatización | `61,3%` | — | `pts`, buena si sube | `3.094 por Autopago` |

- Fila del valor: `flex items-end justify-between gap-2`; valor `text-[28px] font-bold leading-none tracking-tight whitespace-nowrap`.
- Con moneda `GLOBAL`, el monto muestra **"Múltiple"** y la pastilla se oculta (no se suman monedas distintas).
- Opcional en Tiempo: si `tiempo > meta`, pintar el texto de la meta en `text-danger-text`.

### 8.5 `DailySlaVolumeChart`: gráfico combinado

**Encabezado:** título "SLA y volumen diario" (`text-[15px] font-semibold`) y, a la derecha, la leyenda (`text-xs text-muted-foreground`, `flex flex-wrap gap-3.5`):

- línea `w-3.5 h-[3px] rounded bg-success` → "SLA diario"
- cuadro `size-2.5 rounded-sm bg-chart-bar` → "Retiros por día"
- cuadro `w-3 h-2.5 rounded-sm bg-chart-zone border-t border-dashed border-danger` → "Bajo meta 90%"

**Gráfico:** alto `200px` del área de trazado (contenedor `h-[236px]` con ejes). Recharts 3 `ComposedChart`:

```tsx
"use client";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  ReferenceArea, ReferenceLine, Tooltip,
} from "recharts";

const META = 90, SLA_MIN = 85;   // el eje derecho va de 85% a 100% (ticks 85/90/95/100)

export function DailySlaVolumeChart({ data }: { data: Punto[] }) {
  // data: { dia: "04", volumen: number, sla: number | null }
  const maxVol = Math.max(1, ...data.map((d) => d.volumen));
  const volTop = niceCeil(maxVol * 1.8, 3);       // las barras ocupan ~55% inferior
  const plot = data.map((d) => ({ ...d, slaPlot: d.sla == null ? null : Math.max(SLA_MIN + 0.3, d.sla) }));

  return (
    <ResponsiveContainer width="100%" height={236}>
      <ComposedChart data={plot} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="44%">
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="dia" tickLine={false} axisLine={false} interval={3}
               tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }} />
        <YAxis yAxisId="vol" orientation="left" domain={[0, volTop]} ticks={[0, volTop / 3, (volTop * 2) / 3, volTop]}
               tickFormatter={(v) => formatEntero(v)} tickLine={false} axisLine={false} width={40}
               tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }} />
        <YAxis yAxisId="sla" orientation="right" domain={[SLA_MIN, 100]} ticks={[85, 90, 95, 100]}
               allowDataOverflow tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={40}
               tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }} />

        <ReferenceArea yAxisId="sla" y1={SLA_MIN} y2={META} fill="var(--chart-zone)" ifOverflow="hidden" />
        <Bar yAxisId="vol" dataKey="volumen" fill="var(--chart-bar)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        <ReferenceLine yAxisId="sla" y={META} stroke="var(--danger)" strokeOpacity={0.55} strokeDasharray="4 4" />
        <Line yAxisId="sla" dataKey="slaPlot" type="linear" stroke="var(--success)" strokeWidth={2.5}
              connectNulls={false} isAnimationActive={false}
              dot={(p: any) => p.payload.sla != null && p.payload.sla < META
                ? <circle key={p.key} cx={p.cx} cy={p.cy} r={4.5} fill="var(--danger)" stroke="var(--card)" strokeWidth={2} />
                : <g key={p.key} />}
              activeDot={{ r: 4, fill: "var(--success)", stroke: "var(--card)", strokeWidth: 2 }} />

        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

- **Por qué el eje de SLA va de 85 a 100:** la meta (90%) queda a 2/3 de la altura y coincide con la misma línea de la grilla que el tick 1/3 del volumen. Si un día cae bajo 85%, se dibuja pegado al piso (`SLA_MIN + 0.3`) con su **punto rojo**, y el tooltip muestra el valor real.
- **`niceCeil(x, 3)`:** redondea hacia arriba a un múltiplo de `3·paso` (paso = 3, 15, 30 o 100 según el tamaño) para que los ticks 1/3 y 2/3 salgan enteros.
- **Tooltip** (`ChartTooltip`): card `rounded-lg border bg-popover px-3 py-2 text-xs shadow-md` con:
  - `04 oct` (font-mono, muted)
  - `SLA 88,6%` (en `text-danger-text` si es menor a 90)
  - `Retiros 162`
- **Puntos rojos:** solo los días con SLA menor a la meta. Así se ven rápido los días con problemas.

### 8.6 `TeamPerformanceTable`

**Encabezado:**
- Título "Rendimiento del equipo" (`text-[15px] font-semibold`)
- Subtítulo `text-xs text-muted-foreground`: "Ordenado por brechas · gestión manual, excluye Autopago · SLA < 25 min"
- Leyenda a la derecha: puntos `bg-success` "≥ 90%", `bg-warning` "75–89%", `bg-danger` "< 75%"

**Tabla** con grid (estilo Watermelon). Envolver en `overflow-x-auto` con `min-w-[640px]` adentro:

```ts
const cols = "grid-cols-[minmax(130px,1.6fr)_minmax(70px,.8fr)_minmax(70px,.8fr)_minmax(90px,1fr)_minmax(170px,2.2fr)]";
```

- **Fila de títulos:** `grid ${cols} items-center gap-4 rounded-lg border border-border bg-muted px-3.5 py-[9px] text-xs font-medium text-muted-foreground`
  - Columnas: `Operador` · `Retiros` (der.) · `Brechas` (der.) · `Tiempo prom.` (der.) · `SLA cumplido`
- **Fila de datos:** `grid ${cols} items-center gap-4 border-b border-border px-3.5 py-[11px]`
  1. Avatar `size-7 rounded-full bg-muted text-xs font-semibold` con la inicial + nombre `font-medium`
  2. Retiros: `text-right font-mono font-medium`
  3. Brechas: `text-right font-mono font-semibold text-danger-text`
  4. Tiempo: `text-right font-mono font-medium` + ` min` en `text-muted-foreground font-normal`
  5. SLA: barra `h-1.5 flex-1 rounded-full bg-track` con relleno al `sla%` + badge `min-w-[58px] rounded-full px-2 py-[3px] text-center text-xs font-semibold`

| SLA | Barra | Badge |
|---|---|---|
| ≥ 90 | `bg-success` | `bg-success-soft text-success-text` |
| 75 – 89.9 | `bg-warning` | `bg-warning-soft text-warning-text` |
| < 75 | `bg-danger` | `bg-danger-soft text-danger-text` |

- Sin operadores: una fila `py-8 text-center text-muted-foreground` con "No hay registros de operadores para esta selección."
- Se puede usar el `Table` de shadcn en vez del grid si se prefiere. El aspecto se logra igual con `TableHeader` → `bg-muted rounded-lg` (las esquinas redondeadas en `<tr>` piden `[&_tr]:border-0` y bordes por celda), aunque el grid es más directo.

### 8.7 `VipDistributionCard`: "Distribución por usuarios VIP"

```
Distribución por usuarios VIP
Participación sobre el total de retiros          (VIP: "Reparto entre niveles VIP")

34,0%                                            (VIP: "1.716")
de los retiros son de usuarios VIP (1.716)       (VIP: "retiros VIP en el período")

[████████████░░░░░▒▒▒▓]   barra apilada 12px, gap 3px, segmentos rounded-[3px]

■ Estándar       3.332   66,0%
■ VIP 2          1.010   20,0%
■ VIP 3            505   10,0%
■ VIP 4            202    4,0%
```

- Número grande: `font-mono text-[26px] font-semibold leading-none`.
- Barra: `flex h-3 gap-[3px]`; cada segmento con `style={{ width: pct + "%" }}` y color `bg-level-0..3`.
- Filas: `flex items-center gap-2.5 border-b border-border py-2.5`; cuadro `size-2.5 rounded-[3px]`; cantidad `font-mono text-muted-foreground`; % `font-mono font-semibold min-w-[52px] text-right`.
- **Solo VIP:** se quita Estándar y los % se recalculan sobre `vipTotal`.
- Los niveles van de claro a oscuro (más VIP = más oscuro), así se distinguen también por luminosidad y no solo por color.

---

## 9. Selector de período y rango personalizado

### 9.1 Select de período (`components/ui/select` existente)

```tsx
<Select value={dateFilter ?? undefined} onValueChange={onPeriodo}>
  <SelectTrigger className="h-9 min-w-[196px] gap-2 rounded-lg border-input bg-card text-[13px] font-medium shadow-xs" aria-label="Período">
    <CalendarDays className="size-4 text-muted-foreground" />
    <SelectValue placeholder="Selecciona un período" />
  </SelectTrigger>
  <SelectContent align="end" className="w-56">
    <SelectItem value="current_month">Mes actual</SelectItem>
    <SelectItem value="last_month">Mes anterior</SelectItem>
    <SelectItem value="last_3_months">Últimos 3 meses</SelectItem>
    <SelectItem value="all_time">Histórico completo</SelectItem>
    <SelectSeparator />
    <SelectItem value="custom">Rango personalizado…</SelectItem>
  </SelectContent>
</Select>
```

- **No** usar `<select>` nativo ni botones segmentados para el período.
- Placeholder (`text-muted-foreground`) mientras no haya selección.
- Se elimina el contenedor gris (`bg-slate-50 px-3 …`) que hoy envuelve al select.

### 9.2 Rango personalizado (Popover + Calendar existentes)

Al elegir `custom`:

1. Aparece a la derecha del Select un **botón** (`Button variant="outline" h-9 rounded-lg bg-card font-medium`) con ícono `CalendarDays` y el texto:
   - sin fechas: "Selecciona un rango" (muted)
   - con inicio: "06 oct – …"
   - completo: "06 oct – 15 oct 2026"
2. El **Popover se abre solo** (`open` controlado) apenas se elige `custom`, si no hay rango completo.
3. Calendario: `mode="range"`, `numberOfMonths={2}`, `locale={es}` (semana desde lunes), `showOutsideDays`, `defaultMonth={customRange?.from ?? new Date()}`.
4. Debajo del calendario, un pie `border-t pt-2.5 flex justify-between text-xs text-muted-foreground`:
   - texto de ayuda: "Elige la fecha de inicio" → "Ahora elige la fecha de fin" → "Rango: 06 oct – 15 oct 2026"
   - botón `Limpiar` (`variant="outline" size="sm"`) → `setCustomRange(undefined)`
5. Al tener `from` **y** `to` distintos, el popover **se cierra solo** y empieza la carga.
6. **No** se debe volver a mostrar ningún otro selector o tarjeta de atajos: solo el skeleton con su mensaje (§10).

```tsx
const [calOpen, setCalOpen] = useState(false);

const onPeriodo = (v: string) => {
  setDateFilter(v);
  if (v === "custom" && !(customRange?.from && customRange?.to)) setCalOpen(true);
};

<Popover open={calOpen} onOpenChange={setCalOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline" className="h-9 gap-2 rounded-lg bg-card text-[13px] font-medium">
      <CalendarDays className="size-4" />
      <span className={customRange?.from ? "" : "text-muted-foreground"}>{textoRango(customRange)}</span>
    </Button>
  </PopoverTrigger>
  <PopoverContent align="end" className="w-auto p-3">
    <Calendar
      mode="range"
      numberOfMonths={2}
      locale={es}
      selected={customRange}
      defaultMonth={customRange?.from ?? new Date()}
      onSelect={(r) => {
        setCustomRange(r);
        if (r?.from && r?.to && r.from.getTime() !== r.to.getTime()) setCalOpen(false);
      }}
    />
    <div className="mt-2.5 flex items-center justify-between gap-2.5 border-t border-border pt-2.5 text-xs text-muted-foreground">
      <span>{ayudaRango(customRange)}</span>
      <Button variant="outline" size="sm" onClick={() => setCustomRange(undefined)}>Limpiar</Button>
    </div>
  </PopoverContent>
</Popover>
```

`textoRango` usa `format(d, "dd MMM", { locale: es })` y agrega `yyyy` en la fecha final.

> Con react-day-picker v9 en `mode="range"`, el primer clic deja `from === to`. Por eso el cierre automático exige fechas distintas. Si se quiere permitir un rango de **un solo día**, agregar un botón "Aplicar" en el pie en lugar del cierre automático.

### 9.3 Switch "Solo VIP"

```tsx
<label className="flex h-9 cursor-pointer items-center gap-2.5 rounded-lg border border-input bg-card px-3 text-[13px] font-semibold">
  Solo VIP
  <Switch checked={showVipOnly} onCheckedChange={setShowVipOnly}
          className="data-[state=checked]:bg-success" />
</label>
```

Se quita el botón **Exportar** (no va en esta vista).

---

## 10. Estados: sin período, cargando, sin datos

| Estado | Condición | Qué se ve |
|---|---|---|
| `sin-periodo` | `dateFilter === null` | Skeleton **quieto** al 55% de opacidad + pastilla "Selecciona un rango de fechas para cargar los datos" |
| `rango-incompleto` | `dateFilter === "custom"` sin `from` y `to` | Igual, con la pastilla "Selecciona la fecha de inicio y fin para cargar los datos" |
| `cargando` | `isLoading` | Skeleton al 100% con `animate-pulse` (sin pastilla) |
| `sin-datos` | carga terminada y `total === 0` | Skeleton quieto + pastilla "No hay datos procesados para el rango seleccionado" |
| `listo` | hay datos | Contenido real |

- **No** usar el `Loader2` girando ni la caja con borde punteado de hoy.
- El skeleton **copia la forma real** de la página (mismas cards, mismo grid):
  - Card SLA: cuadrito de ícono 32px + línea de 150px; círculo de 128px + 3 líneas (valor, pastilla, meta); 3 líneas abajo después del separador
  - 3 KPI: ícono + línea, valor 90×26 + pastilla 52×18, línea al 60%
  - Gráfico: título + leyenda y **31 barras** de alturas variadas (`items-end gap-1.5`)
  - Tabla: línea de título, barra de encabezado de 34px y 5 filas (avatar + línea + barra)
  - Distribución: título, número, 4 líneas
- Cada bloque es `<Skeleton />` de shadcn con `bg-skeleton` (sobrescribir `bg-accent` en `components/ui/skeleton.tsx` o pasarlo por `className`).
- **Pastilla de mensaje:** centrada horizontalmente, `absolute top-[150px]` sobre el skeleton, `pointer-events-none`:

```tsx
<p role="status" className="flex items-center gap-2 rounded-full border border-input bg-card px-3.5 py-2 text-[13px] text-muted-foreground shadow-lg">
  <CalendarDays className="size-4" /> {mensaje}
</p>
```

- El skeleton lleva `aria-hidden` y la pastilla `role="status"`, para que el lector de pantalla anuncie solo el mensaje.

> **Sugerencia:** iniciar `dateFilter` en `"current_month"` para que el dashboard cargue datos de inmediato. Así el estado `sin-periodo` casi no se vería y el skeleton quedaría solo para la carga.

---

## 11. Formato de números y textos

**Decisión tomada:** se usa **`es-CL`**, el formato que ya tiene el sistema: punto de miles y coma decimal (`4.412`, `18,4`, `$412,8M`, `94,2%`, `+1,8 pts`). Nunca usar `toFixed()` directo para mostrar números; siempre pasar por estos formateadores:

```ts
// lib/format.ts
const NF = "es-CL";

export const formatEntero = (n: number) => Math.round(n).toLocaleString(NF);          // 4.412
export const formatDecimal = (n: number, d = 1) =>
  n.toLocaleString(NF, { minimumFractionDigits: d, maximumFractionDigits: d });       // 18,4
export const formatPct = (n: number) => `${formatDecimal(n)}%`;                       // 94,2%

const SIMBOLO: Record<string, string> = { CLP: "$", PEN: "S/ ", MXN: "MX$", USD: "US$", VES: "Bs. " };

export function formatMontoCompacto(monto: number, moneda: string) {
  if (moneda === "GLOBAL") return "Múltiple";
  const s = SIMBOLO[moneda] ?? "";
  if (monto >= 1e9) return `${s}${formatDecimal(monto / 1e9)}B`;   // $1,2B
  if (monto >= 1e6) return `${s}${formatDecimal(monto / 1e6)}M`;   // $412,8M
  if (monto >= 1e3) return `${s}${formatDecimal(monto / 1e3)}K`;   // US$286,3K
  return `${s}${formatEntero(monto)}`;
}

/** Monto completo para el `title` (tooltip nativo) del valor compacto. */
export const formatMontoCompleto = (monto: number, moneda: string) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: moneda === "GLOBAL" ? "USD" : moneda, maximumFractionDigits: 0 }).format(monto);
```

- El valor compacto lleva `title={formatMontoCompleto(...)}` para ver la cifra exacta al pasar el mouse.
- Fechas: `date-fns` con `locale: es`; meses en minúscula dentro de frases ("vs septiembre") y con mayúscula inicial en el subtítulo ("Octubre 2026").
- Signos de tendencia: `+` / `-` ASCII, 1 decimal, con espacio antes de `pts` (`+1,8 pts`) y sin espacio antes de `%` (`-2,1%`).
- En el gráfico, los `tickFormatter` y el tooltip también usan `formatEntero` / `formatPct` (ej. `95%`, `1.250`).

---

## 12. Responsive y accesibilidad

**Responsive**
- Filas con `flex flex-wrap` y `flex-basis` mínimos: card SLA `300px`, columna derecha `560px`, tabla `560px`, distribución `300px`. En pantallas angostas se apilan solas.
- KPIs: `repeat(auto-fit, minmax(min(200px,100%),1fr))` → 3, 2 o 1 columna.
- La tabla se desplaza horizontalmente dentro de su card (`overflow-x-auto`, `min-w-[640px]`).
- Header: `flex-wrap`; en móvil el selector de moneda baja a una segunda línea.
- El Popover del calendario con 2 meses mide unos 520px: en móvil usar `numberOfMonths={isMobile ? 1 : 2}` (`useMediaQuery("(max-width: 640px)")`).

**Accesibilidad**
- Botones de verdad (`<button>`, `<a>`) para todo lo clickeable. El botón de tema y el de cerrar sesión llevan `aria-label`.
- Ítem activo del sidebar con `aria-current="page"`.
- Anillo y gráfico con `role="img"` y `aria-label` descriptivo.
- Contraste: los textos `*-text` y `muted-foreground` de ambos temas cumplen 4.5:1 sobre `card`. No poner texto blanco sobre `success`/`warning`.
- Rojo y verde no se diferencian solo por el tono: la zona bajo meta además va **sombreada y con línea punteada**, y los días malos llevan punto. Los niveles VIP cambian de claro a oscuro.

---

## 13. Constantes y metas

Valores confirmados. Dejarlos en `lib/constants.ts` para ajustarlos en un solo lugar:

```ts
export const SLA_UMBRAL_MIN = 25;        // ya lo usa el sistema (campo Cumple)
export const SLA_META_PCT = 90;          // "Meta 90%" en la card SLA y línea roja del gráfico (confirmado)
export const TIEMPO_META_MIN = 25;       // "Meta 25 min" en Tiempo promedio, también con Solo VIP (confirmado)
export const SLA_VERDE = 90;             // badge verde ≥ 90
export const SLA_AMARILLO = 75;          // badge ámbar 75–89.9, rojo < 75
export const VIP_LEVELS = ["Nivel 2", "Nivel 3", "Nivel 4"] as const;
```

Si las metas cambian por moneda, convertirlas en `Record<Currency, number>`.

---

## 14. Checklist de verificación

**Tema y estilos**
- [ ] Sin preferencia guardada, la app sigue el tema del SO. El botón sol/luna alterna y la elección se mantiene al recargar.
- [ ] No queda ningún `slate-*`, `bg-white` ni hex fijo en `MainLayout`, `Sidebar` ni en los componentes del dashboard.
- [ ] La fuente es Geist; los ejes, monedas y cifras de tabla van en Geist Mono.
- [ ] El logo no tiene recuadro y se ve bien en los dos temas. No aparece "Retiros Internacionales".

**Layout**
- [ ] El sidebar tiene "Inicio" activo en `/`, las etiquetas de grupo, el badge "Admin" en Monitor regional y Gestión de usuarios, y la tarjeta de usuario con cierre de sesión (AlertDialog).
- [ ] El header tiene breadcrumb, monedas segmentadas (respetando `monedasPermitidas` por rol) y el botón de tema.
- [ ] El botón Exportar no aparece.

**Filtros y estados**
- [ ] Sin período: skeleton quieto + "Selecciona un rango de fechas para cargar los datos".
- [ ] Al elegir "Rango personalizado…" se abre el calendario de 2 meses. El skeleton muestra "Selecciona la fecha de inicio y fin…" y **no** aparece ninguna otra tarjeta ni selector.
- [ ] Con inicio y fin elegidos, el popover se cierra, se ve el skeleton con pulso y después los datos.
- [ ] El botón y el subtítulo muestran "06 oct – 15 oct 2026".
- [ ] "Limpiar" vacía el rango.
- [ ] Período sin registros: "No hay datos procesados para el rango seleccionado".

**Cálculos** (comparar con una consulta manual para una moneda y un mes)
- [ ] `cumplidos + incumplidos + exonerados = total − autopago`, y el SLA no cambia aunque cambie la cantidad de retiros de Autopago.
- [ ] SLA = `cumplidos / (total − exonerados)`.
- [ ] Tiempo promedio sin contar Autopago ni exonerados (igual al de la auditoría para el mismo día).
- [ ] Automatización = `autopago / total`; el texto "N por Autopago" coincide.
- [ ] Monto en CLP compacto (`$412,8M`) y exacto en el `title`. En GLOBAL dice "Múltiple".
- [ ] Tendencias: SLA y automatización en **pts**, tiempo y monto en **%**. El tiempo que baja sale en verde. En "Histórico completo" no hay tendencias.
- [ ] Gráfico: un punto por día (los días sin datos cortan la línea), puntos rojos solo bajo 90% y tooltip con SLA real y retiros.
- [ ] Tabla: sin Autopago, ordenada por brechas ascendente; brechas = incumplidos del operador; colores de badge según 90/75.
- [ ] Distribución: los 4 niveles suman 100%; con Solo VIP desaparece Estándar y los 3 niveles suman 100%.
- [ ] Todos los números salen en `es-CL` (punto de miles, coma decimal), también en ejes, tooltips y pastillas.
- [ ] La card de Tiempo dice "Meta 25 min" con y sin Solo VIP; la card SLA dice "Meta 90%".
- [ ] **Solo VIP** cambia KPIs, tendencias, gráfico, tabla y distribución **sin volver a consultar Firestore**.

**Responsive**
- [ ] A 390px de ancho: sidebar como drawer, cards apiladas, tabla con scroll propio y calendario de 1 mes.

---

## 15. Login (opción C: "Producto de fondo")

> **Archivo:** `app/(auth)/login/page.tsx` + componentes nuevos en `components/login/`.
> **Referencia visual:** artboards *Login C — Oscuro*, *Login C — Claro* y *Login C — Móvil* del canvas.
> La lógica de autenticación actual (`signInWithEmailAndPassword` → `router.push("/")`) **no cambia**. Solo cambian la presentación y el manejo de errores.

### 15.1 Concepto

Detrás del formulario se ve una **versión simplificada del dashboard**, inclinada en 3D, que flota suavemente y se desvanece hacia los bordes. Encima va una **tarjeta translúcida** (efecto vidrio) con el formulario. El usuario ve el producto antes de entrar, sin mostrar datos reales.

```
┌────────────────────────────────────────────────────────────┐
│   (dashboard inclinado de fondo, desvanecido en los bordes)│
│                         [logo 56px]                        │
│                       PayoutMetrics                        │
│             Plataforma de auditoría y rendimiento          │
│              ┌──────────────────────────────┐              │
│              │ Inicia sesión                │              │
│              │ Usa tu correo corporativo…   │              │
│              │ [!] Error (si aplica)        │              │
│              │ Correo electrónico           │              │
│              │ [✉ usuario@empresa.com     ] │              │
│              │ Contraseña                   │              │
│              │ [🔒 ••••••••            👁 ] │              │
│              │ [   Ingresar al panel  →   ] │              │
│              └──────────────────────────────┘              │
│        Desarrollado para JuegaEnLinea · v1.0 © 2026        │
└────────────────────────────────────────────────────────────┘
```

### 15.2 Tema: sigue al sistema operativo

- El login **no tiene botón de tema**. Usa el mismo `ThemeProvider` de la app (§3) con `defaultTheme="system"`:
  - si el usuario ya eligió un tema dentro de la app (guardado en `localStorage`), se respeta;
  - si no, se usa el tema del sistema operativo (`prefers-color-scheme`) y cambia en vivo si el usuario cambia el tema del SO.
- `next-themes` pone la clase `dark` antes del primer pintado (script en `<head>`), así que no hay parpadeo. Requiere `suppressHydrationWarning` en `<html>` (ya incluido en §3).
- Todo el login usa **tokens** (globales + los de la tabla de abajo). No hay colores fijos en el JSX.

### 15.3 Tokens adicionales (`app/globals.css`)

```css
:root {
  --login-bg: #F4F4F5;
  --login-glass: rgba(255, 255, 255, 0.74);
  --login-glass-border: rgba(23, 23, 23, 0.08);
  --login-glass-shadow: 0 30px 80px rgba(23, 23, 23, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  --login-input-bg: rgba(255, 255, 255, 0.9);
  --login-vignette-a: rgba(244, 244, 245, 0.25);
  --login-vignette-b: rgba(244, 244, 245, 0.86);
  --login-backdrop-opacity: 0.85;
  --login-backdrop-shadow: 0 60px 120px rgba(23, 23, 23, 0.18);
  --login-focus: #0B4FC7;
  --login-focus-ring: rgba(11, 79, 199, 0.18);
}
.dark {
  --login-bg: #09090B;
  --login-glass: rgba(20, 20, 23, 0.72);
  --login-glass-border: rgba(255, 255, 255, 0.12);
  --login-glass-shadow: 0 30px 80px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  --login-input-bg: rgba(0, 0, 0, 0.25);
  --login-vignette-a: rgba(9, 9, 11, 0.35);
  --login-vignette-b: rgba(9, 9, 11, 0.85);
  --login-backdrop-opacity: 0.6;
  --login-backdrop-shadow: 0 60px 120px rgba(0, 0, 0, 0.6);
  --login-focus: #5B8DEF;
  --login-focus-ring: rgba(91, 141, 239, 0.25);
}

/* Si el navegador no soporta backdrop-filter, el vidrio se vuelve casi opaco */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :root { --login-glass: rgba(255, 255, 255, 0.96); }
  .dark { --login-glass: rgba(20, 20, 23, 0.96); }
}
```

Exponerlos en `@theme inline` igual que los demás (`--color-login-bg: var(--login-bg);`, etc.).

**Botón principal:** usa `bg-primary text-primary-foreground` (en oscuro, botón claro con texto negro; en claro, botón negro con texto blanco). Hover: `hover:bg-primary/90`.

**Mensaje de error:** `bg-danger-soft text-danger-text border border-danger/30`.

### 15.4 Animaciones (en `@theme` de `globals.css`)

```css
@theme {
  --animate-login-float: login-float 10s ease-in-out infinite;
  --animate-login-enter: login-enter 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;

  @keyframes login-float {
    0%, 100% { transform: translate(-50%, -44%) perspective(1800px) rotateX(30deg) rotateZ(-9deg); }
    50%      { transform: translate(-50%, -45.2%) perspective(1800px) rotateX(30deg) rotateZ(-9deg); }
  }
  @keyframes login-enter {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: none; }
  }
}
```

- El fondo flota con `animate-login-float` (un desplazamiento vertical muy leve, 10s).
- El bloque del logo entra con `animate-login-enter`. La tarjeta entra igual, pero con `[animation-delay:120ms]`.
- Con `motion-reduce:animate-none` en los tres elementos se respeta "reducir movimiento" del sistema.

### 15.5 Estructura de componentes

```
app/(auth)/login/page.tsx        ← estado del formulario + Firebase
components/login/LoginBackdrop.tsx  ← dashboard inclinado decorativo (aria-hidden)
components/login/PasswordInput.tsx  ← input con botón mostrar/ocultar
```

**Contenedor de página:**

```tsx
<div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-login-bg px-4 py-12 text-foreground
                max-sm:justify-end max-sm:px-5 max-sm:pb-7 max-sm:pt-0">
  <LoginBackdrop />
  {/* Viñeta: desktop radial, móvil vertical */}
  <div aria-hidden className="pointer-events-none absolute inset-0
       bg-[radial-gradient(ellipse_55%_60%_at_50%_50%,var(--login-vignette-a)_0%,var(--login-vignette-b)_70%,var(--login-bg)_100%)]
       max-sm:bg-[linear-gradient(180deg,var(--login-vignette-a)_0%,var(--login-vignette-b)_42%,var(--login-bg)_60%)]" />

  <div className="relative z-10 flex w-full max-w-[410px] flex-col items-center gap-[22px] max-sm:items-stretch max-sm:gap-5">
    {/* Marca */}
    <div className="flex flex-col items-center gap-2.5 text-center animate-login-enter motion-reduce:animate-none
                    max-sm:flex-row max-sm:gap-3 max-sm:text-left">
      <img src="/logo.png" alt="" className="h-auto w-14 max-sm:w-11" />
      <div className="flex flex-col max-sm:leading-tight">
        <span className="text-[30px] font-extrabold tracking-[-0.03em] max-sm:text-[22px]">PayoutMetrics</span>
        <span className="text-sm text-muted-foreground max-sm:text-[13px]">Plataforma de auditoría y rendimiento</span>
      </div>
    </div>

    {/* Tarjeta de vidrio */}
    <div className="flex w-full flex-col gap-[22px] rounded-[18px] border border-login-glass-border bg-login-glass px-7 py-[30px]
                    shadow-[var(--login-glass-shadow)] backdrop-blur-[16px]
                    animate-login-enter [animation-delay:120ms] motion-reduce:animate-none
                    max-sm:gap-5 max-sm:px-5 max-sm:py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-bold tracking-tight max-sm:text-[21px]">Inicia sesión</h1>
        <p className="text-[13px] text-muted-foreground">Usa tu correo corporativo para entrar al panel.</p>
      </div>
      <LoginForm />
    </div>

    <p className="text-center text-xs text-muted-foreground">Desarrollado para JuegaEnLinea · v1.0 © 2026</p>
  </div>
</div>
```

> Cambiar `min-h-screen` por `min-h-dvh` evita que en el celular la barra del navegador corte el botón.

### 15.6 `LoginBackdrop`: el dashboard de fondo

Es **decorativo** (`aria-hidden`, `pointer-events-none`, sin texto legible ni datos reales). Se construye con bloques simples y los tokens del tema, para que cambie solo entre claro y oscuro. **No usar una captura de pantalla**: no se adaptaría al tema y pesaría más.

**Desktop:**

```tsx
export function LoginBackdrop() {
  return (
    <div aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 flex h-[960px] w-[1560px] overflow-hidden rounded-[18px]
                 border border-border bg-card opacity-[var(--login-backdrop-opacity)] shadow-[var(--login-backdrop-shadow)]
                 [transform:translate(-50%,-44%)_perspective(1800px)_rotateX(30deg)_rotateZ(-9deg)]
                 animate-login-float motion-reduce:animate-none
                 max-sm:top-[18px] max-sm:h-[400px] max-sm:w-[620px] max-sm:rounded-xl
                 max-sm:[transform:translateX(-50%)_perspective(1200px)_rotateX(32deg)_rotateZ(-10deg)] max-sm:animate-none">
      {/* Sidebar: logo + bloques */}
      <div className="flex w-[230px] shrink-0 flex-col gap-3.5 border-r border-border bg-sidebar p-4 max-sm:w-[92px] max-sm:gap-2 max-sm:p-2.5">…</div>
      {/* Contenido: card con anillo SLA (94%), 3 cards vacías, card con mini-gráfico (barras + línea + zona roja), tabla con 5 filas y barras de progreso */}
      <div className="flex flex-1 flex-col gap-[18px] p-7 max-sm:gap-2.5 max-sm:p-3">…</div>
    </div>
  );
}
```

- Bloques "texto": `rounded bg-foreground/[0.06]` con anchos variados (60%, 80%, 70%…).
- Cards: `rounded-[14px] border border-border bg-card`.
- Anillo: el mismo `SlaRing` del dashboard (§8.3) con un valor fijo de 94.
- Mini-gráfico: un `<svg viewBox="0 0 800 220" preserveAspectRatio="none">` con la zona `fill="var(--chart-zone)"`, 31 barras `fill="var(--chart-bar)"` y la línea `stroke="var(--success)"`. Los valores son una **serie fija** en el componente (no se consultan datos: el usuario todavía no está autenticado).
- Filas de la tabla: avatar + línea + barra de progreso con colores `success / success / success / warning / danger`.
- En **móvil**: el fondo queda arriba (`top: 18px`, 620×400 px), **sin flotación**, y la viñeta pasa a ser un degradado vertical. El contenido se alinea abajo (`justify-end`), cerca del pulgar.

### 15.7 Formulario

**Campos** (shadcn `Label` + `Input`, con ícono a la izquierda):

| Campo | `id` | `type` | `autoComplete` | Placeholder |
|---|---|---|---|---|
| Correo electrónico | `email` | `email` (+ `inputMode="email"`) | `username` | `usuario@empresa.com` |
| Contraseña | `password` | `password` / `text` | `current-password` | `••••••••` |

- Input: `h-[46px] rounded-[10px] border-input bg-login-input-bg pl-[42px] text-sm` (en móvil `h-12` y **`text-base` (16px)** para que iOS no haga zoom al enfocar).
- Foco: `focus-visible:border-[var(--login-focus)] focus-visible:ring-[3px] focus-visible:ring-[var(--login-focus-ring)]`.
- Ícono: `Mail` / `Lock` de lucide, `size-[17px] text-muted-foreground`, `absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none`.
- **Mostrar/ocultar contraseña:** botón `type="button"` de 38×38 (44×44 en móvil) a la derecha, con `aria-label` "Mostrar contraseña" / "Ocultar contraseña" e íconos `Eye` / `EyeOff`.
- **Botón:** `h-12 w-full rounded-[10px] text-[15px] font-semibold` con el texto "Ingresar al panel" y el ícono `ArrowRight`. Cargando: `Loader2` con `animate-spin` y el texto "Ingresando…", más `disabled` y `aria-busy="true"`.
- Labels visibles siempre (no solo placeholder).

**Error** (encima de los campos, dentro del formulario):

```tsx
{error && (
  <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-danger/30 bg-danger-soft px-3.5 py-3 text-[13px] text-danger-text">
    <CircleAlert className="mt-px size-[17px] shrink-0" />
    <span>{error}</span>
  </div>
)}
```

- El error se **limpia** cuando el usuario vuelve a escribir en cualquiera de los campos.
- Como el mensaje ya aparece en el formulario, se quita el `toast.error("Error de acceso")` para no duplicarlo. El `toast.success("Bienvenido a PayoutMetrics")` se mantiene.

**Mensajes según el código de error de Firebase** (recomendado; hoy todo muestra el mismo texto):

```ts
function mensajeError(code?: string) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-email":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Credenciales incorrectas o usuario no encontrado.";
    case "auth/user-disabled":
      return "Tu usuario está desactivado. Contacta a un administrador.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    case "auth/network-request-failed":
      return "No hay conexión. Revisa tu red e inténtalo de nuevo.";
    default:
      return "No se pudo iniciar sesión. Inténtalo de nuevo.";
  }
}
// en el catch: setError(mensajeError(err?.code));
```

> `auth/user-disabled` cuadra con `api/toggle-estado-usuario`, que ya desactiva usuarios desde el gestor.

### 15.8 Accesibilidad

- `<h1>` = "Inicia sesión". El logo lleva `alt=""` porque el nombre ya está en texto al lado.
- Los textos `muted-foreground` sobre la tarjeta de vidrio cumplen 4.5:1 en ambos temas, porque la viñeta oscurece o aclara el fondo detrás de la tarjeta. No bajar la opacidad del vidrio de 0.7.
- Todo es navegable con teclado y en este orden: correo → contraseña → mostrar → ingresar.
- Las animaciones se apagan con "reducir movimiento".

### 15.9 Checklist del login

- [ ] Sin tema guardado, el login usa el tema del SO, y cambia si el usuario cambia el tema del SO con la página abierta.
- [ ] Con un tema elegido antes dentro de la app, el login lo respeta.
- [ ] No hay parpadeo de tema al cargar.
- [ ] El fondo flota en desktop y queda quieto en móvil y con "reducir movimiento".
- [ ] En navegadores sin `backdrop-filter`, la tarjeta se ve casi opaca y legible.
- [ ] El ojo alterna la contraseña y su `aria-label` cambia.
- [ ] Al enviar: botón deshabilitado con "Ingresando…"; si hay error, aparece el mensaje correspondiente y desaparece al escribir.
- [ ] Login correcto: toast de bienvenida y redirección a `/`.
- [ ] A 390px: el contenido queda abajo, inputs de 48px con texto de 16px, sin scroll horizontal y el botón visible sin que lo tape la barra del navegador.

---

## 16. Reportes (une "Cargar reportes" y "Gestor de reportes")

> **Ruta nueva:** `app/(dashboard)/reportes/page.tsx` + componentes en `components/reportes/`.
> **Reemplaza a:** `app/(dashboard)/cargar-reportes/page.tsx` y `app/(dashboard)/gestor-reportes/page.tsx`.
> **Referencia visual:** artboard *Reportes (cargar + gestor)* del canvas.
> **Endpoints:** se reutilizan sin cambios de contrato `/api/fetch-api-reporte`, `/api/upload-reporte` y `/api/delete-reporte` (ver §16.7 para un cambio opcional en `upload-reporte`).

### 16.1 Qué cambia

| Antes | Ahora |
|---|---|
| Dos páginas: una para cargar (API o Excel en cola) y otra con la tabla del historial por mes | **Una sola página** con un **calendario mensual**, un **panel del día seleccionado** y una lista de **pendientes por cargar** |
| Carga por API y carga por Excel en dos tarjetas separadas | Un solo botón **Cargar reporte**: primero intenta el API y, **solo si falla**, el mismo modal ofrece subir el `.xlsx` de ese día |
| Fecha libre en un calendario popover (se podía elegir hoy o fechas futuras y fallaba después) | El **día en curso y los días futuros no se pueden seleccionar** |
| Selector de mes con año (solo en el gestor) | Selector de **mes y año** en el encabezado, sin meses futuros |

### 16.2 Navegación y redirecciones

**Sidebar (§5.2):** los ítems "Cargar reportes" y "Gestor de reportes" se reemplazan por **uno solo**:

```ts
{ id: "operaciones", title: "Gestión operativa", items: [
    { label: "Reportes", icon: CalendarCheck, href: "/reportes" },
    { label: "Evaluación diaria", icon: SquareCheck, href: "/evaluacion-diaria" },
]},
```

**Redirecciones** para no romper enlaces guardados (`next.config.ts`):

```ts
const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/cargar-reportes", destination: "/reportes", permanent: true },
      { source: "/gestor-reportes", destination: "/reportes", permanent: true },
    ];
  },
};
```

Después de verificar, se borran las dos páginas antiguas.

**Breadcrumb:** "Gestión operativa / Reportes".

**Query params (opcional, recomendado):** `?mes=2026-08&dia=24` para abrir la vista en un mes y día concretos (útil para enlazar desde la auditoría o desde un aviso). Si el mes es futuro o el día no es seleccionable, se ignoran.

### 16.3 Layout

```
Reportes                                          [‹] [📅 Octubre 2026 ⌄] [›]
Carga y gestión de los reportes diarios · moneda CLP

┌─────────────────────────── calendario ───────────────────────────┐ ┌──── panel del día ────┐
│ Octubre 2026   4 de 5 días cargados    ● Cargado ● Faltante ●…   │ │ Día seleccionado [chip]│
│ Lun  Mar  Mié  Jue  Vie  Sáb  Dom                                │ │ Sábado 3 de octubre    │
│ [  ] [  ] [  ] [1 ] [2 ] [3 ] [4 ]                               │ │ …datos o "Cargar"…     │
│ [5 ] [6 en curso] [7 ] …                                         │ └────────────────────────┘
│ …                                                                │ ┌── Pendientes por cargar ─┐
│ El día en curso y los días siguientes no se pueden seleccionar…  │ │ 03 oct 2026  [Cargar]    │
└──────────────────────────────────────────────────────────────────┘ └──────────────────────────┘
```

```tsx
<div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
  <PageHeader />                                   {/* título + MonthPicker */}
  <div className="flex flex-wrap items-stretch gap-4">
    <MonthCalendar className="min-w-0 flex-[3_1_600px]" />
    <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
      <DayPanel />
      <PendingList className="flex-1" />
    </div>
  </div>
</div>
```

Componentes:

```
components/reportes/
  useReportesMes.ts      ← lee historial del mes, calcula estados de cada día y pendientes
  useDiaDetalle.ts       ← SLA del día (sin Autopago ni exonerados) bajo demanda
  useCargaReporte.ts     ← máquina de estados de la carga (API → falla → Excel)
  MonthPicker.tsx
  MonthCalendar.tsx
  DayPanel.tsx
  PendingList.tsx
  CargaReporteDialog.tsx
  BorrarReporteDialog.tsx
```

shadcn adicional: `npx shadcn@latest add dialog progress` (`alert-dialog`, `popover` y `button` ya existen).

### 16.4 Tokens adicionales del calendario (`globals.css`)

```css
:root {
  --day-loaded-bg: #F0FAF4;      --day-loaded-border: #B7E4C7;
  --day-missing-bg: #FFF8EC;     --day-missing-border: #F2C27A;
  --day-today-bg: #F2F6FD;       --day-today-border: #0B4FC7;   --day-today-text: #0B4FC7;
  --day-off-bg: #F6F6F7;         --day-off-text: #B4B4BA;
  --day-selected-sub-ok: #4ADE80;  --day-selected-sub-warn: #FBBF24;   /* sobre la celda invertida */
  --action: #0B4FC7;             --action-hover: #083A94;       --action-foreground: #FFFFFF;
}
.dark {
  --day-loaded-bg: rgba(34, 197, 94, 0.08);   --day-loaded-border: rgba(34, 197, 94, 0.35);
  --day-missing-bg: rgba(245, 158, 11, 0.08); --day-missing-border: rgba(245, 158, 11, 0.45);
  --day-today-bg: rgba(91, 141, 239, 0.10);   --day-today-border: rgba(91, 141, 239, 0.55); --day-today-text: #7AA5F5;
  --day-off-bg: rgba(255, 255, 255, 0.025);   --day-off-text: rgba(237, 237, 239, 0.28);
  --day-selected-sub-ok: #15803D;  --day-selected-sub-warn: #8A4B00;
  --action: #2563EB;             --action-hover: #1D4ED8;       --action-foreground: #FFFFFF;
}
```

Exponerlos en `@theme inline` (`--color-day-loaded-bg: var(--day-loaded-bg);`, etc.). El botón azul de acción (`bg-action`) se usa **solo** para las acciones de carga y para "Ver auditoría del día". El resto de botones son `outline`.

### 16.5 Datos y estados de cada día

**Fuente:** colección `historial_reportes` (una fila por moneda y día; `id = "{MONEDA}_{YYYY-MM-DD}"`):

| Campo | Ejemplo | Uso |
|---|---|---|
| `id` | `CLP_2026-08-24` | Identifica el día; se usa para borrar |
| `fechaReporte` | `2026-08-24T00:00:00.000Z` | Día del reporte (mismo formato desde API y Excel) |
| `moneda` | `CLP` | Filtro |
| `totalRegistros` | `412` | Número que aparece en la celda y en "Retiros" |
| `subidoPor` | `Franklin M.` | "Subido por" |
| `subidoEl` | ISO | "Subido el" → `format(d, "dd/MM HH:mm")` |

**Consulta del mes** (en vez de traer todo el historial de la moneda como hace hoy el gestor):

```ts
const desde = `${yyyyMM}-01T00:00:00.000Z`;
const hasta = `${yyyyMMSiguiente}-01T00:00:00.000Z`;
query(
  collection(db, "historial_reportes"),
  where("moneda", "==", currency),
  where("fechaReporte", ">=", desde),
  where("fechaReporte", "<", hasta),
);
```

> Requiere un índice compuesto `moneda ASC + fechaReporte ASC` en Firestore. La consola muestra el enlace para crearlo la primera vez que se ejecuta la consulta.

**Estado de cada celda.** `hoy` es la fecha local del navegador; se compara como string `YYYY-MM-DD`, igual que en el dashboard:

| Estado | Condición | Seleccionable | Texto inferior |
|---|---|---|---|
| `cargado` | día < hoy **y** existe historial | sí | `totalRegistros` (ej. `412`) |
| `faltante` | día < hoy **y** no existe historial | sí | `faltante` |
| `en-curso` | día = hoy | **no** | `en curso` |
| `no-disponible` | día > hoy | **no** | — |
| (vacío) | relleno antes del día 1 o después del último día | — | — |

**Resumen del encabezado:** `"{cargados} de {disponibles} días cargados"`, donde los disponibles son los días anteriores a hoy en ese mes. Si el mes no tiene días disponibles, dice "Sin días disponibles".

**Pendientes por cargar:** los `faltante` del mes seleccionado, **del más reciente al más antiguo**, con `"{MONEDA} · {n} días de atraso"` (n = días entre esa fecha y hoy; "1 día" en singular). Si no hay ninguno: aviso verde "Todos los días de {mes} están cargados."

### 16.6 Panel del día seleccionado

**Sin selección:** ícono, "Selecciona un día" y "Elige un día del calendario para ver su reporte o cargarlo."

**Encabezado:** "Día seleccionado" (12px, muted) + título `"{Día de semana} {d} de {mes}"` (18px, 700) + chip `Cargado` (success-soft) o `Faltante` (warning-soft).

**Día cargado:**

| Fila | Valor |
|---|---|
| Retiros | `totalRegistros` (mono, 600) |
| SLA | **SLA sin Autopago ni exonerados** (mono, 600; `text-success-text` si ≥ 90%, `text-danger-text` si es menor), con la nota debajo "sin Autopago ni N exonerados" |
| Subido por | `subidoPor` |
| Subido el | `dd/MM HH:mm` (mono, muted) |

Acciones, a ancho completo y en este orden:
1. **Ver auditoría del día** (`bg-action`) → `router.push("/auditoria-diaria?fecha={fechaReporte}&moneda={moneda}")`, igual que el gestor actual.
2. **Cargar nuevamente** (outline) → abre el mismo flujo de carga (§16.7) para ese día.
3. **Borrar reporte** (`bg-danger-soft text-danger-text border-danger/30`) → `AlertDialog`:
   - título: "¿Borrar el reporte del 24 ago 2026?"
   - texto: "Se eliminarán los 412 retiros de CLP de ese día y el día volverá a quedar como faltante. Esta acción no se puede deshacer."
   - botones: "Cancelar" y "Borrar reporte" (`bg-destructive`)
   - al confirmar: `DELETE /api/delete-reporte?fecha={fechaReporte}&moneda={moneda}&id={id}`, toast "Reporte del 24 ago eliminado" y recarga del mes.

**SLA del día (sin Autopago ni exonerados).** No está en el historial; se calcula al seleccionar un día cargado, con la **regla única de SLA** (§7.2), la misma de la auditoría:

```ts
// useDiaDetalle.ts
const q = query(
  collection(db, "operaciones_retiros"),
  where("Moneda", "==", moneda),
  where("Fecha del reporte", "==", fechaReporte),   // "2026-08-24T00:00:00.000Z"
);
const snap = await getDocs(q);
let exo = 0, cumplidos = 0, evaluables = 0;
snap.forEach((d) => {
  const r = d.data();
  if (r.Operador === "Autopago") return;                    // Autopago no cuenta para el SLA
  if (isExonerated(r.comentarioBrecha)) { exo++; return; }
  evaluables++;
  if (r.Cumple === true) cumplidos++;
});
return { sla: evaluables ? (cumplidos / evaluables) * 100 : 0, exonerados: exo };
```

- Mientras carga, la fila SLA muestra un `Skeleton` de `w-14 h-4`.
- Cachear por `id` del historial (un `Map` en el hook o React Query) para no repetir la consulta al volver a un día.
- Invalidar la caché de ese día al cargarlo de nuevo o al borrarlo.
- Nota: `"sin Autopago ni 1 exonerado"` / `"sin Autopago ni N exonerados"`; si no hay exonerados, `"sin Autopago"`.

**Día faltante:**
- Aviso `bg-day-missing-bg border-day-missing-border text-warning-text`: "No hay retiros de CLP cargados para este día. Lleva 3 días de atraso."
- Botón **Cargar reporte** (`bg-action`, ícono `CloudDownload`, `h-[42px]`).
- Nota muted: "Primero se intenta la sincronización con el API. Si falla, podrás subir el archivo Excel de ese día."

### 16.7 Flujo de carga (modal)

Lo abren **Cargar reporte**, **Cargar nuevamente** y el botón **Cargar** de cada pendiente. Siempre es para **un día concreto**.

```
           ┌─────────────┐  éxito con retiros  ┌───────────┐
 abrir ──▶ │ sincronizando│ ─────────────────▶ │ guardando │ ──▶ cerrar + toast + refrescar
           └─────┬───────┘                     └───────────┘
                 │ error / sin retiros / red
                 ▼
           ┌─────────────┐  "Intentar de nuevo" ──▶ sincronizando
           │   falla     │
           │ + dropzone  │  archivo + "Procesar archivo"
           └─────┬───────┘ ─────────────────▶ ┌──────────────┐
                 │                            │ procesando   │ ──▶ cerrar + toast + refrescar
                 │                            └──────┬───────┘
                 │                                   │ error
                 └◀──────────────────────────────────┘ (vuelve a "falla" con el error del archivo)
```

**Estado `sincronizando`** (lo mismo que hace hoy `handleExtraerAPI` en `cargar-reportes`):

```ts
const fd = new FormData();
fd.append("currency", currency);
fd.append("subidoPor", userData?.nombre || "Usuario Desconocido");
fd.append("rol", userData?.rol || "");
fd.append("fecha", "2026-10-03");                       // yyyy-MM-dd del día elegido
const res = await fetch("/api/fetch-api-reporte", { method: "POST", body: fd, signal: abort.signal });
const json = await res.json();
```

- `json.success && json.operaciones.length > 0`: pasa a `guardando` y **guarda en Firestore igual que hoy**, en lotes de 500 en `operaciones_retiros` (`batch.set(doc(ref, item.idUnico), item.datos, { merge: true })`) y después `historial_reportes/{json.historial.id}`.
- `json.success` con 0 operaciones → pasa a `falla` con el mensaje **"El API no devolvió retiros para el 3 oct. Puedes intentar de nuevo o cargar el archivo Excel de ese día."**
- `!json.success`, status ≠ 2xx o excepción de red → pasa a `falla` con **"Fallo al conectar con el API"** y debajo "No se obtuvo respuesta para el 3 oct. Puedes intentar de nuevo o cargar el archivo Excel de ese día." Si viene `json.error`, se muestra en una segunda línea muted.
- **Cancelar** mientras sincroniza: `abort.abort()` y cierra el modal. Si la respuesta ya llegó y está en `guardando`, el botón Cancelar se deshabilita hasta que terminen los lotes, para no dejar un guardado a medias.

UI de `sincronizando`:
- Spinner `Loader2` 30px (`text-[var(--day-today-text)]`), "Extrayendo retiros del API…" (600) y "Esto puede tomar hasta un minuto." (muted).
- Barra `Progress` de 6px: animación **indeterminada que avanza hasta 90%** en ~30s con `ease-out`, salta a 100% al terminar.
- Pie con "Cancelar".

UI de `falla`:
1. Alerta `role="alert"` (`bg-danger-soft border-danger/30`): título en `text-danger-text` y descripción muted.
2. Botón **Intentar de nuevo** (`bg-action`, ícono `RotateCw`, ancho completo).
3. Separador "o carga por archivo".
4. **Dropzone** (`border-[1.5px] border-dashed border-input rounded-xl p-6 text-center`):
   - ícono `Upload`, "Arrastra el archivo o selecciónalo", "solo .xlsx o .xls · del 3 oct" (mono, muted) y el botón "Seleccionar archivo" (outline).
   - Acepta **un solo archivo**: `<input type="file" accept=".xlsx,.xls" hidden />`.
   - Al arrastrar encima: `border-[var(--action)] bg-[var(--day-today-bg)]`.
   - Si la extensión no es válida: texto `text-danger-text` "Solo se aceptan archivos .xlsx o .xls."
5. Fila del archivo elegido: ícono `FileSpreadsheet` (`text-success`), nombre (truncado), `"{tamaño} · listo para procesar"` (mono) y botón **X** (`aria-label="Quitar archivo"`).
6. Pie: **Cancelar** (outline) y **Procesar archivo** (`bg-action`, deshabilitado sin archivo).

**Estado `procesando`** (lo mismo que hace hoy `procesarTodos`, pero con un solo archivo):

```ts
const fd = new FormData();
fd.append("file", archivo);
fd.append("currency", currency);
fd.append("subidoPor", userData?.nombre || "Usuario Desconocido");
fd.append("rol", userData?.rol || "");
fd.append("fechaEsperada", "2026-10-03");     // ← opcional, ver abajo
const json = await (await fetch("/api/upload-reporte", { method: "POST", body: fd })).json();
```

- Éxito → cierra, toast `"Reporte del 3 oct cargado · 412 retiros"` y refresca.
- Error → vuelve a `falla` mostrando `json.error` en la alerta y **conserva el archivo seleccionado** para reintentar.

**Cambio recomendado en `/api/upload-reporte` (opcional, pequeño).** Hoy el endpoint procesa **todas** las fechas que vienen en el Excel. Como el modal es para un día concreto, conviene aceptar `fechaEsperada`:

```ts
const fechaEsperada = formData.get("fechaEsperada") as string | null;   // "2026-10-03"
// …después de agrupar por fecha:
if (fechaEsperada) {
  const clave = `${fechaEsperada}T00:00:00.000Z`;
  if (!reportesAgrupados[clave]) {
    return NextResponse.json(
      { success: false, code: "DATE_MISMATCH", error: `El archivo no contiene retiros del ${fechaEsperada}.` },
      { status: 400 },
    );
  }
  // procesar solo esa fecha
  for (const k of Object.keys(reportesAgrupados)) if (k !== clave) delete reportesAgrupados[k];
}
```

Sin `fechaEsperada`, el endpoint se comporta como hoy.

**Toast** (sonner): éxito `toast.success("Reporte del 3 oct cargado", { description: "412 retiros guardados" })`. Los errores se muestran **dentro del modal**, sin toast duplicado.

**Después de cargar o borrar:** volver a consultar el historial del mes, invalidar el SLA cacheado de ese día y dejar ese día seleccionado.

### 16.8 Selector de mes y año

- Encabezado: `[‹]` · botón `[📅 Octubre 2026 ⌄]` (min-w 176px) · `[›]`.
- `‹` va al mes anterior (sin límite inferior). `›` va al siguiente y está **deshabilitado en el mes actual**.
- El botón abre un `Popover` (w-64, `align="end"`):
  - fila superior: `‹` año `›`; el `›` se deshabilita cuando el año es el actual
  - grilla 3×4 con `Ene … Dic`; los **meses futuros** van deshabilitados (`text-[var(--day-off-text)]`); el mes activo va invertido (`bg-foreground text-background font-semibold`)
  - elegir un mes cierra el popover y **limpia la selección de día**
- Al cambiar de moneda también se limpia la selección de día y se recarga el mes.

### 16.9 Calendario: detalle visual

- Card estándar (`rounded-xl border bg-card p-[18px] flex flex-col gap-3.5`).
- Encabezado: `"{Mes} {año}"` (18px, 700) + resumen (13px, muted) a la izquierda; leyenda a la derecha (Cargado `bg-success`, Faltante `bg-warning`, En curso `var(--day-today-text)`, No disponible `bg-track`; cuadros de 9px `rounded-[3px]`).
- Cabecera de días: `Lun Mar Mié Jue Vie Sáb Dom` (12px, 500, muted). **La semana empieza el lunes.**
- Grilla: `grid grid-cols-7 gap-2`.
- **Celda** (`<button>`): `min-h-[82px] rounded-[10px] border px-2.5 py-[9px] flex flex-col justify-between items-start font-mono text-left`
  - número: 14px / 600
  - texto inferior: 12px, `truncate`
  - hover (si está habilitada): `ring-2 ring-input`
  - foco: `outline-2 outline-[var(--action)] outline-offset-2`

| Estado | Fondo | Borde | Número | Texto inferior |
|---|---|---|---|---|
| cargado | `day-loaded-bg` | `day-loaded-border` | `success-text` | `success-text` (cantidad) |
| faltante | `day-missing-bg` | `day-missing-border` | `warning-text` | `warning-text` ("faltante") |
| seleccionado (cargado) | `foreground` | `foreground` | `background` | `day-selected-sub-ok` |
| seleccionado (faltante) | `foreground` | `foreground` | `background` | `day-selected-sub-warn` |
| en curso | `day-today-bg` | `day-today-border` | `day-today-text` | "en curso" |
| no disponible | `day-off-bg` | `border` | `day-off-text` | — |
| relleno | transparente | `border` **dashed** | — | — |

- `aria-label` de cada celda: `"24 de agosto, cargado, 412 retiros"`, `"3 de octubre, faltante"`, `"6 de octubre, en curso, no disponible"`. `aria-pressed` en la seleccionada; `disabled` en en curso y no disponible.
- Nota al pie (12px, muted): "El día en curso y los días siguientes no se pueden seleccionar: su reporte se carga cuando la jornada cierra."
- **Mientras se consulta el mes:** la grilla muestra 35 `Skeleton` de `min-h-[82px] rounded-[10px]`, y el panel y los pendientes muestran su propio skeleton.

### 16.10 Validaciones de fecha (doble barrera)

- **Cliente:** las celdas de hoy y futuras están deshabilitadas, y `useCargaReporte` rechaza cualquier `fecha >= hoy` antes de llamar al API (por si llega un `?dia=` manipulado).
- **Servidor (recomendado):** en `/api/fetch-api-reporte`, devolver `400` si `fecha >= hoy` (zona horaria de operación) con `error: "No se puede cargar el día en curso ni días futuros."`. Hoy esa validación existe solo en el cliente.

### 16.11 Responsive

- Con poco ancho, el panel del día y los pendientes bajan debajo del calendario (`flex-wrap`).
- Por debajo de 640px: celdas `min-h-14 px-1.5 py-1.5`, número 13px y texto inferior 10px (la cantidad se sigue viendo; "faltante" pasa a "falt.").
- El modal de carga ocupa el ancho de la pantalla menos 16px por lado. En móvil se puede usar `Drawer` (hoja inferior) con el mismo contenido.

### 16.12 Checklist de Reportes

- [ ] `/cargar-reportes` y `/gestor-reportes` redirigen a `/reportes`; el sidebar muestra un solo ítem "Reportes".
- [ ] El mes actual abre por defecto; `›` está deshabilitado y el popover no deja elegir meses o años futuros.
- [ ] Hoy aparece "en curso" y no se puede seleccionar; los días futuros tampoco.
- [ ] Los días con historial muestran `totalRegistros`; los días pasados sin historial muestran "faltante" y aparecen en Pendientes, ordenados del más reciente al más antiguo y con su atraso correcto.
- [ ] Día cargado: Retiros, **SLA sin Autopago ni exonerados** (igual al que muestra la auditoría de ese día) con la nota de exonerados, Subido por y Subido el. No aparece "Origen".
- [ ] "Ver auditoría del día" abre `/auditoria-diaria` con `fecha` y `moneda`.
- [ ] "Borrar reporte" pide confirmación, borra, deja el día como faltante y lo agrega a Pendientes.
- [ ] "Cargar reporte" llama a `/api/fetch-api-reporte`; si responde bien, guarda en lotes y el día pasa a cargado.
- [ ] Si el API falla, devuelve error o no trae retiros, el modal ofrece "Intentar de nuevo" y la carga por Excel **en el mismo modal**.
- [ ] El Excel solo acepta `.xlsx`/`.xls` y un archivo; "Procesar archivo" llama a `/api/upload-reporte`. Si se implementó `fechaEsperada`, un archivo de otro día muestra el error sin guardar nada.
- [ ] Cancelar durante la sincronización aborta la petición; durante el guardado no se puede cancelar.
- [ ] Cambiar de moneda recarga el mes y limpia la selección.
- [ ] Todos los números van en `es-CL`.

---

## 17. Auditoría diaria

> **Archivo:** `app/(dashboard)/auditoria-diaria/page.tsx` (misma ruta) + componentes en `components/auditoria/`.
> **Referencia visual:** artboard *Auditoría diaria* del canvas.
> **Se conserva sin cambios:** la consulta a `operaciones_retiros`, el guardado de la exoneración en `comentarioBrecha` (los 4 motivos de `EXONERATION_REASONS` y el respeto por comentarios antiguos), la nota del día en `observaciones_diarias`, y la exportación a Excel y PDF.

### 17.1 Qué cambia

| Antes | Ahora |
|---|---|
| Tres tablas separadas (todos, brechas críticas, flash) con buscadores y paginaciones propias | **Una sola tabla** con pestañas **Todos / Incumplidos / Más rápidos / Exonerados**, un buscador y una paginación |
| Filtro de operador con `<Select>` | Panel lateral de filtros: **buscador**, **lista de operadores con cantidades** y **chips de nivel** |
| Gráficos de volumen por hora (07–23) y barras de agentes | **Retiros por hora 00–23 apilados** (dentro de SLA / brecha) y **Desempeño por operador** (barra cumplen/brechas) |
| Nota del día en una card aparte, siempre editable | **Notas de la jornada** al pie del panel de filtros, en modo lectura con botón **Editar nota** |
| Modal de comentario con estilo propio (`slate-*`, switch hecho a mano) | **El mismo modal y la misma lógica**, con tokens del tema, `Switch` de shadcn y una franja con los datos del retiro |
| Fecha por defecto: **hoy** (que no tiene datos) | Fecha por defecto: **ayer** |

### 17.2 Datos

**Consulta** (igual que hoy):

```ts
const fechaDB = `${selectedDate}T00:00:00.000Z`;
query(
  collection(db, "operaciones_retiros"),
  where("Fecha del reporte", "==", fechaDB),
  where("Moneda", "==", currency),
);
```

Se mapea cada documento a `OperacionRow` igual que hoy (`id`, `hora` desde "Fecha de la operación", `alias`, `cantidad`, `tiempo`, `cumple`, `operador`, `nivel`, `comentarioBrecha`) y se ordena por hora.

**Parámetros de la URL:**

| Param | Uso |
|---|---|
| `fecha` | Día a mostrar (`YYYY-MM-DD` o ISO; se toma `split("T")[0]`). Si falta, es **inválida, o es hoy o una fecha futura → ayer**. |
| `moneda` | **Nuevo:** si viene y está dentro de `monedasPermitidas` del usuario, se aplica con `setCurrency(moneda)` al montar. Así, "Ver auditoría del día" desde Reportes abre la moneda correcta. |
| `operador` | **Nuevo:** si viene, preselecciona ese operador en el panel de filtros (lo usa "Ver sus retiros en la auditoría" desde la evaluación, §18.9). |

Al cambiar de día con las flechas o el selector, actualizar la URL con `router.replace` (`?fecha=…&moneda=…`), para que el enlace se pueda compartir y el botón Atrás funcione.

### 17.3 Cálculos (regla única de §7.2: sin Autopago ni exonerados)

Sea `scope` = retiros del día filtrados por **nivel** y **operador** (la búsqueda y la pestaña solo afectan a la tabla, no a las tarjetas ni a los gráficos).

| Tarjeta | Valor | Texto secundario |
|---|---|---|
| **SLA del día** | `cumplidos / evaluables × 100`, con evaluables = manuales no exonerados | `"{cumplidos} de {evaluables} bajo 25 min · sin Autopago ni exonerados"`. Valor en `text-danger-text` si es menor a 90% |
| **Tiempo promedio** | `Σ tiempo / n` de los evaluables, en min | `"Solo gestión manual · meta 25 min"` |
| **Brechas** | manuales con `cumple === false` **y no exonerados** (en `text-danger-text`) + `retiros` | `"{n} ya exoneradas"` (exonerados con `cumple === false`); `"Ninguna exonerada"` si es 0 |
| **Autopago** | `autopago / total × 100` sobre los retiros del día filtrados **solo por nivel** | `"{autopago} retiros automáticos de {total}"` |

> Exonerar o quitar una exoneración **recalcula todo al instante** (tarjetas, gráficos, contadores de pestañas), sin volver a consultar Firestore: se actualiza `rawOps` en memoria igual que hoy.

**Retiros por hora:** 24 columnas (`00`–`23`) sobre `scope`. Cada columna apila **brecha** arriba (no cumple y no exonerado, `bg-danger`) y **dentro de SLA** abajo (el resto, incluidos Autopago y exonerados, `--chart-in-sla`). El total va encima de la columna (mono, 10px) y la altura es proporcional al máximo del día. `title`/tooltip: `"19:00 · 52 retiros · 6 en brecha"`.

**Desempeño por operador:** por cada operador humano (sin Autopago) del día filtrado por nivel: `cumplen` = no exonerados con `cumple`, `brechas` = no exonerados sin `cumple`. Se muestra `"{cumplen} / {brechas}"` (las brechas en `text-danger-text`) y una barra de 6px con los dos segmentos proporcionales. Orden: **menor proporción de brechas primero**.

**Contadores del panel de operadores:** cantidad total de retiros de cada operador en el día (filtrado por nivel). "Todos" es el total; "Autopago" va segundo y luego los operadores en orden alfabético.

### 17.4 Layout

```tsx
<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 pb-9 pt-5 md:px-7">
  <AuditHeader />                                         {/* volver, título, fecha, exportar */}
  <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
    <KpiCard … /> ×4                                       {/* mismo KpiCard del dashboard (§8.4) */}
  </div>
  <div className="flex flex-wrap items-stretch gap-3.5">
    <HourlyChart className="min-w-0 flex-[3_1_560px]" />
    <OperatorPerformance className="min-w-0 flex-[2_1_340px]" />
  </div>
  <div className="flex flex-wrap items-stretch gap-3.5">
    <FiltersPanel className="flex-[1_1_230px]" />
    <AuditTable className="min-w-0 flex-[4_1_640px]" />
  </div>
</div>
```

**Encabezado:**
- Enlace `← Volver a Reportes` (13px, muted) → `/reportes?mes={YYYY-MM}&dia={DD}`.
- `<h1>` `"Lunes 24 de agosto, 2026"` (26px, 700) + `· moneda CLP` (16px, 400, muted).
- A la derecha: `[‹]` `[📅 24 ago 2026]` `[›]`, un separador vertical y los botones **Excel** y **PDF** (outline, h-9, con `FileSpreadsheet` en `text-success-text` y `FileText` en `text-danger-text`).
  - `‹`/`›` mueven un día; `›` se deshabilita en **ayer**.
  - El botón de fecha abre un `Popover` con `Calendar mode="single"` (`locale={es}`, `disabled={{ after: ayer }}`).

**Tarjetas:** usar el `KpiCard` del dashboard (§8.4) **sin pastilla de tendencia**. Íconos: `CircleCheck` (`text-icon-green`), `Clock` (`text-icon-amber`), `TriangleAlert` (`text-danger-text`) y `Bot` (`text-icon-violet`).

### 17.5 Gráficos

**Retiros por hora:** se puede hacer con un `BarChart` de Recharts (`stackId="h"`, dos `Bar`: `dentro` con `fill="var(--chart-in-sla)"` y `brecha` con `fill="var(--danger)"`, `radius` solo en la barra superior, `LabelList` arriba con el total) o con un grid CSS de 24 columnas como en el mockup. Encabezado: "Retiros por hora" + leyenda "Dentro de SLA" / "Brecha".

Token nuevo:

```css
:root { --chart-in-sla: #2F6FE0; }
.dark { --chart-in-sla: #5B8DEF; }
```

**Desempeño por operador:** encabezado "Desempeño por operador" + "cumplen / brechas" (12px, muted). Cada fila: nombre (13px, 500), cifras a la derecha (mono) y barra `h-1.5 rounded-full bg-track` con `bg-success` y `bg-danger`.

### 17.6 Panel de filtros

Card `flex flex-col gap-[18px] p-4`:

1. **Buscar jugador:** `Label` + `Input type="search"` con ícono `Search`, placeholder "Usuario o ID". Filtra por `alias` o `id` (sin distinguir mayúsculas) y vuelve a la página 1.
2. **Operador:** lista de `<button aria-pressed>` de `h-8`. Activo: `bg-[var(--brand-soft)] text-[var(--brand)] font-semibold`. Contador a la derecha (mono, muted). Elegir uno vuelve a la página 1.
3. **Nivel:** chips `rounded-full h-7 px-3 text-xs border` → `Todos · Estándar · Nivel 2 · Nivel 3 · Nivel 4`. Activo: `bg-action text-action-foreground border-action`. Cambiar el nivel **reinicia el operador a "Todos"**.
4. **Notas de la jornada** (con `mt-auto` y separador arriba):
   - lectura: caja `bg-muted border rounded-lg p-3 text-[13px] whitespace-pre-line` con la nota, o "Sin notas para esta jornada." (muted); botón outline **Editar nota** o **Agregar nota**
   - edición: `Textarea` (4 filas, mismo placeholder que hoy) + **Cancelar** (outline) y **Guardar** (`bg-action`)
   - guardar: mismo `setDoc(doc(db, "observaciones_diarias", \`${currency}_${selectedDate}\`), { observacion, fechaActualizacion }, { merge: true })` y toast "Nota de la jornada guardada"

### 17.7 Tabla

**Pestañas** (`Tabs` de shadcn, estilo subrayado: `border-b-2`, activa `border-[var(--brand)] font-semibold`):

| Pestaña | Contenido | Orden | Color del contador |
|---|---|---|---|
| Todos | todos los retiros (`scope` + búsqueda) | hora ascendente | muted |
| Incumplidos | `cumple === false` y **no exonerado** | tiempo descendente | `text-danger-text` |
| Más rápidos | manuales con `tiempo < 1` (el "Flash" actual) | tiempo ascendente | `text-success-text` |
| Exonerados | `cumple === false` y exonerado | hora ascendente | muted |

A la derecha de las pestañas: `"1–12 de 412"` (mono, 12px, muted).

**Columnas** (`<table>` real; contenedor `overflow-x-auto`, `min-w-[900px]`; filas de 48px; hover `bg-foreground/[0.03]`):

| Columna | Contenido | Estilo |
|---|---|---|
| Hora | `HH:mm` | mono, muted |
| Usuario | `alias` | 600 |
| Nivel | `nivel` | muted |
| Operador | `operador` | — |
| Tiempo | `18,4 min` | derecha, mono, 600; `text-danger-text` si `cumple === false` |
| Estado | badge | `Cumple` (success-soft), `Brecha` (danger-soft), `Exonerado` (`bg-foreground/[0.08] text-muted-foreground`) |
| Comentario de brecha | `comentarioBrecha` | "—" (muted) si cumple; **"Sin comentario"** (`text-warning-text`) si es brecha sin motivo; truncado a 240px |
| Exoneración | botón 32×32 | solo si `cumple === false`: **`+`** si es brecha, **lápiz** si ya está exonerado |

- Botón de exoneración: `size-8 rounded-lg border border-input text-[var(--brand)] hover:bg-[var(--brand-soft)]`, con `aria-label` "Registrar exoneración de {alias}" / "Editar exoneración de {alias}" y `Tooltip` con el mismo texto.
- Sin resultados: fila única "No hay retiros que coincidan con los filtros."
- **Pie:** texto de ayuda a la izquierda ("Usa el botón de la última columna para registrar o quitar una exoneración."; en *Más rápidos*: "Retiros manuales resueltos en menos de 1 minuto.") y paginación a la derecha: `‹`, hasta 5 números (el activo en `bg-action`) y `›`. **12 filas por página.** Cambiar de pestaña, búsqueda, operador o nivel vuelve a la página 1.

### 17.8 Modal de exoneración (el del sistema actual, con el estilo nuevo)

La lógica **no cambia**: es exactamente la de `handleSaveComment` y el spec `2026-07-01-auditoria-exoneracion-switches-design.md`.

- Se abre desde el botón de la columna Exoneración. Al abrir: `selectedOpId = op.id` y `selectedReason = EXONERATION_REASONS.includes(op.comentarioBrecha) ? op.comentarioBrecha : null`.
- Componente: `Dialog` de shadcn, `max-w-[440px]`.
- **Encabezado:** ícono `MessageSquare` (`text-[var(--brand)]`) + "Comentario de brecha" + botón X (`aria-label="Cerrar"`).
- **Franja del retiro (nuevo, solo visual):** `bg-muted rounded-[9px] px-3 py-2.5 text-[13px] flex flex-wrap gap-x-3.5 gap-y-1.5` → alias (600) · hora (mono, muted) · operador (muted) · tiempo (`text-danger-text`, mono, 600).
- Texto: "Selecciona el motivo de la exoneración de este retiro." (13px, muted).
- **4 filas** (`py-2.5 border-b`), cada una con el motivo y un `Switch` de shadcn (`data-[state=checked]:bg-success`):
  - mutuamente excluyentes: con uno activo, los otros quedan `disabled` y con `opacity-45`
  - apagar el activo deja `selectedReason = null`
  - cada `Switch` lleva `aria-labelledby` apuntando al texto de su motivo
- **Comentario antiguo:** si `comentarioBrecha` existe y no es uno de los 4 motivos, se muestra debajo: `"Comentario anterior: “…”"` (12px, italic, `bg-muted border rounded-lg p-2.5`).
- **Pie:** **Cancelar** (outline) y **Guardar** (`bg-action`, ícono `Save`; `Loader2` girando mientras guarda).
- Guardar: `valueToSave = selectedReason ?? (comentarioAntiguo ? comentarioAntiguo : "")` → `updateDoc(doc(db, "operaciones_retiros", id), { comentarioBrecha: valueToSave })` → actualizar `rawOps` en memoria → toast:
  - "Retiro de {alias} exonerado" si `valueToSave` no está vacío
  - "Exoneración quitada a {alias}" si quedó vacío

### 17.9 Exportación

**Excel:** igual que hoy (`handleExportExcel`: hoja "Retiros" con las filas de `scope` y hoja "Flash (<1 min)"). Dos ajustes:
- se exporta lo que se ve: `scope` (nivel + operador) + búsqueda;
- se agrega la columna `"Exonerado": "Sí" | "No"`.

Nombre: `Reporte_{fecha}_{moneda}_{operador}.xlsx`.

**PDF:** igual que hoy (`toPng` de `#reporte-gerencial` a 1200px + `jsPDF` A4 en varias páginas). Con el modo oscuro hay que ajustar el fondo:
- **Recomendado:** forzar el tema claro solo durante la captura. Quitar `dark` de `document.documentElement` antes de los dos `requestAnimationFrame` y restaurarlo en el `finally`. Así el PDF siempre sale claro y legible al imprimir.
- Reemplazar `backgroundColor: "#f8fafc"` por `getComputedStyle(document.documentElement).getPropertyValue("--background")`.
- El overlay "Generando PDF" pasa a un `Dialog` sin botón de cierre, con `Loader2` y el texto actual.
- `#reporte-gerencial` envuelve el encabezado, las tarjetas y los gráficos. La tabla paginada **no** entra en el PDF (igual que hoy).

### 17.10 Responsive

- Con poco ancho, el panel de filtros baja encima de la tabla (`flex-wrap`). Por debajo de 640px, la lista de operadores pasa a un `Select` y los chips de nivel se desplazan en horizontal.
- La tabla se desplaza dentro de su card (`overflow-x-auto`); la columna Exoneración puede ir `sticky right-0 bg-card` para que el botón esté siempre a mano.
- En el gráfico por hora, por debajo de 640px se muestra una etiqueta de hora cada 3 (`00, 03, 06…`).

### 17.11 Checklist de Auditoría

- [ ] Sin `fecha` en la URL, abre en **ayer**; con `fecha` de hoy o futura, también abre en ayer. `›` y el calendario no dejan pasar de ayer.
- [ ] Con `?moneda=PEN` (y permiso para PEN), la vista abre en PEN.
- [ ] SLA del día y Tiempo promedio **sin Autopago ni exonerados**; coinciden con el SLA de ese día en Reportes y en el dashboard (rango personalizado de un día).
- [ ] Brechas cuenta solo las no exoneradas y el texto secundario dice cuántas ya se exoneraron.
- [ ] Filtrar por nivel u operador actualiza tarjetas, gráficos y contadores; la búsqueda y la pestaña solo cambian la tabla.
- [ ] Solo las filas que no cumplen tienen botón: `+` en Brecha y lápiz en Exonerado.
- [ ] El modal precarga el motivo actual; los switches se excluyen entre sí; un comentario antiguo se muestra y se conserva si no se elige motivo.
- [ ] Guardar actualiza Firestore, la fila (estado, comentario, botón), las tarjetas, el gráfico por hora, el desempeño por operador y los contadores de pestañas, sin recargar.
- [ ] Apagar todos los motivos y guardar quita la exoneración (salvo que hubiera un comentario antiguo).
- [ ] La nota de la jornada se lee, se edita y se guarda en `observaciones_diarias`.
- [ ] Excel con hoja Flash y columna Exonerado; PDF claro y legible aunque la app esté en modo oscuro.
- [ ] Todos los números van en `es-CL`.

---

## 18. Evaluación diaria

> **Archivo:** `app/(dashboard)/evaluacion-diaria/page.tsx` (misma ruta) + componentes en `components/evaluacion/`.
> **Referencia visual:** artboard *Evaluación diaria* del canvas (y el aviso nuevo arriba del dashboard, artboard *Layout + Dashboard*).
> **Colección:** `evaluaciones_desempeno` (sin cambios de estructura; se agregan campos opcionales, ver §18.3). **Nuevo documento:** `configuracion/evaluacion`.

### 18.1 Qué cambia

| Antes | Ahora |
|---|---|
| Una tabla ancha (min 1200px) con inputs numéricos, switches y un modal por fila | **Lista de operadores** a la izquierda y **ficha de evaluación** a la derecha: se evalúa a uno por vez con todo el contexto |
| Puntualidad y proactividad con `<input type="number">` | **10 botones (1–10)** por criterio (`radiogroup`); no se pueden ingresar valores fuera de rango |
| Observación del inconveniente en un modal | **Textarea dentro de la ficha**, visible al activar "Tuvo un inconveniente". Es **obligatoria** para confirmar |
| La nota final aparece como un número | La nota se ve **desglosada** (SLA 30% · Tiempo 30% · Puntualidad 20% · Proactividad 20%) y se actualiza en vivo |
| Una vez confirmada no se puede corregir | **Reabrir evaluación**, disponible para **cualquier usuario** |
| Jefes excluidos escritos en el código (`JEFES_EXCLUIDOS`) | **Lista editable a mano** en la propia vista, guardada en Firestore. Las personas no necesitan usuario en el sistema |
| — | **Resumen del día**: progreso, nota promedio, mejor nota y operadores a revisar (bajo 6) |
| — | **Evolución de la nota** de cada operador (7 o 30 días) |
| — | **Aviso de evaluaciones pendientes** de días anteriores, en la propia vista y en el dashboard |
| — | **Exportar PDF** con la evaluación del día |
| — | **Confirmar y siguiente**: confirma y salta al próximo pendiente |
| Fecha por defecto: hoy (sin datos todavía) | Fecha por defecto: **ayer**; no se puede ir a hoy ni a días futuros |

### 18.2 Reglas de cálculo (sin cambios)

Se mantienen exactamente las funciones actuales:

```ts
// lib/evaluacion.ts  (mover aquí desde la página)
export const calcularPuntajeSLA = (pct: number) =>
  pct >= 100 ? 10 : pct <= 0 ? 0 : Number((pct / 10).toFixed(1));

export const calcularPuntajeTiempo = (min: number) => {
  if (min >= 0 && min <= 10) return 10;
  if (min <= 15) return 9;
  if (min <= 20) return 8;
  if (min <= 25) return 7;
  if (min <= 30) return 6;
  if (min <= 35) return 5;
  if (min <= 40) return 4;
  if (min <= 45) return 3;
  return 0;
};

export const PESOS = { sla: 0.3, tiempo: 0.3, puntualidad: 0.2, proactividad: 0.2 } as const;

export const calcularPuntajeFinal = (ev: Evaluacion) =>
  (ev.puntajeSla || 0) * PESOS.sla +
  (ev.puntajeTiempo || 0) * PESOS.tiempo +
  (Number(ev.puntualidad) || 0) * PESOS.puntualidad +
  (Number(ev.proactividad) || 0) * PESOS.proactividad;

export const TRAMOS_TIEMPO = [
  { hasta: 10, pts: 10, label: "≤10" }, { hasta: 15, pts: 9, label: "15" },
  { hasta: 20, pts: 8, label: "20" },   { hasta: 25, pts: 7, label: "25" },
  { hasta: 30, pts: 6, label: "30" },   { hasta: 35, pts: 5, label: "35" },
  { hasta: 40, pts: 4, label: "40" },   { hasta: 45, pts: 3, label: "45" },
  { hasta: Infinity, pts: 0, label: "+45" },
] as const;
```

Las métricas automáticas siguen la **regla única (§7.2)**: SLA y tiempo promedio **sin Autopago ni exonerados**, igual que la sincronización actual.

**Colores de nota:** `≥ 8` → `text-success-text` · `≥ 6` → `text-warning-text` · `< 6` → `text-danger-text`. La nota se muestra con 1 decimal en la lista y con 2 en la ficha y el resumen.

### 18.3 Modelo de datos

**`evaluaciones_desempeno/{YYYY-MM-DD}_{Operador_con_guiones}`** (se mantienen todos los campos actuales):

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `fecha`, `operador`, `grupoMoneda` | — | igual que hoy |
| `totalRetiros`, `cumplimientoSlaPct`, `tiempoPromedioMin`, `puntajeSla`, `puntajeTiempo` | number | automáticos (sincronización) |
| `puntualidad`, `proactividad` | number 1–10 | cualitativos |
| `completoTurno`, `tuvoInconveniente` | boolean | |
| `comentarioInconveniente` | string | **obligatorio** si `tuvoInconveniente` |
| `puntajeFinal` | number | se guarda al confirmar |
| `estado` | `"Pendiente" \| "Confirmado"` | |
| `confirmadoEl` | ISO | igual que hoy |
| **`confirmadoPor`** | string | **nuevo:** `userData.nombre` al confirmar |
| **`exonerados`** | number | **nuevo (opcional):** retiros exonerados del operador ese día, para mostrar "· 2 exonerados" |
| **`retirosEvaluables`** | number | **nuevo:** retiros sin exonerar del día (base del SLA y del tiempo). Lo usa el cierre mensual para calcular exacto (§19.4) |
| **`retirosCumplidos`** | number | **nuevo:** evaluables con `Cumple === true` |
| **`tiempoTotalMin`** | number | **nuevo:** suma de `Tiempo` de los evaluables |
| **`reaperturas`** | `{ por: string; el: string }[]` | **nuevo:** historial de reaperturas (`arrayUnion`) |

**`configuracion/evaluacion`** (documento único, nuevo):

```ts
{
  operadoresExcluidos: string[];   // ej. ["Franklin Sanchez", "Marvin", "Evelyn"]
  actualizadoEl: string;           // ISO
  actualizadoPor: string;          // userData.nombre
}
```

> **Migración:** al desplegar, crear el documento con los valores actuales de `JEFES_EXCLUIDOS` y borrar la constante del código. Si el documento no existe, el hook usa `[]`.

**Reglas de Firestore:** lectura y escritura de `configuracion/evaluacion` para cualquier usuario autenticado con acceso a la evaluación diaria (misma regla que `evaluaciones_desempeno`).

### 18.4 Operadores excluidos (lista manual)

**Normalización** (para comparar sin errores de mayúsculas o espacios):

```ts
export const normalizarNombre = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
```

**Dónde se aplica:**
1. **Sincronización** (§18.5): se reemplaza `JEFES_EXCLUIDOS.includes(op)` por `excluidos.has(normalizarNombre(op))`.
2. **Lectura de evaluaciones:** al cargar el día se filtran las evaluaciones cuyo `operador` esté excluido, para que una persona excluida después de sincronizar desaparezca de la vista sin tener que borrar documentos.

**UI:** botón outline en el encabezado `"[ícono UserMinus] {n} excluidos"` que abre un `Popover` (w-80):
- título "Excluidos de la evaluación" y la ayuda: "Sus retiros siguen contando en las métricas del equipo, pero no reciben evaluación diaria. No necesitan tener usuario en el sistema."
- formulario en línea: `Input` (placeholder "Nombre como aparece en Operador") + botón **Agregar** (`bg-action`); Enter también agrega
- validaciones (texto `text-warning-text` 12px debajo):
  - vacío → "Escribe un nombre."
  - duplicado (comparando normalizado) → "{nombre} ya está excluido."
- lista de nombres con avatar de inicial y botón **X** (`aria-label="Quitar a {nombre} de los excluidos"`)
- vacía → "No hay nadie excluido."
- **sugerencias:** chips punteados `+ {nombre}` con los operadores (sin Autopago) que tuvieron retiros ese día y no están excluidos. Así el nombre queda idéntico al de los retiros.

**Guardar:** cada alta o baja hace `setDoc(doc(db, "configuracion", "evaluacion"), { operadoresExcluidos, actualizadoEl, actualizadoPor }, { merge: true })` y muestra el toast "{nombre} excluido de la evaluación" o "{nombre} vuelve a evaluarse". Si quitas a alguien, hay que sincronizar el día para crearle su evaluación (el toast lo sugiere con la acción "Sincronizar").

### 18.5 Sincronización ("Sincronizar operadores")

La lógica de `handleSincronizar` se mantiene: consulta `operaciones_retiros` del día, agrupa por operador, salta Autopago y excluidos, filtra por `getMonedasByRol` y calcula SLA y tiempo sin exonerados. **Hay que corregir un problema que existe hoy:**

> ⚠️ Hoy la sincronización hace `batch.set(docRef, { …, estado: "Pendiente", puntualidad: 10, proactividad: 10, completoTurno: true, tuvoInconveniente: false, comentarioInconveniente: "" }, { merge: true })`. Si se vuelve a sincronizar un día ya evaluado, **se pierden las evaluaciones confirmadas** (vuelven a Pendiente con valores por defecto).

**Corrección:** leer primero los documentos existentes del día y escribir según el caso:

```ts
const existentes = new Map(
  (await getDocs(query(collection(db, "evaluaciones_desempeno"), where("fecha", "==", fechaISO))))
    .docs.map((d) => [d.id, d.data() as Evaluacion]),
);

const automaticos = {
  id, fecha: fechaISO, operador: op, grupoMoneda: grupo,
  totalRetiros, cumplimientoSlaPct, tiempoPromedioMin, exonerados,
  retirosEvaluables: totalEvaluable, retirosCumplidos: cumpleEvaluable, tiempoTotalMin: tiempoEvaluable,
  puntajeSla: calcularPuntajeSLA(slaPct),
  puntajeTiempo: calcularPuntajeTiempo(avgTime),
};

if (!existentes.has(id)) {
  // Nuevo: automáticos + valores por defecto
  batch.set(docRef, { ...automaticos, estado: "Pendiente", puntualidad: 10, proactividad: 10,
                      completoTurno: true, tuvoInconveniente: false, comentarioInconveniente: "" });
} else {
  // Existente: SOLO actualizar automáticos. No tocar estado ni cualitativos.
  batch.update(docRef, automaticos);
  // Si ya estaba confirmada, recalcular su puntajeFinal con los nuevos automáticos
  const prev = existentes.get(id)!;
  if (prev.estado === "Confirmado") batch.update(docRef, { puntajeFinal: calcularPuntajeFinal({ ...prev, ...automaticos }) });
}
```

- Botón outline `"[RefreshCw] Sincronizar operadores"`. Mientras corre: ícono girando y texto "Sincronizando…", deshabilitado.
- Toast de éxito: "Se actualizaron los puntajes automáticos de {n} operadores". Sin retiros: "No se encontraron operaciones de tu grupo para esta fecha." (igual que hoy).
- **Estado vacío del día** (no hay evaluaciones): en la lista, "Aún no hay evaluaciones para este día" con el botón **Sincronizar operadores** en `bg-action`.

### 18.6 Layout

```
Evaluación diaria                                   [‹][📅 5 oct 2026][›] [⟳ Sincronizar] [PDF Exportar] [👤− 3 excluidos]
Panel internacional · Domingo 5 de octubre, 2026
[⏱ 7 evaluaciones pendientes de días anteriores  (4 oct · 2) (30 sep · 2) …]       ← solo si hay

[Progreso del día] [Nota promedio] [Mejor nota] [A revisar]

┌── Operadores ───────────────┐ ┌── Ficha ─────────────────────────────────────────────┐
│ [Todos 5|Pendientes 3|Conf. 2]│ │ (J) Juan  [Pendiente]        Ver sus retiros en la auditoría ↗ │
│ (A) Angel [Confirmada]   9,6 │ │ Evolución de la nota  [7 días|30 días]                │
│ (G) Gabriel [Pendiente]  9,1 │ │ Puntajes automáticos  (SLA)  (Tiempo + escala)        │
│ …                            │ │ Evaluación cualitativa  Puntualidad [1…10]  Proactividad [1…10] │
└──────────────────────────────┘ │ Control de turno  [Completó el turno] [Tuvo un inconveniente] │
                                 │ Nota final  8,58 / 10  ▇▇▇▇▇▇▇▇ (desglose)             │
                                 │ ─────────────────────────────────────────────────── │
                                 │ texto de ayuda           [Confirmar] [Confirmar y siguiente →] │
                                 └──────────────────────────────────────────────────────┘
```

```tsx
<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
  <EvalHeader />
  <PendingDaysBar />                                   {/* §18.11 */}
  <DaySummary />                                       {/* 4 KpiCard */}
  <div className="flex flex-wrap items-start gap-4">
    <OperatorList className="min-w-0 flex-[1_1_320px]" />
    <EvaluationSheet className="min-w-0 flex-[2_1_560px]" />
  </div>
</div>
```

```
components/evaluacion/
  useEvaluacionesDia.ts     ← carga, filtra excluidos, actualiza en memoria, confirma, reabre
  useExcluidos.ts           ← lee/escribe configuracion/evaluacion
  useSincronizacion.ts      ← §18.5
  useHistorialOperador.ts   ← §18.10
  usePendientesAnteriores.ts← §18.11
  EvalHeader.tsx · ExcludedPopover.tsx · PendingDaysBar.tsx · DaySummary.tsx
  OperatorList.tsx · EvaluationSheet.tsx · ScoreTrend.tsx · TimeScale.tsx
  RatingScale.tsx · FinalScore.tsx · ExportPdfDialog.tsx
```

**Subtítulo:** `"Panel {Administrador | Internacional | Nacional} · {Día} {d} de {mes}, {año}"`, según `parseUserRole` (igual que hoy).

**Navegación de fecha:** `‹`/`›` y un `Popover` con `Calendar mode="single"` (`disabled={{ after: ayer }}`). Sincronizar la URL con `?fecha=YYYY-MM-DD`.

### 18.7 Resumen del día (4 tarjetas)

Usan el `KpiCard` del dashboard (§8.4), sin pastilla de tendencia.

| Tarjeta | Valor | Detalle |
|---|---|---|
| Progreso del día | `{confirmadas}` + "de {total} confirmadas" | barra `h-1.5` `bg-success` al % confirmado |
| Nota promedio del equipo | promedio de `calcularPuntajeFinal` de **todas** (2 decimales, color por umbral) | "Incluye pendientes con sus valores actuales" |
| Mejor nota | nota máxima (en `text-success-text`) + nombre | "SLA {x}% · {y} min" del operador |
| A revisar | cantidad con nota < 6 (`text-danger-text` si > 0) + "con nota bajo 6" | nombres separados por coma, o "Nadie bajo 6 hoy" |

### 18.8 Lista de operadores

- Card `p-3.5`. Arriba, un segmented (`ToggleGroup`) **Todos / Pendientes / Confirmadas** con contadores (mono).
- Cada operador es un `<button aria-pressed>` (`rounded-[10px] border p-3 flex items-center gap-3`):
  - avatar 36px con inicial
  - nombre (600) + chip `Pendiente` (warning-soft) / `Confirmada` (success-soft)
  - línea mono muted: `"SLA 86,2% · 18,7 min · 82 ret."`
  - nota a la derecha (22px, 700, color por umbral)
- Seleccionado: `border-[var(--brand)] bg-brand-soft`. Orden: alfabético (igual que hoy).
- Sin elementos en el filtro: "No quedan evaluaciones pendientes." / "Aún no hay evaluaciones confirmadas."
- **Selección por defecto:** el primer pendiente; si no hay, el primero de la lista.

### 18.9 Ficha de evaluación

**Encabezado:** avatar 44px (`bg-brand-soft text-brand`), nombre (18px, 700), chip de estado y debajo `"{grupo} · {totalRetiros} retiros gestionados · {n} exonerados"`. A la derecha, el enlace **"Ver sus retiros en la auditoría ↗"** → `/auditoria-diaria?fecha=…&moneda=…&operador={nombre}` (la auditoría preselecciona ese operador; agregar la lectura de `operador` al §17.2).

**Puntajes automáticos** (2 tiles `rounded-[10px] border bg-muted p-3.5`, solo lectura):
- **SLA:** "30% de la nota" · valor `86,2%` (22px, 700) · `8,6 / 10` (mono) · barra al `puntajeSla × 10 %` · ayuda "Puntaje = SLA ÷ 10".
- **Tiempo promedio:** "30% de la nota" · `18,7 min` · `8 / 10` · **escala de 9 tramos** (`TimeScale`): grid de 9 columnas con una barra de 6px cada una (`bg-track`; el tramo actual en `--chart-in-sla`) y la etiqueta debajo (`≤10 … +45`, mono 10px). Ayuda: "≤10 min = 10 · cada 5 min resta 1 · más de 45 min = 0". `title` de cada tramo: "Hasta 20 min → 8 pts".
- Encabezado de sección: "Puntajes automáticos" + "Calculados de los retiros del día · sin Autopago ni exonerados".

**Evaluación cualitativa** (`RatingScale`, una por criterio):
- etiqueta (500) + valor `"9 / 10"` (mono) a la derecha
- `role="radiogroup"` con `aria-labelledby` + 10 botones `role="radio" aria-checked` en `grid grid-cols-10 gap-1`, de `h-[34px]`
- activo `bg-action text-action-foreground`; resto `border-input bg-card`
- teclado: ← → cambian el valor (patrón radiogroup)
- confirmada: botones deshabilitados y texto muted

**Control de turno** (caja `border rounded-[10px]`, 2 filas con `Switch` de shadcn):
- "Completó el turno" — ayuda "Desmárcalo si salió antes o llegó tarde a su jornada." — activo `bg-success`
- "Tuvo un inconveniente" — ayuda "Problemas técnicos, ausencias o cualquier evento del turno." — activo `bg-warning`
  - al activarlo se despliega `Label` "Observación del inconveniente" + `Textarea` (3 filas, placeholder "Describe qué pasó y cómo afectó el turno…")
  - si está vacía: borde `border-warning` y el texto "Agrega una observación para poder confirmar."
  - al desactivarlo, el texto escrito se conserva en memoria; al confirmar sin inconveniente se guarda `comentarioInconveniente: ""`

**Nota final** (`FinalScore`, caja `rounded-xl border bg-muted p-4`):
- "Nota final" + valor 36px (700, color por umbral) + "/ 10"
- barra de 10px dividida en 4 segmentos, cada uno de ancho `aporte × 10 %`:
  - SLA `bg-success`
  - Tiempo `--chart-in-sla`
  - Puntualidad `--eval-violet` (`#6D4FD8` / dark `#A78BFA`)
  - Proactividad `bg-warning`
- leyenda en grid con el aporte de cada parte (2 decimales, mono)

**Pie de la ficha:**
- **Pendiente:**
  - ayuda a la izquierda: "Los puntajes automáticos no se pueden editar." o, si falta, "Falta la observación del inconveniente."
  - **Confirmar** (outline) y **Confirmar y siguiente →** (`bg-action`), ambos deshabilitados si falta la observación
  - al confirmar:

    ```ts
    updateDoc(ref, {
      puntualidad, proactividad, completoTurno, tuvoInconveniente,
      comentarioInconveniente: tuvoInconveniente ? comentario.trim() : "",
      puntajeFinal: calcularPuntajeFinal(ev),
      estado: "Confirmado", confirmadoEl: new Date().toISOString(), confirmadoPor: userData.nombre,
    })
    ```

    toast "Evaluación de {nombre} confirmada · {nota}". **Confirmar y siguiente** selecciona el próximo pendiente (por orden de la lista); si no quedan, se queda en el actual.
- **Confirmada:**
  - "✓ Confirmada el 06/10 a las 09:12 por Franklin" (`text-success-text`)
  - botón **Reabrir evaluación** (outline), **disponible para cualquier usuario**, sin confirmación previa
  - reabrir: `updateDoc(ref, { estado: "Pendiente", reaperturas: arrayUnion({ por: userData.nombre, el: new Date().toISOString() }) })` y toast "Evaluación de {nombre} reabierta"
  - los valores cualitativos se conservan para editarlos

**Guardado de borradores:** los cambios a una evaluación pendiente viven en memoria hasta confirmar (igual que hoy). Recomendado: avisar con `beforeunload` si hay pendientes modificadas sin confirmar.

### 18.10 Evolución de la nota (`ScoreTrend`)

- Va arriba en la ficha, con un segmented **7 días / 30 días**.
- **Datos:**

  ```ts
  query(
    collection(db, "evaluaciones_desempeno"),
    where("operador", "==", nombre),
    where("fecha", ">=", isoDesde),          // fecha seleccionada − (2N − 1) días
    where("fecha", "<=", isoFechaSeleccionada),
  );
  ```

  Requiere el índice compuesto `operador ASC + fecha ASC`. Se traen **2N días** para comparar con el período anterior. Cachear por `operador + N + fecha`.
- Nota por día: `puntajeFinal` si está confirmada; si no, `calcularPuntajeFinal(doc)` con sus valores actuales. Días sin documento → `null`.
- Métricas sobre la ventana actual (N días):
  - **Promedio** (2 decimales, color por umbral)
  - **vs período anterior:** `promedio actual − promedio de los N días previos`, en pastilla (success-soft si > 0, danger-soft si < 0, neutra si `|Δ| < 0,05`)
  - **Días bajo 6:** cantidad (`text-danger-text` si > 0)
- **Gráfico:** área de 96px con una barra por día (`flex gap-2`, o `gap-[3px]` con 30 días):
  - alto `nota × 10 %` y color por umbral (`bg-success / bg-warning / bg-danger`)
  - día sin evaluación: barra de 2% `bg-track`
  - el día seleccionado va con opacidad 1 y anillo `ring-2 ring-foreground`; el resto, opacidad 0.75
  - líneas punteadas de referencia en **8** (`border-success`) y **6** (`border-danger`), con etiquetas mono 10px a la derecha
  - debajo, fecha inicial y final (mono 11px)
  - `title` por barra: "29 sep: 8,62"
  - el contenedor lleva `role="img"` con `aria-label` "Nota diaria de Juan en los últimos 7 días, promedio 8,50"
- Opcional: hacerlo con `BarChart` de Recharts (`ReferenceLine` en 6 y 8; `Cell` con el color por valor).

### 18.11 Pendientes de días anteriores

**Hook `usePendientesAnteriores(dias = 7)`:**

```ts
query(
  collection(db, "evaluaciones_desempeno"),
  where("estado", "==", "Pendiente"),
  where("fecha", ">=", isoHoyMenos(dias)),
  where("fecha", "<", isoHoy),
);
// agrupar por fecha → [{ fecha, cantidad }], ordenado de la más reciente a la más antigua
```

Aplicar el mismo filtro por grupo (`grupoMoneda`) según el rol y descartar los operadores excluidos. Índice compuesto: `estado ASC + fecha ASC`.

**En la evaluación** (`PendingDaysBar`, solo si hay pendientes en días **distintos** al seleccionado):
- franja `rounded-[10px] border border-warning bg-warning-soft px-3.5 py-2.5`
- ícono `Clock` + "{n} evaluaciones pendientes de días anteriores" (`text-warning-text`, 600)
- chips `"4 oct · 2"` (`rounded-full border-warning bg-card h-7`) que llevan a ese día y seleccionan su primer pendiente

**En el dashboard** (arriba del título de §6, antes de las tarjetas):
- card `rounded-xl border bg-card p-3 shadow-[inset_3px_0_0_var(--warning)]`
- ícono en cuadrito + "Tienes {n} evaluaciones diarias pendientes de días anteriores" (600) y debajo el detalle "4 oct (2) · 30 sep (2) · 29 sep (1)" (12px, muted)
- botón **Ir a evaluación diaria** (`bg-foreground text-background h-[34px]`) → `/evaluacion-diaria?fecha={la más antigua pendiente}`
- botón **X** (`aria-label="Ocultar aviso"`): lo oculta en la sesión (`sessionStorage["aviso-eval-oculto"] = hoy`); vuelve a aparecer al día siguiente o en una nueva sesión
- no se muestra si no hay pendientes o si el usuario no tiene acceso a la evaluación

### 18.12 Exportar PDF

Botón outline **Exportar PDF** (ícono `FileText` en `text-danger-text`) que abre un `Dialog` (`max-w-[860px]`) con **vista previa** de la hoja:

- Encabezado del diálogo: "Exportar evaluación del día" + "Vista previa · A4 vertical · siempre en tema claro".
- Si hay pendientes: aviso `warning-soft`: "Hay {n} evaluaciones pendientes. El PDF las incluye marcadas como "Pendiente" con sus valores actuales."
- La hoja (fondo blanco fijo, texto `#171717`, sombra) contiene:
  1. cabecera: logo + "Evaluación diaria de operadores" + "{fecha larga} · Equipo {grupo}"; a la derecha "PayoutMetrics / JuegaEnLinea"; línea inferior de 2px
  2. 4 cajas de resumen: confirmadas/total, nota promedio, mejor nota con nombre y cantidad bajo 6
  3. tabla: Operador · Retiros · SLA · Tiempo · Pts SLA · Pts tiempo · Puntual. · Proact. · Turno (Completo/Incompleto) · **Nota** (color por umbral) · Estado
  4. "Observaciones del turno": una línea por operador con inconveniente (`Nombre: texto`), o "Sin inconvenientes registrados."
  5. pie: fórmula de la nota y "Generado por {usuario} · {dd/MM/yyyy HH:mm}"
- Pie del diálogo: **Cancelar** y **Descargar PDF** (`bg-action`, ícono `Download`).

**Generación:** usar **`jspdf` + `jspdf-autotable`** (ya instalados) para dibujar el documento con texto real (seleccionable y liviano), **no** una captura de pantalla:

```ts
const pdf = new jsPDF({ unit: "mm", format: "a4" });
pdf.setFont("helvetica", "bold").setFontSize(14).text("Evaluación diaria de operadores", 14, 18);
// … resumen …
autoTable(pdf, {
  startY: 40,
  head: [["Operador","Retiros","SLA","Tiempo","Pts SLA","Pts tiempo","Puntual.","Proact.","Turno","Nota","Estado"]],
  body: filas,                                  // valores ya formateados en es-CL
  styles: { fontSize: 8 }, headStyles: { fillColor: [242, 242, 242], textColor: 23 },
  didParseCell: (d) => { /* color de la columna Nota según el umbral */ },
});
// … observaciones y pie …
pdf.save(`Evaluacion_Diaria_${fecha}_${grupo}.pdf`);
```

Toast: "Evaluacion_Diaria_2026-10-05_Internacional.pdf descargado".

### 18.13 Tokens adicionales

```css
:root { --eval-violet: #6D4FD8; }
.dark { --eval-violet: #A78BFA; }
```

(`--chart-in-sla` ya está definido en §17.5.)

### 18.14 Responsive y accesibilidad

- **Por debajo de ~900px**, la ficha baja debajo de la lista. **En móvil**, al tocar un operador la ficha se abre en un `Sheet` (hoja inferior a pantalla completa) con su propio botón "Volver a la lista".
- Los botones 1–10 mantienen 34px de alto y en móvil pasan a `grid-cols-5` (dos filas).
- Los switches llevan `aria-labelledby` con su título. La escala de tiempo y el gráfico de evolución tienen `title`/`aria-label` con los valores.
- Toda la ficha es navegable con teclado y en orden: tendencia → cualitativos → turno → confirmar.

### 18.15 Checklist de Evaluación

- [ ] Abre en **ayer**; `›` y el calendario no dejan pasar de ayer; `?fecha=` funciona.
- [ ] Sincronizar crea las evaluaciones nuevas y **no pisa** estado ni cualitativos de las existentes; recalcula `puntajeFinal` de las confirmadas.
- [ ] Autopago y excluidos nunca aparecen; SLA y tiempo sin exonerados.
- [ ] Excluidos: se agrega a mano (también con Enter o desde las sugerencias), se quita con X y no acepta vacíos ni duplicados (sin importar mayúsculas o espacios); se guarda en `configuracion/evaluacion` y la persona desaparece al momento.
- [ ] `JEFES_EXCLUIDOS` ya no existe en el código y el documento de configuración se creó con esos 3 nombres.
- [ ] Puntualidad y proactividad solo aceptan 1–10 con botones y flechas del teclado.
- [ ] Con "Tuvo un inconveniente" y sin observación, no se puede confirmar y se muestra el aviso.
- [ ] La nota final y su desglose cambian en vivo; los colores siguen los umbrales 8 y 6.
- [ ] "Confirmar y siguiente" guarda y salta al próximo pendiente; se guarda `confirmadoPor`.
- [ ] Cualquier usuario puede reabrir; queda registrado en `reaperturas` y la evaluación vuelve a Pendiente con sus valores.
- [ ] La evolución muestra 7 y 30 días con promedio, comparación, días bajo 6 y días sin evaluación en gris.
- [ ] La franja de días anteriores y el aviso del dashboard muestran las mismas cantidades; los chips llevan al día correcto; la X del dashboard lo oculta solo en la sesión.
- [ ] El PDF sale en tema claro, con texto seleccionable, avisa si hay pendientes e incluye las observaciones.
- [ ] "Ver sus retiros en la auditoría" abre la auditoría del día con ese operador filtrado.
- [ ] Todos los números van en `es-CL`.

---

## 19. Cierre mensual

> **Archivo:** `app/(dashboard)/cierre-mensual/page.tsx` (misma ruta) + componentes en `components/cierre/`.
> **Referencia visual:** artboard *Cierre mensual* del canvas. El ajuste `usuario` (admin / quienCerro / otro) simula los permisos de reapertura.
> **Colecciones:** `evaluaciones_desempeno` (lectura), `evaluaciones_mensuales` (snapshot del cierre), `configuracion/evaluacion` (excluidos, §18.4) y `enlaces_expedientes` (sin cambios).

### 19.1 Qué cambia

| Antes | Ahora |
|---|---|
| Tarjeta de "auditoría" con contadores y un botón de cerrar | **Franja de pasos**: 1) Mes terminado · 2) Evaluaciones confirmadas (con accesos a los días pendientes) · 3) Cerrar / Cerrado |
| El ranking y las métricas aparecen **solo después** de cerrar | Se ven **siempre**; antes del cierre llevan la marca **"Preliminar"** |
| Tarjeta "Operador del mes" con trofeo grande | Card sobria con avatar, nota, 4 métricas, de qué puesto venía, y el 2.º y 3.º lugar |
| — | **4 tarjetas** del mes con comparación contra el mes anterior |
| — | **Tendencia del equipo en los últimos 6 meses** (nota promedio + SLA) |
| — | **Movimiento en el ranking** (▲▼ puestos frente al mes anterior) e incidencias por operador |
| SLA mensual aproximado (`% diario × totalRetiros`, que incluye exonerados) | **SLA y tiempo exactos** con los conteos diarios (§19.4) |
| `JEFES_EXCLUIDOS` escrito en el código (otra vez) | Usa la **lista editable** de `configuracion/evaluacion` (§18.4) |
| Un mes cerrado no se puede reabrir | **Reabrir cierre**, solo **un administrador o la persona que lo cerró**, con **motivo obligatorio** e historial |
| PDF por captura de pantalla | PDF con **`jspdf-autotable`** (texto real), igual que §18.12 |

### 19.2 Permisos

| Acción | Quién |
|---|---|
| Ver el cierre y el ranking | Igual que hoy: el admin ve el global; los demás, su grupo (`grupoMoneda`) |
| Cerrar el mes | Igual que hoy: cualquier usuario con acceso a la vista, si se cumplen las condiciones (§19.5) |
| **Reabrir un cierre** | **Administrador** (`parseUserRole(rol).isAdmin`) **o** quien lo cerró (`cierre.cerradoPorUid === user.uid`) |
| Copiar el enlace público del expediente | Igual que hoy |

> Para documentos antiguos sin `cerradoPorUid`, comparar `cierre.cerradoPor === userData.nombre` como respaldo.

**Reglas de Firestore** (para que el permiso no dependa solo del cliente):

```
match /evaluaciones_mensuales/{id} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.cerradoPorUid == request.auth.uid;
  allow update: if request.auth != null && (
    get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == "admin"
    || resource.data.cerradoPorUid == request.auth.uid
    || resource.data.estado == "reabierto"            // cualquiera puede volver a cerrar un mes reabierto
  );
  allow delete: if false;
}
```

### 19.3 Modelo de datos

**`evaluaciones_mensuales/{id}`** con `id = mes` (admin, global) o `${mes}_${grupo}` (como hoy):

```ts
interface CierreMensual {
  mes: string;                         // "2026-09"
  grupo: "Global" | "inter" | "nacional";
  estado: "cerrado" | "reabierto";     // NUEVO (docs viejos sin campo = "cerrado")
  cerradoEl: string | null;            // ISO
  cerradoPor: string | null;           // nombre
  cerradoPorUid: string | null;        // NUEVO
  metrics: {
    totalOps: number;                  // Σ totalRetiros (gestión manual)
    retirosEvaluables: number;         // NUEVO
    retirosCumplidos: number;          // NUEVO
    slaGlobal: number;                 // %, 1 decimal (antes string)
    tiempoGlobal: number;              // min, 1 decimal (antes string)
    notaPromedio: number;              // NUEVO: promedio de notaFinalPromedio del ranking
    operadores: number;                // NUEVO
  };
  ranking: RankingFila[];              // ordenado por nota desc
  excluidos: string[];                 // NUEVO: lista usada al cerrar (auditoría)
  historial: Array<{                   // NUEVO
    accion: "cierre" | "reapertura";
    por: string; porUid: string; el: string;
    motivo?: string;                   // obligatorio en reapertura
    snapshotAnterior?: { metrics: CierreMensual["metrics"]; ranking: RankingFila[]; cerradoEl: string; cerradoPor: string };
  }>;
}

interface RankingFila {
  puesto: number;
  operador: string;
  diasTrabajados: number;
  totalRetiros: number;
  retirosEvaluables: number;
  retirosCumplidos: number;
  slaPromedio: number;          // %
  tiempoPromedio: number;       // min
  puntualidadPromedio: number;
  proactividadPromedio: number;
  notaFinalPromedio: number;    // 2 decimales
  inconvenientes: number;       // días con tuvoInconveniente
  turnosIncompletos: number;    // días con !completoTurno
  puestoAnterior: number | null;// NUEVO: puesto en el mes anterior (para ▲▼)
}
```

**Lectura del estado:** si el documento no existe o `estado === "reabierto"` → el mes **no está cerrado** y todo se calcula en vivo (preliminar). Si `estado === "cerrado"` (o no tiene `estado`) → se muestra el snapshot guardado.

### 19.4 Cálculos (exactos, sin Autopago ni exonerados)

**Fuente:** `evaluaciones_desempeno` del mes (`fecha` entre `${mes}-01T00:00:00.000Z` y el último día `T23:59:59.999Z`), filtrada por grupo según el rol y **sin los operadores excluidos** (`configuracion/evaluacion`, comparando con `normalizarNombre`).

Por cada evaluación diaria se toman los conteos nuevos de §18.3. **Respaldo para documentos antiguos** (sin esos campos):

```ts
const evaluables = ev.retirosEvaluables ?? Math.max(0, ev.totalRetiros - (ev.exonerados ?? 0));
const cumplidos  = ev.retirosCumplidos  ?? Math.round((ev.cumplimientoSlaPct / 100) * evaluables);
const tiempoTot  = ev.tiempoTotalMin    ?? ev.tiempoPromedioMin * evaluables;
```

> **Backfill recomendado:** un script único que recorra `evaluaciones_desempeno` y complete `retirosEvaluables`, `retirosCumplidos` y `tiempoTotalMin` volviendo a leer `operaciones_retiros` de cada día. Mientras tanto, el respaldo de arriba evita romper los meses antiguos.

**Por operador:**

| Campo | Fórmula |
|---|---|
| `diasTrabajados` | cantidad de evaluaciones diarias del operador en el mes |
| `totalRetiros` | Σ `totalRetiros` |
| `slaPromedio` | Σ `cumplidos` / Σ `evaluables` × 100 |
| `tiempoPromedio` | Σ `tiempoTot` / Σ `evaluables` |
| `puntualidadPromedio`, `proactividadPromedio` | promedio simple de los días |
| `notaFinalPromedio` | promedio de `puntajeFinal` de los días **confirmados** (en preliminar, los pendientes usan `calcularPuntajeFinal` con sus valores actuales) |
| `inconvenientes` / `turnosIncompletos` | días con `tuvoInconveniente` / con `!completoTurno` |

**Orden del ranking:** `notaFinalPromedio` desc → `slaPromedio` desc → `totalRetiros` desc.

**Globales del mes:** `totalOps = Σ totalRetiros`; `slaGlobal = Σ cumplidos / Σ evaluables`; `tiempoGlobal = Σ tiempoTot / Σ evaluables`; `notaPromedio` = promedio de `notaFinalPromedio` del ranking.

**Comparación con el mes anterior** (tarjetas y ▲▼): del snapshot del mes anterior si está cerrado; si no, calculado en vivo con la misma función.

| Tarjeta | Valor | Variación | Buena si… |
|---|---|---|---|
| Retiros gestionados | `totalOps` | % | sube |
| SLA del mes | `slaGlobal` % | pts | sube |
| Tiempo promedio | `tiempoGlobal` min | min | **baja** |
| Nota promedio del equipo | `notaPromedio` / 10 (color por umbral) | diferencia absoluta | sube |

**Movimiento:** `puestoAnterior − puesto` → `▲n` (success), `▼n` (danger), `—` (sin cambio); sin `puestoAnterior` → "nuevo" (`text-brand`). `title`: "Subió 2 puestos", "Mismo puesto que el mes anterior", "Primer mes en el ranking".

> Poner todo esto en **una función pura** `calcularCierre(diarias, excluidos, rankingAnterior?)` en `lib/cierre.ts`, usada tanto para el preliminar como para guardar el snapshot.

### 19.5 Condiciones para cerrar (sin cambios en la lógica)

- **Mes terminado:** `mes < mesActual` (`yyyy-MM` del navegador).
- **Todas las evaluaciones confirmadas:** cada día con evaluaciones tiene `confirmados === total` (cuenta de días únicos, como hoy).
- **No cerrado** (o reabierto).

Si falta algo, el botón **Cerrar {mes}** queda deshabilitado con el motivo debajo: "Disponible cuando termine el mes." / "Primero confirma las evaluaciones pendientes."

### 19.6 Cerrar y reabrir

**Cerrar** (`AlertDialog`):
- Título: "¿Cerrar septiembre 2026?"
- Texto: "Se guardará una foto del ranking y de las métricas del mes. Si después se reabre o corrige una evaluación diaria, este cierre no cambia."
- Resumen en una caja `bg-muted`: operadores en el ranking, operador del mes con su nota y nota promedio del equipo.
- Botones: **Cancelar** / **Cerrar mes** (`bg-action`).
- Al confirmar:

  ```ts
  const ahora = new Date().toISOString();
  await setDoc(ref, {
    mes, grupo, estado: "cerrado", cerradoEl: ahora,
    cerradoPor: userData.nombre, cerradoPorUid: user.uid,
    metrics, ranking, excluidos,
    historial: arrayUnion({ accion: "cierre", por: userData.nombre, porUid: user.uid, el: ahora }),
  }, { merge: true });
  ```

  Toast: "Septiembre 2026 cerrado · ranking guardado".

**Reabrir** (solo admin o quien cerró, §19.2):
- En el bloque derecho de la franja, cuando está cerrado: "🔒 Mes cerrado", "Cerrado el 01/09/2026 09:30 por Marvin. El ranking y las métricas quedan fijos." y el botón outline **Reabrir cierre**.
- Debajo, el motivo del permiso:
  - "Puedes reabrirlo como administrador."
  - "Puedes reabrirlo porque tú lo cerraste."
  - sin permiso: el botón queda **deshabilitado** y dice "Solo un administrador o {nombre} (quien lo cerró) puede reabrirlo." (también como `title`)
- Diálogo:
  - Título: "¿Reabrir el cierre de septiembre 2026?"
  - Texto: "El ranking vuelve a ser preliminar y se recalcula con las evaluaciones actuales. La foto anterior queda guardada en el historial del cierre. Para que vuelva a contar, hay que cerrar el mes de nuevo."
  - `Textarea` **"Motivo de la reapertura"** (obligatorio; el botón se habilita con texto) y la nota "Obligatorio. Queda registrado junto a tu nombre."
  - Botones: **Cancelar** / **Reabrir cierre**.
- Al confirmar:

  ```ts
  await updateDoc(ref, {
    estado: "reabierto",
    historial: arrayUnion({
      accion: "reapertura", por: userData.nombre, porUid: user.uid, el: ahora, motivo: motivo.trim(),
      snapshotAnterior: { metrics: cierre.metrics, ranking: cierre.ranking, cerradoEl: cierre.cerradoEl, cerradoPor: cierre.cerradoPor },
    }),
    cerradoEl: null, cerradoPor: null, cerradoPorUid: null,
  });
  ```

  Toast: "Cierre de septiembre reabierto por {nombre}". La vista pasa a **Listo para cerrar** o **Pendiente**, según las condiciones.
- **Historial (recomendado):** debajo de la franja, un enlace "Ver historial (3)" que abre un `Popover` con la lista de cierres y reaperturas (fecha, persona y motivo).

### 19.7 Layout

```tsx
<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
  <CierreHeader />                 {/* título + chip de estado, selector de mes, Excel, PDF */}
  <ClosingSteps />                 {/* franja de pasos + bloque cerrar/cerrado */}
  <MonthKpis />                    {/* 4 KpiCard con tendencia */}
  <div className="flex flex-wrap items-stretch gap-3.5">
    <TopOperatorCard className="min-w-0 flex-[1_1_380px]" />
    <TeamTrend className="min-w-0 flex-[1.4_1_460px]" />
  </div>
  <RankingTable />
</div>
```

```
components/cierre/
  useCierreMes.ts  · lib/cierre.ts (calcularCierre)
  CierreHeader.tsx · MonthPicker.tsx (reusar el de §16.8, con puntos de estado)
  ClosingSteps.tsx · CloseDialog.tsx · ReopenDialog.tsx · CierreHistory.tsx
  MonthKpis.tsx · TopOperatorCard.tsx · TeamTrend.tsx · RankingTable.tsx
  exportCierreExcel.ts · exportCierrePdf.ts
```

**Encabezado:**
- `<h1>` "Cierre mensual" + **chip de estado**:
  - `Cerrado` (success-soft)
  - `En curso` (`bg-brand-soft text-brand`) para el mes actual
  - `Listo para cerrar` / `Pendiente` (warning-soft)
- Subtítulo: "Panel {grupo} · {Mes} {año}".
- Selector de mes (§16.8) con `?mes=YYYY-MM` en la URL, como hoy. En la grilla de meses, un punto de 6px por mes: **verde = cerrado**, **ámbar = sin cerrar**, nada en los futuros; leyenda debajo. Para pintar los puntos, consultar `evaluaciones_mensuales` del año (`where("mes", ">=", "${año}-01")`, `where("mes", "<=", "${año}-12")`, filtrando por grupo) y tratar `estado === "reabierto"` como sin cerrar.
- Botones **Excel** y **PDF** (outline), siempre disponibles. Si el mes no está cerrado, los archivos llevan "PRELIMINAR" en el título.

### 19.8 Franja de pasos (`ClosingSteps`)

Card `flex flex-wrap` (sin padding interno) con 3 columnas (`flex-[1_1_240px] p-4 border-r`):

| Paso | ✓ si… | Texto |
|---|---|---|
| 1 Mes terminado | `mes < mesActual` | "El mes terminó el 30 de septiembre." / "Termina el 31 de octubre (faltan 25 días)." |
| 2 Evaluaciones confirmadas | sin días pendientes | "30 de 30 días con todas las evaluaciones confirmadas." (en `text-warning-text` si faltan) + chips `"4 oct · 2"` → `/evaluacion-diaria?fecha=…` |
| 3 (bloque `bg-muted`) | — | Sin cerrar: botón **Cerrar {mes}** (`bg-action`) + motivo · Cerrado: "Mes cerrado", fecha/persona, **Reabrir cierre** + permiso |

El ícono de cada paso es un círculo de 28px: `bg-success-soft text-success-text` con check si se cumple; si no, `bg-muted text-muted-foreground` con el número.

### 19.9 Operador del mes y tendencia

**`TopOperatorCard`:**
- Título con ícono `Trophy` en `--gold` (`#B7791F` / dark `#FBBF24`):
  - cerrado: "Operador del mes"
  - mes en curso: "Va primero este mes"
  - otros sin cerrar: "Primero del ranking"
  - sin cerrar, además, el chip "Preliminar"
- Avatar 64px con anillo dorado (`shadow-[0_0_0_3px_var(--card),0_0_0_5px_var(--gold)]`), nombre 22px/700 y debajo "{días} días trabajados · repite el primer puesto" o "venía {n}.º el mes pasado".
- Nota 36px (color por umbral) + "nota del mes".
- 4 mini-métricas en `bg-muted rounded-[9px]`: SLA, Tiempo, Retiros e Incidencias.
- Separador y luego el 2.º y 3.º lugar: posición (mono), avatar, nombre y nota.
- **Empate en el primer puesto:** se desempata con el orden de §19.4 y se muestra "Empate en nota con {nombre}, desempatado por SLA".

**`TeamTrend` (últimos 6 meses, terminando en el mes elegido):**
- Barras de **nota promedio** (`--chart-in-sla`) con el valor encima (mono 12px) y una **línea de SLA** (`--success`) superpuesta en eje propio (70–100%). Se puede hacer con `ComposedChart` de Recharts (`Bar` + `Line` con dos `YAxis` ocultos).
- El mes en curso va con la barra **punteada y sin relleno** (`stroke-dasharray`).
- Etiquetas: "Abr 26 · May · … · Sep" y el SLA de cada mes debajo (mono 11px, `text-success-text`).
- Datos: `metrics` de los snapshots cerrados; para los meses sin cerrar, `calcularCierre` en vivo (cachear por mes).

### 19.10 Ranking (`RankingTable`)

- Encabezado:
  - "Ranking del mes" + chip "Preliminar" si no está cerrado
  - subtítulo: "Foto guardada al cerrar el mes." / "Se calcula con las evaluaciones confirmadas hasta hoy y puede cambiar hasta que se cierre el mes."
  - leyenda de colores ≥ 8 / 6–7,9 / < 6
- Tabla (`min-w-[980px]`, scroll horizontal, filas de 54px):

| Columna | Contenido |
|---|---|
| # | puesto (mono 700) + movimiento ▲▼ (11px, color) |
| Operador | avatar + nombre (600) |
| Días · Retiros | mono, a la derecha |
| SLA | mono; `text-danger-text` si < 90% |
| Tiempo | mono + "min" muted |
| Puntual. · Proact. | mono, 1 decimal |
| Incidencias | "2 inconvenientes · 1 turno incompleto" (`text-warning-text`) o "Sin incidencias" (muted) |
| Nota del mes | barra de 6px al `nota × 10 %` (color por umbral) + valor mono 700 |
| Acciones | **Ver expediente** (`<a>` → `/expediente/{operador}?mes=…`) y **Copiar enlace** (la lógica actual `handleGenerarEnlace`); ambos de 32×32 con `aria-label` y tooltip |

- Pie (12px, muted): "Nota del mes = promedio de las notas diarias confirmadas. SLA y tiempo ponderados por retiros, sin Autopago ni exonerados. ▲▼ = puestos ganados o perdidos frente al mes anterior. No incluye a los {n} nombres de la lista de excluidos de la evaluación diaria."

### 19.11 Exportación

**Excel** (`Cierre_Mensual_{mes}{_PRELIMINAR}.xlsx`):
- Hoja "Ranking": Puesto · Movimiento · Operador · Días trabajados · Total retiros · SLA mensual (%) · Tiempo prom. (min) · Puntualidad prom. · Proactividad prom. · Nota final mensual · Días con inconvenientes · Turnos incompletos.
- Hoja "Resumen": las 4 métricas con su variación, el operador del mes, el estado (Cerrado/Preliminar), quién cerró y cuándo, y la lista de excluidos.

**PDF** (`Cierre_Mensual_{mes}{_PRELIMINAR}.pdf`) con `jsPDF` + `jspdf-autotable`, A4 horizontal:
1. cabecera con logo, "Cierre mensual — {Mes año} · {grupo}" y el estado ("Cerrado el … por …" o una marca **PRELIMINAR**)
2. 4 cajas de resumen
3. operador del mes y podio
4. tabla del ranking (colores de nota por `didParseCell`)
5. pie con la fórmula y "Generado por {usuario} · {fecha}"

Se elimina la captura con `toPng` y el overlay "Generando PDF".

### 19.12 Responsive y accesibilidad

- La franja de pasos se apila con poco ancho; el bloque de acción queda al final, a ancho completo.
- Las cards de operador del mes y de tendencia se apilan por debajo de ~880px. La tabla se desplaza dentro de su card, con la columna Operador `sticky left-0 bg-card`.
- Los diálogos de cerrar y reabrir son `AlertDialog` (foco atrapado; Escape cancela). El `Textarea` del motivo tiene `Label`.
- El movimiento ▲▼ no depende solo del color: lleva flecha, número y `title`.

### 19.13 Checklist de Cierre

- [ ] El ranking, las tarjetas, el operador del mes y la tendencia se ven antes de cerrar, con la marca "Preliminar".
- [ ] SLA y tiempo del mes coinciden con la suma exacta de los conteos diarios (sin Autopago ni exonerados). Los meses viejos sin los campos nuevos usan el respaldo y no se rompen.
- [ ] Los excluidos vienen de `configuracion/evaluacion`; ya no hay `JEFES_EXCLUIDOS` en esta página. El snapshot guarda `excluidos`.
- [ ] El paso 2 lista los días con pendientes y los chips llevan a la evaluación de ese día.
- [ ] Solo se puede cerrar con el mes terminado y todo confirmado. El diálogo muestra el resumen y el snapshot guarda `cerradoPorUid` e `historial`.
- [ ] **Reabrir:** habilitado para un admin y para quien cerró. Deshabilitado para el resto, con el mensaje que nombra a quien cerró. Las reglas de Firestore rechazan el intento si se hace por fuera de la UI.
- [ ] Reabrir exige motivo, guarda el snapshot anterior en `historial` y deja el mes en preliminar. Volver a cerrar genera un snapshot nuevo.
- [ ] Los puntos del selector de mes reflejan cerrado / sin cerrar (reabierto cuenta como sin cerrar).
- [ ] El movimiento ▲▼ usa el mes anterior (snapshot si está cerrado).
- [ ] Excel y PDF incluyen "PRELIMINAR" cuando corresponde; el PDF es de texto real y apaisado.
- [ ] Ver expediente y Copiar enlace funcionan como hoy.
- [ ] Todos los números van en `es-CL`.

---

## 20. Expediente del operador

> **Archivos:** `app/(dashboard)/expediente/[operador]/page.tsx` (interno) y `app/evaluacion-operador/[id]/page.tsx` (enlace público). Ambos usan un mismo componente `components/expediente/Expediente.tsx` con la prop `modo: "interno" | "publico"`.
> **Referencia visual:** artboard *Expediente del operador (cierre mensual)* del canvas.
> **Se llega desde:** el ranking del cierre (botón "Ver expediente", §19.10) o el enlace público copiado ("Copiar enlace", `enlaces_expedientes`).

### 20.1 Qué cambia

| Antes | Ahora |
|---|---|
| 4 tarjetas (nota, SLA, retiros, días) | **5 tarjetas** con comparación contra el mes anterior **y** contra el promedio del equipo: Nota, SLA, Tiempo, Retiros e Incidencias |
| — | **Desglose de la nota:** cuánto aporta cada criterio y en qué está por encima o por debajo del equipo |
| Gráfico de SLA por moneda (barras verticales) | Barras horizontales por moneda, con retiros y línea de meta del 90% |
| Línea de evolución de la nota | **Barras por día del mes** (los días libres en gris), coloreadas por umbral, con línea del promedio del equipo y resumen de mejor y peor día |
| — | **Observaciones del mes:** inconvenientes y turnos incompletos con su comentario |
| Tabla de días | Tabla con día de la semana, chip de turno (con la observación en tooltip) y enlace a la auditoría de ese día |
| Volver con un botón | Breadcrumb + "Volver al cierre de {mes}" + **flechas para pasar al operador anterior o siguiente del ranking** sin volver al cierre |
| PDF por captura de pantalla | PDF con **`jspdf-autotable`** (como §18.12 y §19.11) |
| Estado del mes no visible | Chips **"Puesto 3 de 5 ▲1"** y **"Mes cerrado" / "Preliminar"** |

### 20.2 Datos

**Parámetros:** `operador` (ruta, `decodeURIComponent`) y `?mes=YYYY-MM` (por defecto el mes actual, como hoy). En el enlace público, ambos salen del documento `enlaces_expedientes/{id}` (`operador`, `mes`), igual que hoy.

**Fuentes:**

1. **Evaluaciones del operador en el mes:**

   ```ts
   query(collection(db, "evaluaciones_desempeno"),
     where("operador", "==", operador),
     where("fecha", ">=", inicioMes), where("fecha", "<=", finMes));
   ```

   Hoy se trae **todo el mes de todos los operadores** y se filtra en memoria; con este filtro se lee solo lo necesario (usa el índice `operador ASC + fecha ASC` de §18.10).
2. **Ranking del mes y del anterior:** snapshot de `evaluaciones_mensuales` si está cerrado; si no, `calcularCierre` (§19.4). De ahí salen el **puesto**, el **movimiento** y los **promedios del equipo**.
3. **SLA por moneda:**

   ```ts
   query(collection(db, "operaciones_retiros"),
     where("Operador", "==", operador),
     where("Fecha del reporte", ">=", inicioMes), where("Fecha del reporte", "<=", finMes));
   ```

   Hoy se descargan **todos los retiros del mes** y se filtran en memoria, lo que es muy pesado. Con este filtro se lee solo lo del operador; requiere el índice `Operador ASC + Fecha del reporte ASC`. Se descartan los exonerados y el Autopago no aplica (es otro operador).

**Excluidos:** si el operador está en `configuracion/evaluacion.operadoresExcluidos`, se muestra un aviso: "{nombre} está excluido de la evaluación; su expediente no se genera." Sin tarjetas ni tablas.

### 20.3 Cálculos

Todos sin Autopago ni exonerados, con los conteos exactos de §18.3 y el respaldo de §19.4 para los meses viejos.

| Dato | Fórmula |
|---|---|
| Nota del mes | promedio de `puntajeFinal` de los días (igual al ranking del cierre) |
| SLA / Tiempo | Σ cumplidos / Σ evaluables · Σ tiempoTot / Σ evaluables |
| Retiros | Σ `totalRetiros` · "{días} días trabajados · {retiros/días} por día" |
| Incidencias | días con `tuvoInconveniente` + días con `!completoTurno` (chip "revisar" si > 0, "ok" si es 0) |
| Comparación con el mes anterior | misma métrica del operador en el mes anterior (nota en diferencia absoluta con 2 decimales; SLA en pts; tiempo en min, buena si baja; retiros en %) |
| Promedio del equipo | promedio simple de cada métrica entre los operadores del ranking del mes |

**Desglose de la nota (que sume exacto la nota del mes):** cada criterio se calcula como el **promedio del puntaje diario** de ese criterio, no como el puntaje del promedio mensual:

```ts
const n = diarias.length;
const ptsSla   = Σ calcularPuntajeSLA(slaDia)   / n;   // ej. 9,5
const ptsTmp   = Σ calcularPuntajeTiempo(tmpDia) / n;  // ej. 9,0
const ptsPunt  = Σ puntualidad / n;
const ptsProac = Σ proactividad / n;
// nota del mes = ptsSla·0,3 + ptsTmp·0,3 + ptsPunt·0,2 + ptsProac·0,2  (= promedio de puntajeFinal)
```

> Si se usara el puntaje del SLA mensual (ej. SLA del mes 95,2% → 9,5) la suma no coincidiría con la nota mostrada, porque la nota es el promedio de las notas diarias.

### 20.4 Layout

```
← Volver al cierre de septiembre 2026
(G) Gabriel                                              [‹] 3 de 5 [›] | [🔗 Copiar enlace] [PDF]
    Expediente de septiembre 2026 · Internacional  [Puesto 3 de 5 —] [Mes cerrado]

[Nota del mes] [SLA] [Tiempo promedio] [Retiros gestionados] [Incidencias]

┌ Desglose de la nota ───────────────┐ ┌ SLA por moneda ─────┐
│ SLA · 30%      9,5 / 10  +0,3 vs eq │ │ USD  ▇▇▇▇▇▇▇▇▇▏ 98,4%│
│ ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇│ (marca equipo)   │ │ …                   │
│ … Tiempo · Puntualidad · Proactividad│ └─────────────────────┘
│ Nota del mes  2,85 + 2,67 + 1,88 + 1,76 = 9,16 │
└────────────────────────────────────┘
┌ Nota diaria (barras por día) ────────────────────┐ ┌ Observaciones del mes ┐
└──────────────────────────────────────────────────┘ └───────────────────────┘
┌ Evaluaciones diarias (tabla) ────────────────────────────────────────────┐
```

```tsx
<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 pb-9 pt-5 md:px-7">
  <ExpedienteHeader />
  <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">{/* 5 KpiCard */}</div>
  <div className="flex flex-wrap items-stretch gap-3.5">
    <ScoreBreakdown className="min-w-0 flex-[1.3_1_460px]" />
    <SlaByCurrency className="min-w-0 flex-[1_1_340px]" />
  </div>
  <div className="flex flex-wrap items-stretch gap-3.5">
    <DailyScores className="min-w-0 flex-[2_1_560px]" />
    <MonthNotes className="min-w-0 flex-[1_1_300px]" />
  </div>
  <DailyTable />
</div>
```

```
components/expediente/
  Expediente.tsx (modo interno | publico) · useExpediente.ts · lib/expediente.ts
  ExpedienteHeader.tsx · ScoreBreakdown.tsx · SlaByCurrency.tsx
  DailyScores.tsx · MonthNotes.tsx · DailyTable.tsx · exportExpedientePdf.ts
```

### 20.5 Encabezado

> Todo lo marcado con **(solo interno)** se oculta en el enlace que recibe el operador (§20.10).

- Breadcrumb del header **(solo interno)**: "Cierre mensual / {Mes año} / {Operador}".
- Enlace `← Volver al cierre de {mes}` → `/cierre-mensual?mes=…` **(solo interno)**.
- Avatar de 60px (`bg-brand-soft text-brand`). **Si es el 1.º del ranking**, lleva anillo dorado (`--gold`) **(solo interno; revela el puesto)**.
- `<h1>` con el nombre (26px, 700). Debajo: "Expediente de {mes} · {grupo}" y dos chips:
  - "Puesto {n} de {total} {▲n | ▼n | — | nuevo}", con el movimiento en color como en §19.10 **(solo interno)**
  - "Mes cerrado" (success-soft) o "Preliminar" (warning-soft)
- Acciones a la derecha:
  - **‹ {n} de {total} ›** **(solo interno)**: operador anterior o siguiente **en el orden del ranking**, en forma circular. Navega con `router.replace("/expediente/{otro}?mes=…")`. `aria-label`: "Siguiente en el ranking: {nombre}".
  - **Copiar enlace** **(solo interno)**: la misma lógica `handleGenerarEnlace` del cierre (reutiliza el enlace si ya existe) y el toast "Enlace del expediente de {nombre} copiado".
  - **PDF** (§20.9).

### 20.6 Tarjetas (5)

`KpiCard` (§8.4) con una línea inferior que combina la **pastilla de variación contra el mes anterior** y el texto "vs {mes ant.} · equipo {valor}":

| Tarjeta | Valor | Pastilla | Texto |
|---|---|---|---|
| Nota del mes | 2 decimales, color por umbral, "/ 10" | Δ absoluta | "vs ago · equipo 8,92" |
| SLA | % (`text-danger-text` si < 90) | Δ pts | "vs ago · equipo 93,1%" |
| Tiempo promedio | min (`text-danger-text` si > 25) | Δ min (buena si baja) | "vs ago · equipo 15,2 min" |
| Retiros gestionados | entero | Δ % | "23 días trabajados · 80 por día" |
| Incidencias | inconvenientes + turnos incompletos (`text-warning-text` si > 0) | "revisar" / "ok" | "1 inconveniente · 0 turnos incompletos" |

### 20.7 Desglose, monedas, nota diaria y observaciones

**`ScoreBreakdown`:**
- Encabezado "Desglose de la nota" con la leyenda: cuadro `--chart-in-sla` = {operador}; marca vertical = "Promedio del equipo".
- 4 filas: SLA (30%), Tiempo (30%), Puntualidad (20%), Proactividad (20%). Cada una con:
  - nombre + peso · puntaje `"9,5 / 10"` (mono) · diferencia con el equipo (`+0,3 vs equipo` en success, `-x` en danger, "igual al equipo" en muted)
  - barra de 10px `bg-track` con relleno `--chart-in-sla` al `puntaje × 10 %` y una **marca vertical** de 2px (`bg-foreground`) en la posición del equipo (`title` "Equipo: 9,2")
  - texto debajo: "Promedio del puntaje diario (SLA del mes 95,2%) → aporta 2,85 pts"
- Pie: "Nota del mes" + la fórmula `2,85 + 2,67 + 1,88 + 1,76 =` (mono, muted) + la nota (22px, color por umbral).

**`SlaByCurrency`:**
- "SLA por moneda" + "meta 90%".
- Una fila por moneda, ordenadas de mayor a menor SLA: código en chip mono · "{n} retiros" · % a la derecha (`text-danger-text` si < 90).
- Barra de 8px (`bg-success` si ≥ 90, si no `bg-danger`) con una línea punteada vertical en el 90%.
- Pie: "Sin Autopago ni exonerados. La línea punteada marca el 90%."
- Sin datos: "Sin retiros registrados en el mes."

**`DailyScores`:**
- "Nota diaria" + leyenda (≥ 8 / 6–7,9 / < 6 y "Promedio del equipo ({valor})").
- 150px de alto, **una barra por día del mes** (`flex gap-1`):
  - alto `nota × 10 %` y color por umbral
  - **días sin evaluación** (libres): barra de 3% `bg-track`
  - `title`: "8 sep: nota 9,68 · SLA 97,1% · 12,4 min" o "8 sep: no trabajó"
- Línea punteada horizontal a la altura del promedio del equipo.
- Eje: 1 · 8 · 15 · 22 · {último día}.
- Resumen debajo: "Mejor día: 8 sep (9,68) · Peor día: 27 sep (8,50) · 5 de 23 días bajo el promedio del equipo · barras grises = días libres". El contenedor lleva `role="img"` con un `aria-label` equivalente.
- Recharts alternativo: `BarChart` con `Cell` por color + `ReferenceLine` (promedio del equipo).

**`MonthNotes` ("Observaciones del mes"):**
- Contador en chip. Una tarjeta `bg-muted rounded-[9px]` por día con `tuvoInconveniente` o `!completoTurno`:
  - fecha (mono) + chip **Inconveniente** (warning-soft) o **Turno incompleto** (danger-soft)
  - el `comentarioInconveniente`
- Sin datos: "Sin inconvenientes ni turnos incompletos este mes."

### 20.8 Tabla de evaluaciones diarias

- Encabezado: "Evaluaciones diarias" + "{n} días evaluados · todas confirmadas" (o "· {k} pendientes" en preliminar).
- Columnas (`min-w-[940px]` interno, `min-w-[820px]` público; filas de 46px):
  1. **Fecha:** `dd/MM` mono 600 + día de la semana muted
  2. **Retiros**
  3. **SLA** (danger si < 90)
  4. **Tiempo** + "min"
  5. **Puntual.**
  6. **Proact.**
  7. **Turno:** chip `Completo` (success-soft) / `Inconveniente` (warning-soft) / `Incompleto` (danger-soft); el `title` muestra la observación
  8. **Nota** (mono 700, color por umbral)
  9. **Auditoría (solo interno; en público la columna no se renderiza y Nota pasa a ser la última, con `pr-[18px]`):** enlace ↗ a `/auditoria-diaria?fecha=YYYY-MM-DD&operador={nombre}` (§17.2)
- Si un día está **Pendiente** (mes en curso), la nota va en muted con el chip "Pendiente" al lado.

### 20.9 PDF

`Expediente_{Operador}_{mes}.pdf`, A4 vertical, con `jsPDF` + `jspdf-autotable`:
1. Cabecera: logo, "Expediente de {Operador}", "{Mes año} · {grupo}" y el estado (cerrado / PRELIMINAR). "· Puesto {n} de {total}" se agrega **solo cuando se genera en modo interno**; el PDF del enlace público no lleva puesto ni columna Auditoría.
2. 5 cajas de resumen con la comparación contra el equipo.
3. Desglose de la nota en tabla (criterio, peso, puntaje, equipo y aporte) más la fórmula.
4. SLA por moneda (tabla).
5. Observaciones del mes.
6. Tabla de evaluaciones diarias.
7. Pie: "Generado por {usuario} · {fecha}". En el enlace público: "Generado desde enlace compartido".

### 20.10 Modo público (`/evaluacion-operador/[id]`) — el enlace que recibe el operador

Es el enlace que se genera en el cierre mensual ("Copiar enlace") y se envía al operador. Es **solo el expediente**: mismo componente con `modo="publico"`, fuera del grupo `(dashboard)`, así que **no hay sidebar, header, breadcrumb ni botón de tema** (el tema sigue al SO, §15.2). Artboard de referencia: **"Expediente — enlace que recibe el operador"** (prop `modo = enlace`).

| Elemento | Interno (`/expediente/[operador]`) | Enlace (`/evaluacion-operador/[id]`) |
|---|---|---|
| Sidebar y header de la app | ✓ | — |
| Breadcrumb y "Volver al cierre" | ✓ | — |
| Franja superior: logo + "PayoutMetrics" · "Documento personal · {Mes año}" | — | ✓ |
| Avatar, nombre, "Expediente de {mes} · {grupo}" | ✓ | ✓ |
| Chip **"Puesto n de 5 ▲▼"** y anillo dorado del 1.º | ✓ | — |
| Chip "Mes cerrado" | ✓ (o "Preliminar") | ✓ (siempre cerrado) |
| **Flechas ‹ › entre operadores** | ✓ | — |
| **Copiar enlace** | ✓ | — |
| PDF | ✓ | ✓ |
| 5 KPIs, desglose, SLA por moneda, nota diaria, observaciones | ✓ | ✓ |
| Tabla de evaluaciones diarias | ✓ | ✓ |
| **Columna Auditoría** | ✓ | — |
| Ancho máximo del contenido | 1240px | 1080px |

```tsx
// app/evaluacion-operador/[id]/page.tsx (sin MainLayout)
<Expediente modo="publico" operador={enlace.operador} mes={enlace.mes} />

// dentro de los componentes
const interno = modo === "interno";
{interno && <RankingChip pos={pos} total={total} move={move} />}
{interno && <OperatorPager />}
{interno && <CopyLinkButton />}
{interno && <th>Auditoría</th>}
```

- Las comparaciones "vs equipo" se mantienen (son promedios, no exponen a otros operadores).
- El enlace solo existe para meses **cerrados**; si el mes se reabre (§19), la página muestra "Este expediente se está revisando. Vuelve a abrir el enlace cuando el mes se cierre de nuevo."
- Muestra solo el operador y el mes del documento `enlaces_expedientes/{id}`. Si el id no existe: "Este enlace no es válido o fue eliminado."
- **Recomendado:**
  - agregar a `enlaces_expedientes` el campo `expiraEl` (por ejemplo, 60 días desde `creadoEl`) y mostrar "Este enlace expiró" al vencer
  - en las reglas de Firestore, permitir leer **solo** el documento del enlace y las evaluaciones de ese `operador`/`mes`, para que el enlace no exponga datos de otros operadores
  - no calcular el puesto en el cliente público: el ranking requiere leer a todos los operadores, cosa que las reglas no deben permitir

### 20.11 Responsive y accesibilidad

- Las 5 tarjetas pasan a 2 columnas y luego a 1. Los pares de cards se apilan por debajo de ~900px.
- En móvil, las acciones del encabezado bajan a una segunda línea. Las flechas de operador quedan junto al nombre.
- Las barras diarias con más de 28 días mantienen `gap-[3px]`; por debajo de 480px se muestra una etiqueta del eje cada 7 días.
- Todo color de estado va con texto o forma: los chips llevan palabra, los días libres son barras grises con `title` y el movimiento usa flecha.

### 20.12 Checklist del Expediente

- [ ] Se llega desde "Ver expediente" del ranking con el mes correcto; "Volver al cierre de {mes}" regresa al mismo mes.
- [ ] Las flechas recorren el ranking en orden y en forma circular, sin volver al cierre.
- [ ] Las consultas filtran por `operador` (evaluaciones y retiros) en lugar de traer todo el mes; los índices están creados.
- [ ] La nota del mes coincide con la del ranking del cierre, y la fórmula del desglose suma exactamente esa nota.
- [ ] SLA y tiempo exactos, sin Autopago ni exonerados; coinciden con el cierre.
- [ ] Las comparaciones contra el mes anterior y el equipo usan el snapshot si el mes está cerrado.
- [ ] Días libres en gris; mejor y peor día correctos; la línea del equipo está a la altura correcta.
- [ ] Las observaciones listan inconvenientes y turnos incompletos con su texto.
- [ ] Cada fila enlaza a la auditoría de ese día con el operador filtrado (solo en modo interno).
- [ ] Un operador excluido muestra el aviso en lugar del expediente.
- [ ] El enlace público no muestra sidebar, header, breadcrumb, "Volver al cierre", **chip de puesto, anillo dorado, flechas, Copiar enlace ni columna Auditoría**; sí muestra PDF y todos los datos.
- [ ] El enlace valida el id (y la expiración, si se implementa) y no lee datos de otros operadores.
- [ ] El PDF es de texto real e incluye el estado (cerrado / PRELIMINAR).
- [ ] Todos los números van en `es-CL`.

## 21. Monitor regional

> **Archivos:** `app/(dashboard)/monitor-regional/page.tsx`, `lib/monitor.ts` (cálculos puros) y `components/monitor/`.
> **Referencia visual:** artboard *Monitor regional* del canvas.
> **Acceso:** solo administradores (igual que hoy; badge "Admin" en el sidebar).

### 21.1 Qué cambia

| Antes | Ahora |
|---|---|
| SLA y tiempo **incluyen Autopago** | SLA y tiempo **sin Autopago ni exonerados** (decisión 8); los números coinciden con la auditoría y el dashboard |
| 4 tarjetas: SLA, tiempo, "mejor" y "peor" moneda (solo por SLA) | 4 tarjetas: **SLA regional**, **Tiempo promedio**, **Retiros del mes** (con % de Autopago) y **Monedas bajo meta**, todas con comparación contra el mes anterior |
| — | **Una tarjeta por moneda** con estado (En meta / En riesgo / Bajo meta), SLA, variación, minigráfico de SLA diario, tiempo, retiros y brechas; al hacer clic se selecciona la moneda |
| Gráfico de barras con SLA (%) y volumen en dos ejes | **Mapa de calor del SLA diario por moneda** (cada celda abre la auditoría de ese día) |
| — | **Brechas por hora** de la moneda seleccionada con la **franja crítica** de 3 horas y un texto de lectura |
| — | **Días críticos:** los 5 peores días-moneda del mes |
| Tabla: región, volumen, SLA, tiempo | **Tabla comparativa** con % del total, % Autopago, Δ SLA, Δ tiempo, brechas, exonerados, franja crítica y fila de total |
| `<input type="month">` nativo | Selector de mes igual al del cierre (§19.5): flechas + popover de 12 meses, sin meses futuros |
| — | **Solo VIP** (decisión 2): filtra toda la vista |
| PDF por captura de pantalla | PDF con `jspdf-autotable` |

### 21.2 Datos

Una sola consulta por mes (la misma de hoy, sin cambios de índice):

```ts
query(collection(db, "operaciones_retiros"),
  where("Fecha del reporte", ">=", `${mes}-01T00:00:00.000Z`),
  where("Fecha del reporte", "<=", `${mes}-31T23:59:59.999Z`));
```

> El `-31` funciona también en meses de 28–30 días porque la comparación es de texto ISO.

Se piden **dos meses**: el seleccionado y el anterior (para las variaciones). Ambas consultas van en paralelo con `Promise.all`.

**Campos usados:** `Fecha del reporte`, `Fecha de la operación` (hora), `Moneda`, `Operador`, `Nivel`, `Cumple`, `Tiempo`, `comentarioBrecha`.

**Hora:** igual que la auditoría (§17.2): `"Fecha de la operación"` viene como `"YYYY-MM-DD HH:mm:ss"` → `Number(fecha.split(" ")[1]?.slice(0, 2))`. Si falta, el retiro no suma al gráfico por hora (sí al resto).

**Rendimiento:** el monitor lee todo el mes de todas las monedas (miles de documentos, dos veces). Es aceptable porque es una vista de administrador, pero se recomienda:

- guardar en `sessionStorage` el resultado ya agregado de los **meses cerrados** (no cambian), con clave `monitor:{mes}`;
- a futuro, un documento resumen por día y moneda (`resumen_diario/{fecha}_{moneda}`) que escriba `/api/upload-reporte` y `/api/fetch-api-reporte` al cargar el reporte. Con eso el monitor, el dashboard y el cierre leerían ~150 documentos por mes en vez de miles.

### 21.3 Cálculos (`lib/monitor.ts`)

Funciones puras, sin Firestore, para poder probarlas:

```ts
type Seg = { total: number; autopago: number; exonerados: number; evaluables: number;
             cumplidos: number; tiempoTotal: number; brechas: number; brechasHora: number[] };

export function agregarMes(ops: Op[], soloVip: boolean, limiteDia?: number): Record<Moneda, {
  mes: Seg; dias: (Seg & { dia: number; sla: number | null; tiempo: number | null })[];
}>;
```

| Dato | Fórmula |
|---|---|
| `total` | todos los retiros de la moneda (incluye Autopago y exonerados) |
| `autopago` | `Operador === "Autopago"` |
| `exonerados` | manuales con `isExonerated(comentarioBrecha)` |
| `evaluables` | manuales no exonerados |
| `cumplidos` | evaluables con `Cumple === true` |
| `brechas` | `evaluables − cumplidos` |
| **SLA** | `cumplidos / evaluables × 100` (null si `evaluables = 0`) |
| **Tiempo** | `Σ Tiempo (evaluables) / evaluables` |
| `brechasHora[h]` | brechas cuya hora de operación es `h` |
| **Franja crítica** | ventana de 3 horas consecutivas (`h, h+1, h+2`, con `h` de 0 a 21) con más brechas; empate → la más temprana |
| VIP | `Nivel` en `"Nivel 2" \| "Nivel 3" \| "Nivel 4"` (igual que §7.1) |

**SLA y tiempo regional:** se suman los conteos de todas las monedas (`Σ cumplidos / Σ evaluables`), **no** se promedian los porcentajes de cada moneda.

**Estado de cada moneda:**

| Estado | Condición | Chip |
|---|---|---|
| Bajo meta | `sla < 90` **o** `tiempo > 25` | danger-soft |
| En riesgo | `sla < 92` **o** `tiempo > 22` | warning-soft |
| En meta | el resto | success-soft |

Los márgenes de riesgo (92% y 22 min) van en `lib/constants.ts` junto a las metas (§13): `SLA_RIESGO = 92`, `TIEMPO_RIESGO = 22`.

**Comparación con el mes anterior:**

- Mes cerrado → contra el mes anterior completo.
- **Mes en curso** → contra **los mismos días** del mes anterior (`limiteDia` = último día con datos). Si no, el volumen aparece siempre cayendo ~80%.
- Formatos: SLA en `±x,x pts`, tiempo en `±x,x min` (bueno si baja), retiros en `±x%`, monedas bajo meta en `±n vs {mes}` o `igual que {mes}`.

**Texto de lectura de la franja crítica:**

```ts
const pct = Math.round(franja.brechas / m.brechas * 100);
const estimado = Math.min(100, (m.cumplidos + franja.brechas * 0.6) / m.evaluables * 100);
`El ${pct}% de las brechas de ${moneda} (${franja.brechas} de ${m.brechas}) ocurre entre ${hh}:00 y ${hh+3}:00. ` +
`Reforzar esa franja y recuperar 6 de cada 10 de esas brechas llevaría el SLA de ${moneda} a ~${fmt(estimado)}%.`
```

El 0,6 es un supuesto para dar una orden de magnitud; se deja como constante `RECUPERACION_ESTIMADA = 0.6`. Sin brechas: "Sin brechas este mes."

### 21.4 Layout

```
Analítica y desempeño / Monitor regional                                         [☀]
Monitor regional [Mes completo]                [‹] [📅 Septiembre 2026 ⌄] [›] | [Solo VIP ○] [PDF]
SLA, tiempo y cuellos de botella por moneda · Septiembre 2026

[SLA regional] [Tiempo promedio] [Retiros del mes] [Monedas bajo meta]

[CLP · Chile] [PEN · Perú ●] [MXN · México] [USD · Dólar] [VES · Venezuela]   ← tarjetas, una seleccionada

┌ SLA diario por moneda (mapa de calor, días 1–30) ──────────────────────────────┐
└────────────────────────────────────────────────────────────────────────────────┘
┌ Brechas por hora · PEN ────────────────────────┐ ┌ Días críticos ───────────┐
│ 24 barras · franja crítica en rojo · lectura    │ │ 5 filas con enlace       │
└─────────────────────────────────────────────────┘ └──────────────────────────┘
┌ Comparativo por moneda (tabla + total) ────────────────────────────────────────┐
```

```tsx
<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
  <MonitorHeader />
  {soloVip && <VipBanner />}
  <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr))]">{/* 4 KpiCard */}</div>
  <CurrencyCards className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(208px,100%),1fr))]" />
  <SlaHeatmap />
  <div className="flex flex-wrap items-stretch gap-3.5">
    <HourlyGaps className="min-w-0 flex-[1.6_1_520px]" />
    <WorstDays className="min-w-0 flex-[1_1_340px]" />
  </div>
  <ComparisonTable />
</div>
```

```
components/monitor/
  MonitorHeader.tsx · CurrencyCards.tsx · SlaHeatmap.tsx · HourlyGaps.tsx
  WorstDays.tsx · ComparisonTable.tsx · exportMonitorPdf.ts
lib/monitor.ts
```

**Estado de la página:** `mes` (`?mes=YYYY-MM` en la URL, por defecto el mes actual), `soloVip` (local), `monedaSel` (por defecto la moneda **con peor estado**; si empatan, la de menor SLA).

### 21.5 Encabezado

- Breadcrumb: "Analítica y desempeño / Monitor regional".
- `<h1>` "Monitor regional" + chip: **"En curso · {n} días"** (`bg-brand-soft text-brand`) si es el mes actual, **"Mes completo"** (`bg-muted text-muted-foreground`) si no.
- Subtítulo: "SLA, tiempo y cuellos de botella por moneda · {Mes año}".
- Acciones:
  - **Selector de mes** igual al de §19.5 (flechas + popover 3×4 con año), sin la leyenda Cerrado/Sin cerrar. Meses futuros deshabilitados; "›" deshabilitada en el mes actual.
  - **Solo VIP:** el mismo switch del dashboard (§8). Al activarlo aparece el aviso `bg-brand-soft`: "Mostrando solo retiros VIP (Nivel 2, 3 y 4). Todas las tarjetas, el mapa y la tabla usan este filtro."
  - **PDF** (§21.10).

### 21.6 Tarjetas resumen (4)

Mismo estilo que el dashboard (cuadro de ícono 32px + título 500 + valor 28px + pill + caption):

| Tarjeta | Ícono | Valor | Pill | Caption |
|---|---|---|---|---|
| SLA regional | `CircleCheck` (`--ic-green`) | `90,1%` (danger si < 90) | `±x,x pts` | "Meta 90% · sin Autopago ni exonerados" |
| Tiempo promedio | `Clock` (`--ic-amber`) | `17,9 min` (danger si > 25) | `±x,x min` (verde si baja) | "Meta 25 min · solo gestión manual" |
| Retiros del mes | `Globe` (`--ic-blue`) | `9.725` | `±x%` | "{x}% por Autopago · {n} monedas" |
| Monedas bajo meta | `TriangleAlert` (danger si > 0, si no `--ic-violet`) | `2 de 5` | `+n vs {mes}` / `igual que {mes}` | "PEN · VES · SLA < 90% o tiempo > 25 min" o "Todas las monedas cumplen SLA y tiempo" |

### 21.7 Tarjetas por moneda

Botones (`<button aria-pressed>`) en grid; orden fijo **CLP, PEN, MXN, USD, VES** (las monedas sin retiros en el mes no se muestran).

- Fila 1: código (mono 600, `bg-muted rounded-md px-1.5`) + país (muted, truncado) · chip de estado (§21.3).
- Fila 2: SLA (26px, 700; danger si < 90) · pill de variación en pts.
- **Minigráfico** (SVG `viewBox="0 0 200 44"`, `preserveAspectRatio="none"`, `vector-effect="non-scaling-stroke"`): línea del SLA de cada día con datos, escala fija **60–100%**, línea punteada en 90%. Color de la línea: `--success` si el SLA del mes ≥ 90, `--danger` si no. `aria-label`: "SLA diario de PEN: 30 días, 9 bajo 90%".
- Fila 3 (borde superior): Tiempo · Retiros · Brechas (mono 13px 600; tiempo en danger si > 25).
- **Seleccionada:** `ring-1 ring-brand border-brand`. La selección resalta la fila de la moneda en el mapa y en la tabla, y cambia el gráfico por hora.
- Países: CLP Chile, PEN Perú, MXN México, USD Dólar, VES Venezuela (constante `PAIS_MONEDA`).

### 21.8 Mapa de calor, brechas por hora y días críticos

**SLA diario por moneda** (`<section>`):

- Encabezado + texto "Cada celda es un día. Haz clic en una celda para abrir la auditoría de ese día filtrada por moneda." + leyenda (≥ 90% `--success`, 80–89,9% `--warning`, < 80% `--danger`, sin datos `--muted`).
- Filas: una por moneda (etiqueta mono 48px; la seleccionada en 700 y `text-foreground`, el resto muted y celdas al 80% de opacidad). Columnas: días del mes (`flex-1`, 26px de alto, `rounded` 4px, `gap-1`). Eje inferior con 1, 5, 10, 15, 20, 25, 30.
- Cada celda es un `<Link>` a `/auditoria-diaria?fecha=YYYY-MM-DD&moneda={moneda}` con `title`/`aria-label`: "PEN · mar 15 sep: SLA 71,1% · 31,4 min · 12 brechas de 84 retiros". Hover: `outline-2 outline-foreground -outline-offset-1`.
- Días futuros o sin reporte: celda gris, sin enlace.
- Contenedor `overflow-x-auto` con `min-w-[760px]`. `role="img"` en el bloque con un resumen ("… 23 días-moneda bajo 90%. El detalle está en la tabla comparativa.").

**Brechas por hora · {moneda}:**

- 24 barras (00–23) con el conteo encima (mono 10px; vacío si es 0). Altura proporcional al máximo (82% del alto útil). Franja crítica en `--danger`, el resto en `--bar` (gris del tema: `rgba(255,255,255,0.16)` oscuro, `#D4D4D8` claro).
- Eje: 00, 06, 12, 18, 23. `title` por barra: "19:00 · 31 brechas · franja crítica".
- Debajo, la lectura de §21.3 en un recuadro `bg-muted` con ícono `Lightbulb` (`text-warning-text`).
- Se puede hacer con Recharts (`BarChart` + `Cell` por barra) o con un flex de 24 columnas como en el mockup.

**Días críticos:**

- Los 5 días-moneda con menor SLA del mes (respetando Solo VIP). Cada fila es un enlace a la auditoría de ese día y moneda: código · "sáb 26 sep" (600) · "31,0 min · 14 brechas de 70" (muted) · SLA (mono 700; warning si ≥ 80, danger si < 80) · ícono ↗.

### 21.9 Tabla comparativa

`min-w-[980px]`, filas de 46px, la fila de la moneda seleccionada con `bg-muted`.

| Columna | Contenido |
|---|---|
| Moneda | código (mono 600) + país (muted) |
| Retiros | total |
| % del total | `total / Σ total` |
| Autopago | `autopago / total` |
| SLA | mono 700; danger si < 90 |
| Δ SLA | `±x,x pts` verde/rojo; `=` muted |
| Tiempo | `x,x min`; danger si > 25 |
| Δ Tiempo | `±x,x min` (verde si baja) |
| Brechas | `evaluables − cumplidos` |
| Exonerados | muted |
| Franja crítica | `19–22 h` o "—" |

Fila final **Total** (600, sin borde inferior) con los conteos sumados y el SLA y tiempo regionales. Encabezado de la sección: "SLA y tiempo sin Autopago ni exonerados · variación contra {mes anterior}" (en el mes en curso: "… contra los mismos {n} días de {mes}").

### 21.10 PDF

`Monitor_Regional_{YYYY-MM}[_VIP].pdf`, A4 horizontal, con `jsPDF` + `jspdf-autotable`:

1. Cabecera: logo, "Monitor regional · {Mes año}", "Solo VIP" si aplica y "Mes en curso ({n} días)" si corresponde.
2. Las 4 tarjetas como cajas de resumen.
3. Tabla por moneda: estado, SLA, Δ, tiempo, Δ, retiros, brechas, franja crítica.
4. Mapa de calor como tabla de celdas coloreadas (`didParseCell` pinta el fondo según el SLA; texto con el SLA en 7pt).
5. Días críticos.
6. Pie: "Generado por {usuario} · {fecha}".

Se elimina el flujo actual de `toPng` (cambio de viewport, overlay y `data-html2canvas-ignore`).

### 21.11 Estados

- **Cargando:** skeleton de 4 tarjetas, 5 tarjetas de moneda, el bloque del mapa (5 filas grises) y la tabla (5 filas), como §10.
- **Sin datos en el mes:** skeleton estático + pill "No hay retiros cargados en {mes}. Cárgalos desde Reportes." con enlace a `/reportes` (mismo patrón que el dashboard, sin tarjeta de atajo).
- **Solo VIP sin retiros VIP:** "No hay retiros VIP en {mes}."
- **Error:** toast "No se pudo cargar el monitor regional" + botón "Reintentar" en el lugar del contenido.

### 21.12 Responsive y accesibilidad

- Tarjetas resumen y de moneda: grid `auto-fit` (bajan a 2 y 1 columna).
- Mapa de calor y tabla: scroll horizontal propio; la página nunca hace scroll horizontal.
- Brechas por hora: bajo 640px se muestra el conteo solo en la franja crítica.
- Tarjetas de moneda con `aria-pressed`; celdas del mapa con `aria-label` completo; gráficos con `role="img"` y resumen. El color nunca es la única señal: estado en texto, SLA en número, franja crítica nombrada en la lectura.
- Números en `es-CL` (§11).

### 21.13 Checklist del Monitor regional

- [ ] SLA y tiempo de cada moneda y el regional excluyen Autopago y exonerados, y coinciden con la auditoría y el dashboard del mismo período.
- [ ] El SLA regional se calcula con conteos sumados, no con el promedio de porcentajes.
- [ ] El estado de cada moneda considera SLA **y** tiempo; los márgenes de riesgo están en constantes.
- [ ] El mes en curso se compara contra los mismos días del mes anterior.
- [ ] Solo VIP filtra tarjetas, monedas, mapa, gráfico por hora, días críticos, tabla y PDF.
- [ ] Al seleccionar una moneda se actualizan el gráfico por hora y el resaltado del mapa y la tabla; por defecto aparece la peor.
- [ ] Las celdas del mapa y los días críticos abren `/auditoria-diaria` con fecha y moneda.
- [ ] La franja crítica y la lectura usan los mismos números que el gráfico.
- [ ] El selector de mes no permite meses futuros; `?mes=` en la URL se respeta al recargar.
- [ ] El PDF es de texto real y ya no usa `toPng`.
- [ ] Todos los números van en `es-CL`.

## 22. Gestión de usuarios y primer ingreso

> **Archivos:** `app/(dashboard)/gestor-usuarios/page.tsx`, `app/cambiar-credenciales/page.tsx`, `app/context/AuthContext.tsx`, `lib/authServer.ts` (nuevo), `lib/apiFetch.ts` (nuevo), `lib/roles.ts`, las rutas `app/api/usuarios/*` (nuevas; reemplazan a `crear-usuario`, `cambiar-password` y `toggle-estado-usuario`), `firestore.rules` y `components/usuarios/`.
> **Referencia visual:** artboards *Gestión de usuarios* y *Primer ingreso — elegir contraseña* del canvas.
> **Acceso a la vista:** solo administradores (igual que hoy).

> ⚠️ **Prioridad alta, independiente del rediseño (§22.2):** hoy las rutas de la API **no verifican quién las llama**. Cualquiera que conozca la URL de la app puede, sin iniciar sesión, crear un administrador, cambiar la contraseña de cualquier usuario o desactivar cuentas. Conviene aplicar §22.2 y §22.5 antes que el resto.

### 22.1 Qué cambia

| Antes | Ahora |
|---|---|
| Rutas de usuarios **sin autenticación**; el bloqueo de admins usa el `rol` que manda el navegador | Cada ruta valida el **token de Firebase** y el **rol leído en el servidor** (`requireAdmin`) |
| Contraseña temporal de 8 caracteres con `Math.random` en el navegador | La genera **el servidor** con `crypto.randomInt`: 12 caracteres sin ambiguos (`Xk7m-Qp4r-Tz9w`) y **vence en 72 h** |
| Desactivar o restablecer no cierra sesiones abiertas | `revokeRefreshTokens` + la app saca al usuario desactivado aunque esté dentro |
| Los admins no se pueden desactivar nunca | Un admin se puede desactivar **si queda otro admin activo**; nadie puede desactivarse ni cambiarse el rol a sí mismo |
| No se puede editar nombre ni rol | **Editar usuario:** nombre y rol |
| Tabla: empleado, correo, rol, estado | Tabla con avatar, "Tú", rol + monedas, estado **Activo / Pendiente / Inactivo**, **último acceso** y 3 acciones |
| — | 4 tarjetas, búsqueda, filtros por rol y estado |
| — | **Actividad reciente** con registro de cambios (`auditoria_usuarios`) |
| Modales propios con estilos fijos (`bg-white`, `slate`) | `Dialog` / `AlertDialog` de shadcn con los tokens del tema |
| Primer ingreso: 6 caracteres mínimo, sin validaciones visibles | Página con el estilo del login (§15), medidor de seguridad y requisitos en vivo (mínimo 10, letras y números, sin el nombre) |

### 22.2 Seguridad de la API

**`lib/authServer.ts`** (solo servidor):

```ts
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { NextResponse } from "next/server";

export type Sesion = { uid: string; nombre: string; rol: Rol; email: string };

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requireUser(req: Request): Promise<Sesion> {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Inicia sesión para continuar.");
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token, true);   // true = rechaza tokens revocados
  } catch {
    throw new HttpError(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
  }
  const snap = await adminDb.collection("usuarios").doc(decoded.uid).get();
  const u = snap.data();
  if (!u || u.activo === false) throw new HttpError(403, "Tu acceso está desactivado.");
  return { uid: decoded.uid, nombre: u.nombre, rol: u.rol, email: u.email };
}

export async function requireAdmin(req: Request): Promise<Sesion> {
  const s = await requireUser(req);
  if (s.rol !== "admin") throw new HttpError(403, "Solo un administrador puede hacer esto.");
  return s;
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ success: false, error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ success: false, error: "Ocurrió un error inesperado." }, { status: 500 });
}
```

**`lib/apiFetch.ts`** (cliente): todas las llamadas a `/api/*` pasan por aquí para enviar el token.

```ts
import { auth } from "@/lib/firebase";

export async function apiFetch(url: string, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error ?? "Error de red.");
  return data;
}
```

**Qué exige cada ruta:**

| Ruta | Exige |
|---|---|
| `api/usuarios/*` | `requireAdmin` (salvo `api/usuarios/yo/cambio-password`: `requireUser`) |
| `api/upload-reporte`, `api/fetch-api-reporte`, `api/delete-reporte`, `api/sincronizar-evaluaciones`, `api/cerrar-mes`, `api/reportes` | `requireUser` (hoy tampoco validan sesión; se agrega con el mismo helper sin cambiar quién puede usarlas) |

> El rol **siempre** sale de `usuarios/{uid}` leído en el servidor. Nunca del body.

### 22.3 Modelo de datos

**`usuarios/{uid}`** (campos nuevos en negrita):

| Campo | Tipo | Nota |
|---|---|---|
| `nombre` | string | |
| `email` | string | en minúsculas; no se edita |
| `rol` | `"admin" \| "agente_retiros_internacional" \| "agente_retiros_nacional"` | validado contra `ROLES` |
| `activo` | boolean | |
| `debeCambiarPassword` | boolean | `true` mientras use la contraseña temporal |
| **`tempPassExpira`** | ISO string \| null | `ahora + 72 h` al crear o restablecer; `null` al cambiarla |
| `fechaCreacion` | ISO string | |
| **`creadoPor`** / **`creadoPorUid`** | string | |
| **`actualizadoEl`** / **`actualizadoPor`** | string | último cambio de nombre, rol o estado |

**`auditoria_usuarios/{autoId}`** (nueva, solo la escribe el servidor):

```ts
{ accion: "crear" | "editar" | "rol" | "restablecer" | "desactivar" | "reactivar" | "cambio_password",
  objetivoUid, objetivoNombre, porUid, porNombre, el: ISO,
  detalle?: { rolAnterior?, rolNuevo?, nombreAnterior? } }
```

**`lib/roles.ts`**: se agrega un catálogo único para la UI y la API.

```ts
export const ROLES = {
  admin: { label: "Administrador", monedas: "Todas las vistas",
    desc: "Acceso total: monitor regional, gestión de usuarios, cierre de cualquier grupo." },
  agente_retiros_internacional: { label: "Agente internacional", monedas: "CLP · PEN · MXN · USD",
    desc: "Reportes, evaluación, auditoría y cierre del grupo internacional." },
  agente_retiros_nacional: { label: "Agente nacional", monedas: "VES",
    desc: "Reportes, evaluación, auditoría y cierre del grupo nacional." },
} as const;
export type Rol = keyof typeof ROLES;
export const esRolValido = (r: unknown): r is Rol => typeof r === "string" && r in ROLES;
```

### 22.4 Rutas de la API (`app/api/usuarios/`)

Todas (salvo `yo/cambio-password`) empiezan con `const yo = await requireAdmin(req)`, van dentro de `try { … } catch (e) { return errorResponse(e); }` y escriben un documento en `auditoria_usuarios`.

**Contraseña temporal** (`lib/passwordTemporal.ts`, servidor):

```ts
import { randomInt } from "node:crypto";
const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // sin 0 O 1 l I
export function passwordTemporal() {
  const c = Array.from({ length: 12 }, () => A[randomInt(A.length)]).join("");
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}
```

**Regla del último admin** (helper compartido):

```ts
async function adminsActivos() {
  const s = await adminDb.collection("usuarios").where("rol", "==", "admin").where("activo", "==", true).get();
  return s.size;
}
```

| Ruta | Body | Hace | Rechaza con |
|---|---|---|---|
| `GET /api/usuarios` | — | Lista `usuarios` y le suma `ultimoAcceso` desde Auth (`adminAuth.getUsers(ids)` en lotes de 100 → `metadata.lastSignInTime`) | — |
| `POST /api/usuarios` | `{ nombre, email, rol }` | Genera la contraseña, `createUser`, crea el doc con `debeCambiarPassword: true` y `tempPassExpira`. **Devuelve la contraseña una sola vez** | 400 datos inválidos o rol desconocido · 409 "Ya existe un usuario con este correo." |
| `PATCH /api/usuarios/[uid]` | `{ nombre?, rol? }` | Actualiza `usuarios` y `displayName` en Auth | 403 si `uid === yo.uid` y cambia `rol` · 409 si quita el rol admin al **último admin activo** |
| `POST /api/usuarios/[uid]/restablecer` | — | Nueva contraseña temporal, `debeCambiarPassword: true`, `tempPassExpira`, **`revokeRefreshTokens(uid)`**. Devuelve la contraseña | — |
| `POST /api/usuarios/yo/cambio-password` | — | **`requireUser`** (no admin): escribe `cambio_password` en `auditoria_usuarios` para el propio uid | — |
| `POST /api/usuarios/[uid]/estado` | `{ activo }` | `updateUser({ disabled: !activo })`, `activo` en Firestore y, si desactiva, **`revokeRefreshTokens(uid)`** | 403 si `uid === yo.uid` · 409 si es el último admin activo |

> El rol del usuario objetivo se lee de Firestore en el servidor (ya no se recibe `rol` en el body de `estado`).

**Mensaje para copiar** (lo arma el cliente con lo que devuelve la API):

```
Hola {nombre}, ya tienes acceso a PayoutMetrics.
Usuario: {email}
Contraseña temporal: {password}
Vence en 72 horas. Al entrar, el sistema te pedirá elegir una propia.
```

### 22.5 Reglas de Firestore

```
function signedIn() { return request.auth != null; }
function me() { return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data; }
function isAdmin() { return signedIn() && me().rol == "admin" && me().activo == true; }

match /usuarios/{uid} {
  allow read: if signedIn() && (request.auth.uid == uid || isAdmin());
  allow create, delete: if false;                       // solo el servidor (Admin SDK)
  // el propio usuario solo puede apagar su bandera de contraseña temporal
  allow update: if signedIn() && request.auth.uid == uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["debeCambiarPassword", "tempPassExpira"])
    && request.resource.data.debeCambiarPassword == false
    && request.resource.data.tempPassExpira == null;
}

match /auditoria_usuarios/{id} {
  allow read: if isAdmin();
  allow write: if false;                                // solo el servidor
}
```

> Sin la regla de `update`, hoy un usuario podría escribir `rol: "admin"` en su propio documento desde la consola del navegador.
> Si la página de usuarios lee directo de Firestore en vez de `GET /api/usuarios`, la regla `read` con `isAdmin()` ya lo permite; pero el **último acceso** solo sale de Auth, así que se recomienda la ruta.

### 22.6 Sesión (`AuthContext`)

- Al leer `usuarios/{uid}`:
  - **`activo === false`** → `signOut()` y redirigir a `/login?motivo=desactivado`. El login muestra: "Tu acceso está desactivado. Habla con un administrador."
  - **Sin documento** → igual, con `motivo=sin-perfil`: "Tu usuario no tiene perfil en el sistema."
  - **`debeCambiarPassword` y `tempPassExpira < ahora`** → `signOut()` y `motivo=temporal-vencida`: "Tu contraseña temporal venció. Pide a un administrador que la restablezca."
- Se cambia `getDoc` por `onSnapshot` del propio documento: si un admin lo desactiva o le cambia el rol mientras está dentro, la app reacciona sin recargar (con la desactivación, además, sus tokens ya fueron revocados).
- `userData` pasa a tiparse como `{ nombre, email, rol: Rol, activo, debeCambiarPassword, tempPassExpira }` en vez de `any`.
- La lectura de `isAdmin` en `Sidebar.tsx` se reemplaza por `parseUserRole(userData?.rol).isAdmin` (hoy repite la lógica con `includes`).

### 22.7 Layout

```
Administración / Gestión de usuarios                                              [☀]
Gestión de usuarios                                                    [+ Nuevo usuario]
Accesos, roles y contraseñas del equipo

[Usuarios activos] [Administradores] [Pendientes de primer ingreso] [Inactivos]

┌ [🔍 Buscar…]   [Todos|Admin 2|Internacional 6|Nacional 2] [Todos|Activos|Pendientes 1|Inactivos] ┐ ┌ Actividad reciente ┐
│ Usuario · Rol · Estado · Último acceso · Acciones (✎ 🔑 ⊘)                                     │ │ • …                │
│ …                                                                                              │ │                    │
│ Mostrando 10 de 10 usuarios                                                                    │ └────────────────────┘
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

```tsx
<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 pb-9 pt-6 md:px-7">
  <UsersHeader onCreate={…} />
  <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">{/* 4 KpiCard */}</div>
  <div className="flex flex-wrap items-start gap-3.5">
    <UsersTable className="min-w-0 flex-[2.4_1_640px]" />
    <UserActivity className="min-w-0 flex-[1_1_300px]" />
  </div>
</div>
```

```
components/usuarios/
  UsersHeader.tsx · UsersTable.tsx · UserActivity.tsx · RoleRadioCards.tsx
  CreateUserDialog.tsx · EditUserDialog.tsx · ConfirmDialog.tsx · CredentialsResult.tsx
```

### 22.8 Tarjetas y tabla

**Tarjetas** (estilo del dashboard, sin pill):

| Tarjeta | Ícono | Valor | Caption |
|---|---|---|---|
| Usuarios activos | `Users` (`--ic-blue`) | activos + pendientes | "de {n} registrados" |
| Administradores | `Shield` (`--ic-violet`) | total admins | "{n} activos · siempre debe quedar al menos 1" |
| Pendientes de primer ingreso | `KeyRound` (`--ic-amber`) | `debeCambiarPassword && activo` | "Con contraseña temporal sin cambiar" |
| Inactivos | `Ban` (`--ic-rose`, nuevo token: `#FB7185` oscuro / `#BE123C` claro) | `!activo` | "Sin acceso; su historial se conserva" |

**Barra de filtros:** `Input` de búsqueda con ícono (busca en nombre y correo, sin tildes ni mayúsculas) y dos grupos segmentados (`ToggleGroup type="single"`): rol con contador y estado (Pendientes con contador).

**Tabla** (`min-w-[760px]`, filas de 58px; tu fila primero, luego activos y pendientes por nombre, al final inactivos con `opacity-60`):

| Columna | Contenido |
|---|---|
| Usuario | avatar 34px con iniciales (admins: `bg-violet/15 text-violet`; resto: `bg-brand-soft text-brand`), nombre 600 + chip **"Tú"**, correo muted debajo |
| Rol | `ROLES[rol].label` (500) y debajo `ROLES[rol].monedas` (mono 11px, muted) |
| Estado | chip con punto: **Activo** (success-soft) · **Pendiente** (warning-soft; `title`: "Aún no cambia la contraseña temporal · creado el {fecha} por {nombre}") · **Inactivo** (muted). Si la temporal venció: **Temporal vencida** (danger-soft) |
| Último acceso | "Hace 25 min", "Hace 4 h", "Ayer", "Hace 3 días"; **"Nunca"** en muted |
| Acciones | 3 botones 32×32 con `aria-label` y `Tooltip`: **Editar** (lápiz), **Restablecer contraseña** (llave, `--ic-amber`), **Desactivar** (prohibido, `text-danger-text`) / **Reactivar** (usuario con check, `text-success-text`) |

- Desactivar queda **deshabilitado** en tu fila ("No puedes desactivar tu propia cuenta") y en el último admin activo ("Es el único administrador activo").
- Sin resultados: "No hay usuarios que coincidan con la búsqueda o los filtros."
- Pie: "Mostrando {n} de {total} usuarios".

### 22.9 Diálogos

**Nuevo usuario** (`Dialog`, `max-w-[480px]`):
- Texto: "Se genera una contraseña temporal. La persona la cambia en su primer ingreso."
- **Nombre completo** (mínimo 2 caracteres).
- **Correo:** se valida al escribir. Ayuda: "Será su usuario para iniciar sesión." Errores: "Escribe un correo válido." / "Ya existe un usuario con este correo." (borde `--danger`, `aria-invalid`). El 409 del servidor muestra el mismo mensaje.
- **Rol:** `RoleRadioCards` (`RadioGroup` con tarjetas: título + descripción de `ROLES`). Por defecto, Agente internacional.
- Botones: **Cancelar** / **Crear y generar contraseña** (deshabilitado hasta que todo sea válido; spinner al enviar).
- Al terminar, el mismo diálogo muestra **`CredentialsResult`**.

**`CredentialsResult`** (crear y restablecer):
- Ícono check en círculo `bg-success-soft`, título "{nombre} fue creado" o "Contraseña restablecida" y "Envíale estos datos por un canal privado."
- Caja `bg-muted` con `<dl>`: Usuario (mono) y **Contraseña temporal** (mono 15px, 700).
- Aviso warning-soft: "Esta contraseña no se vuelve a mostrar. Si se pierde, restablécela de nuevo. Vence en 72 horas si no se usa."
- Botones: **Listo** / **Copiar mensaje** (pasa a "Copiado" + toast). Mientras se muestra no se cierra con clic afuera ni con Escape, para no perder la contraseña por accidente.

**Editar usuario** (`Dialog`):
- Encabezado con avatar 44px, "Editar usuario" y "Creado el {fecha} por {nombre} · último acceso: {relativo}".
- Nombre (editable), correo (solo lectura, `bg-muted`) con: "El correo es el usuario de acceso y no se cambia. Si cambió, crea un usuario nuevo y desactiva este."
- Rol con `RoleRadioCards`. **Bloqueado** (las otras opciones deshabilitadas) en tu propio usuario ("No puedes cambiar tu propio rol. Pídeselo a otro administrador.") y en el último admin activo ("Es el único administrador activo: asigna otro antes de cambiar su rol.").
- **Guardar cambios** se habilita solo si algo cambió. Toast: "Cambios guardados" y, si cambió el rol, ". El nuevo rol aplica en su próxima carga de página." (con `onSnapshot`, §22.6, aplica al instante).

**Restablecer contraseña** (`AlertDialog`):
- "¿Restablecer la contraseña de {nombre}?" · "Se genera una contraseña temporal nueva y se cierran sus sesiones abiertas. Al entrar, tendrá que elegir una propia."
- **Cancelar** / **Generar contraseña** (`bg-warning`) → `CredentialsResult`.

**Desactivar** (`AlertDialog`):
- "¿Desactivar a {nombre}?" · "No podrá iniciar sesión y se cerrarán sus sesiones abiertas. Sus evaluaciones, cierres y su historial se conservan. Puedes reactivarlo cuando quieras."
- **Cancelar** / **Desactivar** (`bg-danger`). Toast: "{nombre} ya no tiene acceso".
- **Reactivar** no pide confirmación. Toast: "{nombre} vuelve a tener acceso".

> Los usuarios **no se eliminan**: su nombre está en evaluaciones, cierres y auditorías. Desactivar es la baja.

### 22.10 Actividad reciente

- Lee `auditoria_usuarios` ordenado por `el desc`, `limit(8)`, de los últimos 30 días (índice simple por `el`).
- Cada fila: punto de color (crear/reactivar `--success`, restablecer `--warning`, desactivar `--danger`, rol/editar `--brand`, cambio de contraseña propio `--brand`), texto y fecha.
- Textos:
  - "{por} creó a {objetivo} como {rol}"
  - "{por} cambió el rol de {objetivo}: {rolAnterior} → {rolNuevo}"
  - "{por} restableció la contraseña de {objetivo}"
  - "{por} desactivó a {objetivo}" / "{por} reactivó a {objetivo}"
  - "{objetivo} cambió su contraseña temporal"
- Fecha: "Ahora", "Hace 15 min", "Ayer, 16:40" o "2 oct, 09:12".
- Al final, enlace "Ver todo" (recomendado) a un `Sheet` con la lista completa y filtro por usuario.

### 22.11 Primer ingreso (`/cambiar-credenciales`)

Mismo fondo, vidrio y tokens del login opción C (§15), en claro y oscuro según el sistema.

- Sobre el título, un chip con la inicial y el correo de la sesión.
- Título "Elige tu contraseña" · "Entraste con una contraseña temporal. Crea una propia para continuar; la temporal deja de funcionar."
- **Nueva contraseña** y **Repite la contraseña**, con un solo botón de ojo que muestra u oculta ambas (`autocomplete="new-password"`).
- **Medidor** de 4 segmentos bajo la primera: Débil (`--red`) · Aceptable (`--amber`) · Buena / Fuerte (`--good`).

  ```ts
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 10) score++;
  if (/[a-zñáéíóú]/i.test(p) && /\d/.test(p)) score++;
  if (/[A-Z]/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  score = Math.max(p ? 1 : 0, score);
  ```

- **Requisitos** con check verde al cumplirse (y texto oculto "(cumplido)" / "(pendiente)" para lectores de pantalla):
  1. Al menos 10 caracteres
  2. Letras y números
  3. No contiene tu nombre ni tu correo (sin tildes ni mayúsculas; se compara con el nombre y la parte antes de la `@`)
  4. Las dos contraseñas coinciden
- **Guardar y entrar** deshabilitado hasta cumplir los 4. Al guardar:

  ```ts
  await updatePassword(user, nueva);
  await updateDoc(doc(db, "usuarios", user.uid), { debeCambiarPassword: false, tempPassExpira: null });
  await apiFetch("/api/usuarios/yo/cambio-password", { method: "POST" }); // solo registra en auditoria_usuarios
  ```

- Si Firebase responde `auth/requires-recent-login`, se muestra el aviso de error: "Tu sesión expiró. Vuelve a iniciar sesión con la contraseña temporal." y el enlace de salir.
- "Cerrar sesión y salir" como enlace de texto debajo del botón.
- Recomendado: activar la **política de contraseñas** de Firebase Authentication (mínimo 10, exige número) para que la regla también se cumpla del lado de Firebase.

### 22.12 Responsive y accesibilidad

- Tarjetas en grid `auto-fit`; tabla con scroll horizontal propio; la actividad baja debajo de la tabla en pantallas angostas.
- Filtros: los dos grupos segmentados pasan a dos líneas; bajo 480px el filtro de rol se vuelve `Select`.
- Diálogos a ancho completo en móvil con `max-h-[90dvh] overflow-y-auto`.
- `RoleRadioCards` es un `RadioGroup` real (flechas para moverse). Los botones de acción tienen `aria-label` con el nombre de la persona. Los estados no dependen solo del color (texto en el chip).

### 22.13 Checklist de Gestión de usuarios

- [ ] **Sin token, todas las rutas de `/api/*` responden 401**; con token de un agente, `api/usuarios/*` responde 403.
- [ ] El rol nunca se toma del body; un rol desconocido se rechaza.
- [ ] Un usuario no puede modificar su propio `rol` ni `activo` desde Firestore (reglas probadas en el emulador).
- [ ] La contraseña temporal se genera en el servidor con `crypto`, tiene 12 caracteres y vence a las 72 h.
- [ ] Restablecer y desactivar revocan sesiones; un usuario desactivado que estaba dentro sale de la app.
- [ ] No se puede desactivar ni cambiar el rol de uno mismo, ni dejar el sistema sin admin activo (probado también por API directa).
- [ ] Crear con un correo existente muestra "Ya existe un usuario con este correo." (409).
- [ ] El último acceso coincide con `lastSignInTime` de Firebase Auth; "Nunca" si no hay.
- [ ] Cada acción deja su registro en `auditoria_usuarios` y aparece en Actividad reciente.
- [ ] La contraseña temporal solo se ve una vez y el diálogo no se cierra por accidente.
- [ ] El primer ingreso exige los 4 requisitos; la temporal vencida saca al usuario con el mensaje correcto.
- [ ] Se borraron las rutas viejas `crear-usuario`, `cambiar-password` y `toggle-estado-usuario`.
