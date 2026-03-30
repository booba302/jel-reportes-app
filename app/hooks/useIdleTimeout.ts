// src/hooks/useIdleTimeout.ts
import { useEffect, useRef } from "react";

export const useIdleTimeout = (
  timeoutMinutes: number,
  onTimeout: () => void,
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Usamos un ref para la función callback, así evitamos que el useEffect
  // se reinicie innecesariamente en cada renderizado de React
  const callbackRef = useRef(onTimeout);

  useEffect(() => {
    callbackRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    // Eventos que consideraremos como "actividad" del usuario
    const events = ["mousemove", "keydown", "wheel", "click", "touchstart"];

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(
        () => {
          callbackRef.current();
        },
        timeoutMinutes * 60 * 1000,
      ); // Convertimos minutos a milisegundos
    };

    const handleEvent = () => resetTimer();

    // Iniciamos el cronómetro la primera vez
    resetTimer();

    // Agregamos los "oídos" al navegador
    events.forEach((event) => window.addEventListener(event, handleEvent));

    // Limpieza cuando el usuario sale de la página
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((event) => window.removeEventListener(event, handleEvent));
    };
  }, [timeoutMinutes]);
};
