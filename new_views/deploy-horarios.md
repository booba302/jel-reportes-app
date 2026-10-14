# Deploy: horarios de turnos

Orden obligatorio (las tablas deben existir antes de publicar el código):

1. `npm run db:esquema` — aplica `002_horarios.sql` (solo crea tablas nuevas; no toca retiros).
2. `npm run horario:importar -- "Horario 2026.xlsx"` — revisar el resumen.
3. `npm run horario:importar -- "Horario 2026.xlsx" --escribir` — importa octubre, el estado del 01/11 y las ausencias. Se niega si ya hay meses.
4. Merge de `feature/horarios` a `main` → Vercel publica.
5. En `/horarios`: ver octubre, ir a noviembre y pulsar "Generar mes". Revisar y ajustar casillas.
6. Pestaña Enlace → "Copiar enlace 2026" y enviarlo. Hoy muestra solo octubre; noviembre aparece el 01/11 (hora de Caracas).

Rollback: revertir el merge. Las tablas nuevas pueden quedar; no afectan al resto.
