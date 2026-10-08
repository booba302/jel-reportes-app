"use client";

import { useSyncExternalStore } from "react";

/** true si la media query coincide (false en el servidor). */
export function useMediaQuery(q: string) {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(q);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(q).matches,
    () => false,
  );
}
