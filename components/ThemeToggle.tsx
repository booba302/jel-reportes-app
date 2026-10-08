"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

const subscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // En el servidor no se conoce el tema: se asume oscuro (el default) hasta montar.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
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
