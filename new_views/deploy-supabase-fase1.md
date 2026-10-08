# Paso a producción: Supabase fase 1 (retiros)

Requisito: `feature/nuevas-vistas` ya está en `main` y en producción.

## Antes (cualquier día)
1. Vercel → Settings → Environment Variables: agregar `DATABASE_URL` (transaction pooler, puerto 6543, la misma de `.env.local`) para **Production y Preview**. `DIRECT_URL` no hace falta en Vercel: solo la usan los scripts desde tu PC.
2. Abrir un PR de `feature/supabase` a `main` y probar el Preview completo: dashboard, monitor, reportes, auditoría, evaluación y expediente.
3. Este PR trae `vercel.json` con `"regions": ["pdx1"]`: desde el merge, las funciones corren en Oregón, junto a Supabase.

## El corte (fuera de horario, ~15 minutos)
1. Avisar que nadie cargue reportes ni exonere durante el corte.
2. `npm run db:copiar` → copia fresca de Firestore (vacía las tablas y copia todo; ~2 minutos).
3. `npm run db:verificar` → debe terminar con "Todo coincide."
4. Hacer merge del PR. Vercel despliega.
5. Probar en producción: cargar un día por API, exonerar un retiro, abrir dashboard y monitor.

## Si algo sale mal
- Vercel → Deployments → el deploy anterior → **Instant Rollback**. La app vuelve a leer Firestore, que quedó intacto.
- Lo que se haya cargado o exonerado en Postgres después del corte no estará en Firestore: anotarlo y repetirlo a mano.

## Después
- Firestore conserva las tres colecciones como respaldo. No se borran en esta fase.
- Fase 2: evaluaciones, cierres, configuración y enlaces.
