# Deploy: horarios de turnos

Orden obligatorio (las tablas deben existir antes de publicar el código):

1. `npm run db:esquema` — aplica `002_horarios.sql` y `003_dias_especiales.sql` (solo crea tablas nuevas; no toca retiros). Si 002 ya estaba, aplica solo 003.
   En PowerShell, `npm run x -- args` pierde el `--` y npm se come `--escribir`; usar
   `npx tsx --env-file=.env.local scripts/importar-horario-excel.mts "Horario 2026.xlsx" [--escribir]`.
2. `npm run horario:importar -- "Horario 2026.xlsx"` — revisar el resumen.
3. `npm run horario:importar -- "Horario 2026.xlsx" --escribir` — importa octubre, el estado del 01/11 y las ausencias. Se niega si ya hay meses.
4. Merge de `feature/horarios` a `main` → Vercel publica.
5. En `/horarios`: ver octubre, ir a noviembre y pulsar "Generar mes". Revisar y ajustar casillas.
6. Pestaña Días especiales: cargar Navidad, 31/12, etc. Si el mes ya está generado, se rehace solo ese día.
7. Pestaña Enlace → "Copiar enlace 2026" y enviarlo. Hoy muestra solo octubre; noviembre aparece el 01/11 (hora de Caracas).

Rollback: revertir el merge. Las tablas nuevas pueden quedar; no afectan al resto.
